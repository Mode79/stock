// Professional technical-analysis toolkit.
// Computes a full institutional-grade indicator suite from OHLCV candles.
// All functions are pure and defensive against short / dirty series.

export interface Candle {
  date?: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

export interface TechnicalProfile {
  currentPrice: number;
  bars: number;                // number of clean candles used (data sufficiency)
  // Trend
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
  trendRegime: 'STRONG_UP' | 'UP' | 'SIDEWAYS' | 'DOWN' | 'STRONG_DOWN';
  adx: number;                 // trend strength (0-100); >25 = trending
  // Momentum
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  // Volatility / risk
  atr: number;
  atrPct: number;
  annualizedVol: number;
  maxDrawdown: number;
  beta: number;
  bollUpper: number;
  bollLower: number;
  bollPercentB: number;        // 0 = at lower band, 1 = at upper band
  bollSqueeze: boolean;        // volatility compression -> breakout watch
  // Volume / flow
  obvSlope: number;            // normalized -1..1 slope of OBV (institutional flow proxy)
  volumeTrendPct: number;      // recent avg volume vs prior avg volume, %
  relVolume: number;           // latest volume vs 20-day average (1 = normal)
  volumeDivergence: 'BULLISH' | 'BEARISH' | 'NONE'; // price vs volume disagreement
  // Structure
  support: number;
  resistance: number;
  pivot: number;
  // Performance / relative strength
  perfPct: number;             // total return across the window
  relStrengthPct: number;      // stock perf minus benchmark perf (alpha proxy)
  high52: number;
  low52: number;
  distFromHighPct: number;     // how far below the period high (negative = below)
  // Daily volatility (for probability cone)
  dailySigma: number;          // std-dev of daily returns
}

const num = (v: any, fallback = 0): number => (Number.isFinite(Number(v)) ? Number(v) : fallback);

export function sma(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-Math.min(period, values.length));
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / values.length);
}

export function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let prev = values.slice(0, Math.min(period, values.length)).reduce((a, b) => a + b, 0) / Math.min(period, values.length);
  for (let i = period; i < values.length; i++) prev = values[i] * k + prev * (1 - k);
  return prev;
}

function emaSeries(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

// Wilder's RSI — the industry-standard smoothing used by broker platforms.
export function wilderRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff; else loss -= diff;
  }
  let avgGain = gain / period, avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Average True Range — true volatility incorporating gaps.
export function atr(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = num(candles[i - 1].close);
    const high = num(c.high, c.close), low = num(c.low, c.close);
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  return sma(trs, period);
}

// Wilder's ADX — measures trend STRENGTH (not direction). >25 trending, <20 choppy.
export function adx(candles: Candle[], period = 14): number {
  if (candles.length < period * 2) return 0;
  const plusDM: number[] = [], minusDM: number[] = [], trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = num(candles[i].high, candles[i].close), l = num(candles[i].low, candles[i].close);
    const ph = num(candles[i - 1].high, candles[i - 1].close), pl = num(candles[i - 1].low, candles[i - 1].close);
    const pc = num(candles[i - 1].close);
    const up = h - ph, down = pl - l;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  // Wilder smoothing
  const smooth = (arr: number[]) => {
    let s = arr.slice(0, period).reduce((a, b) => a + b, 0);
    const out = [s];
    for (let i = period; i < arr.length; i++) { s = s - s / period + arr[i]; out.push(s); }
    return out;
  };
  const strs = smooth(trs), spDM = smooth(plusDM), smDM = smooth(minusDM);
  const dx: number[] = [];
  for (let i = 0; i < strs.length; i++) {
    const pDI = strs[i] ? (spDM[i] / strs[i]) * 100 : 0;
    const mDI = strs[i] ? (smDM[i] / strs[i]) * 100 : 0;
    const sum = pDI + mDI;
    dx.push(sum ? (Math.abs(pDI - mDI) / sum) * 100 : 0);
  }
  if (dx.length < period) return dx.length ? dx[dx.length - 1] : 0;
  // ADX = smoothed average of DX
  let adxVal = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dx.length; i++) adxVal = (adxVal * (period - 1) + dx[i]) / period;
  return adxVal;
}

function obvSlopeNormalized(candles: Candle[]): number {
  if (candles.length < 5 || !candles.some(c => num(c.volume) > 0)) return 0;
  const obv: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const dir = Math.sign(num(candles[i].close) - num(candles[i - 1].close));
    obv.push(obv[i - 1] + dir * num(candles[i].volume));
  }
  const n = obv.length;
  const mx = (n - 1) / 2, my = obv.reduce((a, b) => a + b, 0) / n;
  let cov = 0, varx = 0;
  for (let i = 0; i < n; i++) { cov += (i - mx) * (obv[i] - my); varx += (i - mx) ** 2; }
  const slope = varx === 0 ? 0 : cov / varx;
  const scale = Math.max(...obv.map(Math.abs)) / n || 1;
  return Math.max(-1, Math.min(1, slope / scale));
}

// Linear-regression slope sign over the last `lookback` points.
function slopeSign(values: number[], lookback: number): number {
  const v = values.slice(-lookback);
  if (v.length < 3) return 0;
  const n = v.length, mx = (n - 1) / 2, my = v.reduce((a, b) => a + b, 0) / n;
  let cov = 0, varx = 0;
  for (let i = 0; i < n; i++) { cov += (i - mx) * (v[i] - my); varx += (i - mx) ** 2; }
  return Math.sign(varx ? cov / varx : 0);
}

function pivotLevels(candles: Candle[]): { support: number; resistance: number; pivot: number } {
  const closes = candles.map(c => num(c.close));
  const highs = candles.map(c => num(c.high, c.close));
  const lows = candles.map(c => num(c.low, c.close));
  const current = closes[closes.length - 1] || 0;
  const swingHighs: number[] = [], swingLows: number[] = [];
  for (let i = 2; i < candles.length - 2; i++) {
    if (highs[i] >= highs[i - 1] && highs[i] >= highs[i - 2] && highs[i] >= highs[i + 1] && highs[i] >= highs[i + 2]) swingHighs.push(highs[i]);
    if (lows[i] <= lows[i - 1] && lows[i] <= lows[i - 2] && lows[i] <= lows[i + 1] && lows[i] <= lows[i + 2]) swingLows.push(lows[i]);
  }
  const support = Math.max(...swingLows.filter(l => l < current), Math.min(...(lows.length ? lows : [current])));
  const resistance = Math.min(...swingHighs.filter(h => h > current), Math.max(...(highs.length ? highs : [current])));
  const pivot = (current + (Number.isFinite(support) ? support : current) + (Number.isFinite(resistance) ? resistance : current)) / 3;
  return {
    support: Number.isFinite(support) ? support : current * 0.92,
    resistance: Number.isFinite(resistance) ? resistance : current * 1.08,
    pivot,
  };
}

function maxDrawdown(closes: number[]): number {
  let peak = -Infinity, maxDD = 0;
  for (const p of closes) {
    if (p > peak) peak = p;
    const dd = peak > 0 ? (peak - p) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD * 100;
}

function dailyReturns(closes: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < closes.length; i++) r.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  return r;
}

function computeBeta(closes: number[], benchmark?: number[]): number {
  if (!benchmark || benchmark.length < 3) return 1;
  const n = Math.min(closes.length, benchmark.length);
  const ra = dailyReturns(closes.slice(-n)), rb = dailyReturns(benchmark.slice(-n));
  const m = Math.min(ra.length, rb.length);
  if (m < 2) return 1;
  const a = ra.slice(-m), b = rb.slice(-m);
  const ma = a.reduce((x, y) => x + y, 0) / m, mb = b.reduce((x, y) => x + y, 0) / m;
  let cov = 0, varb = 0;
  for (let i = 0; i < m; i++) { cov += (a[i] - ma) * (b[i] - mb); varb += (b[i] - mb) ** 2; }
  return varb === 0 ? 1 : cov / varb;
}

// Resample daily candles into weekly OHLCV (ISO-week buckets) for higher-timeframe analysis.
export function resampleWeekly(candles: Candle[]): Candle[] {
  const clean = (candles || []).filter(c => Number.isFinite(Number(c?.close)));
  if (clean.length === 0) return [];
  const weekKey = (d: string) => {
    const dt = new Date(d);
    const onejan = new Date(dt.getFullYear(), 0, 1);
    const week = Math.ceil((((dt.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
    return `${dt.getFullYear()}-W${week}`;
  };
  const buckets = new Map<string, Candle[]>();
  clean.forEach(c => {
    const k = c.date ? weekKey(c.date) : String(buckets.size);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(c);
  });
  return Array.from(buckets.values()).map(group => ({
    date: group[group.length - 1].date,
    open: num(group[0].open, group[0].close),
    high: Math.max(...group.map(g => num(g.high, g.close))),
    low: Math.min(...group.map(g => num(g.low, g.close))),
    close: num(group[group.length - 1].close),
    volume: group.reduce((a, g) => a + num(g.volume), 0),
  }));
}

// Project a probability cone forward using historical daily volatility (geometric random walk).
export function probabilityCone(price: number, dailySigma: number, horizonDays: number, driftDaily = 0) {
  const sigmaH = dailySigma * Math.sqrt(horizonDays);
  const driftH = driftDaily * horizonDays;
  // ~68% band (±1σ) and ~90% band (±1.645σ) on log returns.
  const lo68 = price * Math.exp(driftH - sigmaH);
  const hi68 = price * Math.exp(driftH + sigmaH);
  const lo90 = price * Math.exp(driftH - 1.645 * sigmaH);
  const hi90 = price * Math.exp(driftH + 1.645 * sigmaH);
  const mid = price * Math.exp(driftH);
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return { mid: r2(mid), lo68: r2(lo68), hi68: r2(hi68), lo90: r2(lo90), hi90: r2(hi90), horizonDays };
}

export function buildTechnicalProfile(candles: Candle[], benchmarkCloses?: number[]): TechnicalProfile | null {
  const clean = (candles || []).filter(c => Number.isFinite(Number(c?.close)) && Number(c.close) > 0);
  if (clean.length < 15) return null;

  const closes = clean.map(c => num(c.close));
  const current = closes[closes.length - 1];

  const ema12s = emaSeries(closes, 12), ema26s = emaSeries(closes, 26);
  const macdLine = ema12s.map((v, i) => v - ema26s[i]);
  const signalSeries = emaSeries(macdLine, 9);
  const macd = macdLine[macdLine.length - 1] || 0;
  const macdSignal = signalSeries[signalSeries.length - 1] || 0;

  const sma20 = sma(closes, 20), sma50 = sma(closes, 50), sma200 = sma(closes, 200);

  let trendRegime: TechnicalProfile['trendRegime'] = 'SIDEWAYS';
  const above50 = current > sma50;
  const above200 = sma200 > 0 ? current > sma200 : above50;
  const stacked = sma20 > sma50 && (sma200 === 0 || sma50 > sma200);
  const stackedDown = sma20 < sma50 && (sma200 === 0 || sma50 < sma200);
  if (above50 && above200 && stacked) trendRegime = 'STRONG_UP';
  else if (above50) trendRegime = 'UP';
  else if (!above50 && !above200 && stackedDown) trendRegime = 'STRONG_DOWN';
  else if (!above50) trendRegime = 'DOWN';

  const { support, resistance, pivot } = pivotLevels(clean);
  const atrVal = atr(clean, 14);
  const high52 = Math.max(...closes), low52 = Math.min(...closes);

  // Bollinger Bands (20, 2σ)
  const bollWindow = closes.slice(-20);
  const bollMid = sma(closes, 20);
  const bollSd = stdev(bollWindow);
  const bollUpper = bollMid + 2 * bollSd, bollLower = bollMid - 2 * bollSd;
  const bollPercentB = bollUpper > bollLower ? (current - bollLower) / (bollUpper - bollLower) : 0.5;
  // Squeeze: current bandwidth in the lowest 25% of its recent history.
  const bandwidths: number[] = [];
  for (let i = 20; i <= closes.length; i++) {
    const w = closes.slice(i - 20, i);
    const m = w.reduce((a, b) => a + b, 0) / w.length;
    bandwidths.push(m ? (4 * stdev(w)) / m : 0);
  }
  const curBW = bandwidths[bandwidths.length - 1] || 0;
  const sortedBW = [...bandwidths].sort((a, b) => a - b);
  const bwQ25 = sortedBW[Math.floor(sortedBW.length * 0.25)] || 0;
  const bollSqueeze = curBW > 0 && curBW <= bwQ25;

  // Volume metrics
  const vols = clean.map(c => num(c.volume));
  const half = Math.floor(vols.length / 2);
  const recentVol = sma(vols.slice(half), Math.max(1, vols.length - half));
  const priorVol = sma(vols.slice(0, half), Math.max(1, half));
  const volumeTrendPct = priorVol > 0 ? ((recentVol - priorVol) / priorVol) * 100 : 0;
  const avg20Vol = sma(vols, 20);
  const relVolume = avg20Vol > 0 ? vols[vols.length - 1] / avg20Vol : 1;

  // Price/volume divergence over the last ~20 bars
  const lb = Math.min(20, clean.length);
  const priceSlope = slopeSign(closes, lb);
  const volSlope = slopeSign(vols, lb);
  let volumeDivergence: TechnicalProfile['volumeDivergence'] = 'NONE';
  if (priceSlope > 0 && volSlope < 0) volumeDivergence = 'BEARISH';   // rising price, fading volume
  else if (priceSlope < 0 && volSlope > 0) volumeDivergence = 'BULLISH'; // falling price, rising accumulation

  const rets = dailyReturns(closes);
  const dailySigma = stdev(rets);
  const annualized = dailySigma * Math.sqrt(252) * 100;

  // Relative strength vs benchmark over the common window
  let relStrengthPct = 0;
  if (benchmarkCloses && benchmarkCloses.length > 2) {
    const bPerf = ((benchmarkCloses[benchmarkCloses.length - 1] - benchmarkCloses[0]) / benchmarkCloses[0]) * 100;
    const sPerf = ((current - closes[0]) / closes[0]) * 100;
    relStrengthPct = sPerf - bPerf;
  }

  return {
    currentPrice: current,
    bars: clean.length,
    sma20, sma50, sma200,
    ema12: ema12s[ema12s.length - 1] || current,
    ema26: ema26s[ema26s.length - 1] || current,
    trendRegime,
    adx: adx(clean, 14),
    rsi: wilderRSI(closes, 14),
    macd, macdSignal, macdHistogram: macd - macdSignal,
    atr: atrVal,
    atrPct: current > 0 ? (atrVal / current) * 100 : 0,
    annualizedVol: annualized,
    maxDrawdown: maxDrawdown(closes),
    beta: computeBeta(closes, benchmarkCloses),
    bollUpper, bollLower, bollPercentB, bollSqueeze,
    obvSlope: obvSlopeNormalized(clean),
    volumeTrendPct, relVolume, volumeDivergence,
    support, resistance, pivot,
    perfPct: closes[0] > 0 ? ((current - closes[0]) / closes[0]) * 100 : 0,
    relStrengthPct,
    high52, low52,
    distFromHighPct: high52 > 0 ? ((current - high52) / high52) * 100 : 0,
    dailySigma,
  };
}
