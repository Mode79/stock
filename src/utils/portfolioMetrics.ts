// Portfolio-level wealth metrics: money-weighted return (XIRR), aggregate risk,
// allocation/concentration, and real (inflation/USD-adjusted) returns.
// Pure functions — defensive against sparse data.

export interface Cashflow { date: string; amount: number; } // -out (invested), +in (returned)

export interface RiskMetrics {
  annualVol: number;        // % annualized portfolio volatility
  beta: number;             // vs benchmark
  sharpe: number;           // risk-adjusted return (annualized)
  maxDrawdown: number;      // % worst peak-to-trough of the book
  available: boolean;
}

export interface AllocationSlice { key: string; label: string; value: number; pct: number; }

const r2 = (v: number) => Math.round(v * 100) / 100;

// ---------------- XIRR (money-weighted annualized return) ----------------
// Newton-Raphson on the NPV of dated cashflows. Returns a decimal rate (0.18 = 18%).
export function xirr(flows: Cashflow[]): number | null {
  const cf = flows.filter(f => Number.isFinite(f.amount) && f.amount !== 0);
  if (cf.length < 2) return null;
  const hasNeg = cf.some(f => f.amount < 0), hasPos = cf.some(f => f.amount > 0);
  if (!hasNeg || !hasPos) return null;

  const t0 = new Date(cf[0].date).getTime();
  const years = (d: string) => (new Date(d).getTime() - t0) / (365 * 86400000);
  const npv = (rate: number) => cf.reduce((s, f) => s + f.amount / Math.pow(1 + rate, years(f.date)), 0);
  const dnpv = (rate: number) => cf.reduce((s, f) => {
    const t = years(f.date);
    return s - (t * f.amount) / Math.pow(1 + rate, t + 1);
  }, 0);

  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const v = npv(rate), d = dnpv(rate);
    if (Math.abs(d) < 1e-10) break;
    const next = rate - v / d;
    if (!Number.isFinite(next)) break;
    if (Math.abs(next - rate) < 1e-7) { rate = next; break; }
    rate = next;
    if (rate <= -0.9999) rate = -0.99; // keep solver in domain
  }
  return Number.isFinite(rate) && rate > -0.9999 && rate < 100 ? rate : null;
}

// Build external cashflows for the whole book: money you put in (deposits, -),
// money taken out (withdrawals, +), and the terminal equity value today (+).
// Buys/Sells/Dividends are internal (wallet<->holdings) so excluded — dividend
// cash lives inside walletBalance, which is already folded into terminalValue,
// so counting it again here would double it.
export function buildPortfolioCashflows(transactions: any[], terminalValue: number, asOf: string): Cashflow[] {
  const flows: Cashflow[] = [];
  [...transactions].sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
    if (t.type === 'Deposit') flows.push({ date: t.date, amount: -Math.abs(t.price) });
    else if (t.type === 'Withdraw') flows.push({ date: t.date, amount: Math.abs(t.price) });
  });
  flows.push({ date: asOf, amount: Math.abs(terminalValue) });
  return flows;
}

// Simple (non-annualized) total return on invested capital, for reference.
// terminalValue (equity + walletBalance) already includes any dividend cash
// that hasn't been withdrawn, so dividends are NOT added again here.
export function totalReturnOnCapital(transactions: any[], terminalValue: number): number | null {
  let invested = 0, returned = 0;
  transactions.forEach(t => {
    if (t.type === 'Deposit') invested += Math.abs(t.price);
    else if (t.type === 'Withdraw') returned += Math.abs(t.price);
  });
  if (invested <= 0) return null;
  return r2(((returned + terminalValue - invested) / invested) * 100);
}

// ---------------- Aggregate portfolio risk ----------------
export function dailyReturns(closes: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < closes.length; i++) if (closes[i - 1]) r.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  return r;
}
export function stdev(v: number[]): number {
  if (v.length < 2) return 0;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
}

// Weighted portfolio return series from per-holding close histories aligned by date.
export function portfolioRisk(
  holdings: { ticker: string; weight: number }[],
  histories: Record<string, { date: string; close: number }[]>,
  benchmarkCloses: number[] = [],
  riskFreePct = 22, // EGP risk-free proxy (T-bill-ish); user-configurable upstream
): RiskMetrics {
  // Align on benchmark/longest common date set.
  const valid = holdings.filter(h => (histories[h.ticker]?.length || 0) > 20 && h.weight > 0);
  if (valid.length === 0) return { annualVol: 0, beta: 0, sharpe: 0, maxDrawdown: 0, available: false };

  const wSum = valid.reduce((a, h) => a + h.weight, 0) || 1;
  // Build a map date->close per ticker, then a common sorted date axis.
  const maps: Record<string, Map<string, number>> = {};
  valid.forEach(h => {
    const m = new Map<string, number>();
    histories[h.ticker].forEach(p => m.set(p.date.split('T')[0], p.close));
    maps[h.ticker] = m;
  });
  const dateSets = valid.map(h => new Set(maps[h.ticker].keys()));
  let common = [...dateSets[0]];
  for (let i = 1; i < dateSets.length; i++) common = common.filter(d => dateSets[i].has(d));
  common.sort();
  if (common.length < 20) return { annualVol: 0, beta: 0, sharpe: 0, maxDrawdown: 0, available: false };

  // Portfolio index value over time (weighted, normalized to each ticker's first common close).
  const firsts: Record<string, number> = {};
  valid.forEach(h => { firsts[h.ticker] = maps[h.ticker].get(common[0])!; });
  const portSeries = common.map(d =>
    valid.reduce((acc, h) => acc + (h.weight / wSum) * (maps[h.ticker].get(d)! / firsts[h.ticker]), 0)
  );
  const portRets = dailyReturns(portSeries);
  const annualVol = r2(stdev(portRets) * Math.sqrt(252) * 100);

  // Max drawdown of the book
  let peak = -Infinity, maxDD = 0;
  portSeries.forEach(v => { if (v > peak) peak = v; const dd = peak ? (peak - v) / peak : 0; if (dd > maxDD) maxDD = dd; });

  // Beta vs benchmark (align benchmark to common axis if possible; else use its own returns)
  let beta = 1;
  if (benchmarkCloses.length > 20) {
    const n = Math.min(portRets.length, benchmarkCloses.length - 1);
    const br = dailyReturns(benchmarkCloses).slice(-n);
    const pr = portRets.slice(-n);
    const mb = br.reduce((a, b) => a + b, 0) / br.length;
    const mp = pr.reduce((a, b) => a + b, 0) / pr.length;
    let cov = 0, varb = 0;
    for (let i = 0; i < n; i++) { cov += (pr[i] - mp) * (br[i] - mb); varb += (br[i] - mb) ** 2; }
    beta = varb ? r2(cov / varb) : 1;
  }

  // Annualized return of the book over the window, for Sharpe
  const totalRet = portSeries[portSeries.length - 1] / portSeries[0] - 1;
  const yrs = Math.max(0.08, common.length / 252);
  const annualRet = (Math.pow(1 + totalRet, 1 / yrs) - 1) * 100;
  const sharpe = annualVol > 0 ? r2((annualRet - riskFreePct) / annualVol) : 0;

  return { annualVol, beta, sharpe, maxDrawdown: r2(maxDD * 100), available: true };
}

// ---------------- Allocation & concentration ----------------
export function allocationByPosition(holdings: { ticker: string; value: number }[]): AllocationSlice[] {
  const total = holdings.reduce((a, h) => a + h.value, 0) || 1;
  return holdings.map(h => ({ key: h.ticker, label: h.ticker, value: h.value, pct: r2((h.value / total) * 100) }))
    .sort((a, b) => b.value - a.value);
}
export function allocationBySector(holdings: { sector: string; value: number }[]): AllocationSlice[] {
  const total = holdings.reduce((a, h) => a + h.value, 0) || 1;
  const m = new Map<string, number>();
  holdings.forEach(h => m.set(h.sector || 'Other', (m.get(h.sector || 'Other') || 0) + h.value));
  return [...m.entries()].map(([k, v]) => ({ key: k, label: k, value: v, pct: r2((v / total) * 100) }))
    .sort((a, b) => b.value - a.value);
}
// Herfindahl-Hirschman Index (0..1). >0.25 = concentrated.
export function concentrationHHI(slices: AllocationSlice[]): number {
  return r2(slices.reduce((a, s) => a + Math.pow(s.pct / 100, 2), 0) * 100) / 100;
}

// ---------------- Real & currency-adjusted returns ----------------
export function realReturn(nominalPct: number, inflationPct: number): number {
  // Fisher: (1+nominal)/(1+inflation) - 1
  return r2((((1 + nominalPct / 100) / (1 + inflationPct / 100)) - 1) * 100);
}
// Convert an EGP performance % to USD terms given start/end USD-per-EGP (i.e., 1/USDEGP).
export function usdAdjustedReturn(nominalEgpPct: number, usdEgpStart: number, usdEgpEnd: number): number | null {
  if (!usdEgpStart || !usdEgpEnd) return null;
  // EGP weakened if USDEGP rose. Value in USD = valueEGP / USDEGP.
  const fx = usdEgpStart / usdEgpEnd; // <1 when EGP devalued
  return r2((((1 + nominalEgpPct / 100) * fx) - 1) * 100);
}
