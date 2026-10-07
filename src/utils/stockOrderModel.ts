export type PriceBar = { date: string; open: number; high: number; low: number; close: number; volume: number };
export type Pattern = 'trend_pullback' | 'range_rebound' | 'breakout_retest';
export type OrderPlan = { side: 'BUY'; limit: number; stop: number; target: number; expiresAfterSessions: number; maxHoldSessions: number; riskReward: number };
export type TestStats = { trades: number; wins: number; winRate: number | null; mean: number | null; median: number | null; profitFactor: number | null; maxDrawdown: number; returnByYear: Record<string, number | null> };
export type ModelAssessment = { pattern: Pattern | null; trust: 'INSUFFICIENT' | 'LOW' | 'MEDIUM' | 'HIGH'; reason: string; historyBars: number; rejectedBars: number; firstDate: string; lastDate: string; development: TestStats; validation: TestStats; plan: OrderPlan | null; asOfClose: number; atr: number | null; recentLow: number | null; recentHigh: number | null };

type Feature = { trend: boolean; atr: number; pullback: number; distanceToLow: number; high20: number; low20: number; volumeRatio: number; gain: number };
type Trade = { date: string; ret: number };

const emptyStats = (): TestStats => ({ trades: 0, wins: 0, winRate: null, mean: null, median: null, profitFactor: null, maxDrawdown: 0, returnByYear: {} });
const round = (value: number) => Math.round(value * 100) / 100;
const finite = (value: number) => Number.isFinite(value) && value > 0;

export function cleanPriceBars(input: unknown[]): PriceBar[] {
  const rows: PriceBar[] = [];
  for (const item of input) {
    const r = item as Partial<PriceBar>;
    const d = new Date(String(r.date || ''));
    const date = Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
    const open = Number(r.open), high = Number(r.high), low = Number(r.low), close = Number(r.close), volume = Number(r.volume);
    // Source opens disagree on some EGX dates. They are retained for audit but never used
    // for signals or fills; only high/low/close/volume must pass the quality gate.
    if (!date || ![high, low, close].every(finite) || high < close || low > close || high < low || !Number.isFinite(volume) || volume < 0) continue;
    rows.push({ date, open, high, low, close, volume });
  }
  return [...new Map(rows.map((bar) => [bar.date, bar])).values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function features(bars: PriceBar[]): (Feature | null)[] {
  let ema20 = bars[0].close, ema50 = bars[0].close;
  const out: (Feature | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    ema20 += (bar.close - ema20) * 2 / 21;
    ema50 += (bar.close - ema50) * 2 / 51;
    if (i < 50) { out.push(null); continue; }
    const prior20 = bars.slice(i - 20, i);
    const high20 = Math.max(...prior20.map((b) => b.high));
    const low20 = Math.min(...prior20.map((b) => b.low));
    let trueRange = 0;
    for (let j = i - 13; j <= i; j++) trueRange += Math.max(bars[j].high - bars[j].low, Math.abs(bars[j].high - bars[j - 1].close), Math.abs(bars[j].low - bars[j - 1].close));
    const volumeAverage = prior20.reduce((sum, b) => sum + b.volume, 0) / 20;
    out.push({ trend: ema20 > ema50 && bar.close > ema50, atr: trueRange / 14, pullback: 1 - bar.close / high20,
      distanceToLow: bar.close / low20 - 1, high20, low20, volumeRatio: volumeAverage > 0 ? bar.volume / volumeAverage : 0,
      gain: bar.close / bars[i - 1].close - 1 });
  }
  return out;
}

function setup(pattern: Pattern, bar: PriceBar, f: Feature, previous: PriceBar): boolean {
  if (f.atr / bar.close > .08 || f.atr / bar.close < .005) return false;
  if (pattern === 'trend_pullback') return f.trend && f.pullback >= .03 && f.pullback <= .10 && f.gain > 0 && bar.close > previous.close;
  if (pattern === 'range_rebound') return !f.trend && f.distanceToLow >= 0 && f.distanceToLow <= .04 && f.gain > 0;
  return f.trend && bar.close > f.high20 && f.volumeRatio >= 1.2;
}

function order(pattern: Pattern, bar: PriceBar, f: Feature): OrderPlan {
  const limit = pattern === 'breakout_retest' ? Math.min(bar.close, f.high20 + f.atr * .1)
    : pattern === 'range_rebound' ? Math.min(bar.close, f.low20 + f.atr * .5)
    : bar.close - f.atr * .35;
  const risk = f.atr * 1.5;
  const reward = f.atr * 2.5;
  return { side: 'BUY', limit: round(limit), stop: round(limit - risk), target: round(limit + reward),
    expiresAfterSessions: 3, maxHoldSessions: 10, riskReward: reward / risk };
}

// Signal at session t. A buy limit becomes active only at t+1. A limit must be traded
// through by 0.1%, not merely touched. Opens are unverified, so the simulation always
// uses the limit even after favorable gaps and penalizes stops by another 1%.
// Same-day ambiguity resolves against the strategy: stop before target.
export function simulate(bars: PriceBar[], fs: (Feature | null)[], pattern: Pattern, start: number, end: number): Trade[] {
  const trades: Trade[] = [];
  let nextFree = start;
  for (let i = Math.max(50, start); i <= Math.min(end, bars.length - 14); i++) {
    const f = fs[i];
    if (i < nextFree || !f || !setup(pattern, bars[i], f, bars[i - 1])) continue;
    const plan = order(pattern, bars[i], f);
    let entryIndex = -1, entry = 0;
    for (let j = i + 1; j <= i + 3 && j < bars.length; j++) {
      const b = bars[j];
      if (b.low <= plan.limit * .999) { entryIndex = j; entry = plan.limit; break; }
    }
    if (entryIndex < 0) continue;
    const stop = entry - 1.5 * f.atr, target = entry + 2.5 * f.atr;
    let exitIndex = Math.min(entryIndex + 10, bars.length - 1);
    let exit = bars[exitIndex].close;
    for (let j = entryIndex; j <= exitIndex; j++) {
      const b = bars[j];
      if (b.low <= stop) { exit = stop * .99; exitIndex = j; break; }
      if (b.high >= target) { exit = target; exitIndex = j; break; }
    }
    trades.push({ date: bars[entryIndex].date, ret: exit / entry - 1 - .008 });
    nextFree = exitIndex + 1;
  }
  return trades;
}

function summarize(trades: Trade[]): TestStats {
  if (!trades.length) return emptyStats();
  const returns = trades.map((t) => t.ret);
  const wins = returns.filter((r) => r > 0);
  const losses = returns.filter((r) => r < 0);
  const ordered = [...returns].sort((a, b) => a - b);
  let equity = 1, peak = 1, maxDrawdown = 0;
  for (const ret of returns) { equity *= 1 + ret; peak = Math.max(peak, equity); maxDrawdown = Math.min(maxDrawdown, equity / peak - 1); }
  const byYear: Record<string, number[]> = {};
  for (const trade of trades) (byYear[trade.date.slice(0, 4)] ||= []).push(trade.ret);
  return { trades: trades.length, wins: wins.length, winRate: wins.length / trades.length,
    mean: returns.reduce((a, b) => a + b, 0) / returns.length,
    median: ordered.length % 2 ? ordered[Math.floor(ordered.length / 2)] : (ordered[ordered.length / 2 - 1] + ordered[ordered.length / 2]) / 2,
    profitFactor: losses.length ? wins.reduce((a, b) => a + b, 0) / -losses.reduce((a, b) => a + b, 0) : null,
    maxDrawdown, returnByYear: Object.fromEntries(Object.entries(byYear).map(([year, values]) => [year, values.reduce((a, b) => a + b, 0) / values.length])) };
}

export function assessStock(input: unknown[]): ModelAssessment {
  const bars = cleanPriceBars(input);
  const recentBars = bars.slice(-5);
  const base: ModelAssessment = { pattern: null, trust: 'INSUFFICIENT', reason: 'Not enough verified daily OHLCV history.', historyBars: bars.length, rejectedBars: input.length - bars.length,
    firstDate: bars[0]?.date || '', lastDate: bars.at(-1)?.date || '', development: emptyStats(), validation: emptyStats(), plan: null,
    asOfClose: bars.at(-1)?.close || 0, atr: null,
    recentLow: recentBars.length === 5 ? round(Math.min(...recentBars.map((bar) => bar.low))) : null,
    recentHigh: recentBars.length === 5 ? round(Math.max(...recentBars.map((bar) => bar.high))) : null };
  if (input.length && base.rejectedBars / input.length > .02) return { ...base, reason: 'More than 2% of daily bars have invalid or conflicting OHLCV values. Orders are blocked until the source is reconciled.' };
  if (bars.length < 500) return base;
  const fs = features(bars);
  const firstValidation = bars.findIndex((bar) => bar.date >= '2025-01-01');
  if (firstValidation < 300 || bars.length - firstValidation < 100) return { ...base, reason: 'Need substantial development and later validation periods.' };
  const candidates: Pattern[] = ['trend_pullback', 'range_rebound', 'breakout_retest'];
  const development = candidates.map((pattern) => ({ pattern, stats: summarize(simulate(bars, fs, pattern, 50, firstValidation - 14)) }));
  // Select using development results only; validation remains untouched until selection.
  const eligible = development.filter(({ stats }) => stats.trades >= 12 && (stats.mean ?? 0) > 0 && (stats.profitFactor ?? 0) > 1);
  if (!eligible.length) return { ...base, reason: 'No pattern passed the development-period screen.' };
  eligible.sort((a, b) => (b.stats.mean ?? 0) - (a.stats.mean ?? 0));
  const selected = eligible[0];
  const validation = summarize(simulate(bars, fs, selected.pattern, firstValidation, bars.length - 14));
  const years = Object.values(validation.returnByYear).filter((x): x is number => x !== null);
  const positiveYears = years.length >= 2 && years.every((mean) => mean > 0);
  let trust: ModelAssessment['trust'] = 'LOW';
  if (validation.trades >= 30 && positiveYears && (validation.mean ?? 0) >= .01 && (validation.profitFactor ?? 0) >= 1.5 && validation.maxDrawdown >= -.15) trust = 'HIGH';
  else if (validation.trades >= 20 && positiveYears && (validation.mean ?? 0) > 0 && (validation.profitFactor ?? 0) >= 1.25 && validation.maxDrawdown >= -.25) trust = 'MEDIUM';
  const last = bars.length - 1, f = fs[last];
  const recent = f && setup(selected.pattern, bars[last], f, bars[last - 1]);
  const plan = trust !== 'LOW' && recent && f ? order(selected.pattern, bars[last], f) : null;
  return { ...base, pattern: selected.pattern, trust,
    reason: trust === 'LOW' ? 'Validation is too thin or unstable for an order.' : recent ? 'Pattern active at the latest close; verify current data before placing an order.' : 'Validated pattern is not active today.',
    development: selected.stats, validation, plan, atr: f?.atr ?? null };
}
