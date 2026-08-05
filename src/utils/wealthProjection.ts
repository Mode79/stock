// Wealth trajectory: reconstruct historical net worth from transactions + price
// history, and project the future with a Monte-Carlo simulation (GBM) driven by
// the portfolio's own expected return and volatility.

export interface NetWorthPoint { date: string; contributed: number; value: number; gain: number; deposit?: number; }
export interface ProjectionPoint { month: number; date: string; p10: number; p50: number; p90: number; contributedLine: number; }

const fwdFill = (dates: string[], map: Map<string, number>): number[] => {
  const out: number[] = []; let last = 0;
  for (const d of dates) { const v = map.get(d); if (v != null) last = v; out.push(last); }
  return out;
};

// Day-by-day net worth: cash (deposits/withdrawals/buys/sells/dividends) + holdings
// valued at each day's close. `contributed` = net external capital you put in.
export function reconstructNetWorth(
  transactions: any[],
  histories: Record<string, { date: string; close: number }[]>,
): NetWorthPoint[] {
  const txs = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  if (txs.length === 0) return [];

  // Union of trading dates from all histories, bounded to >= first transaction.
  const firstDate = txs[0].date;
  const dateSet = new Set<string>();
  Object.values(histories).forEach(h => h.forEach(p => { const d = p.date.split('T')[0]; if (d >= firstDate) dateSet.add(d); }));
  txs.forEach(t => { if (t.date >= firstDate) dateSet.add(t.date); });
  const dates = [...dateSet].sort();
  if (dates.length === 0) return [];

  // Forward-filled close per ticker over the common date axis.
  const closeByTicker: Record<string, number[]> = {};
  Object.entries(histories).forEach(([tk, h]) => {
    const m = new Map<string, number>(); h.forEach(p => m.set(p.date.split('T')[0], p.close));
    closeByTicker[tk] = fwdFill(dates, m);
  });

  return dates.map((d, i) => {
    let cash = 0, contributed = 0;
    const shares: Record<string, number> = {};
    let depositToday = 0;
    for (const t of txs) {
      if (t.date > d) break;
      const isToday = t.date === d;
      switch (t.type) {
        case 'Deposit': cash += t.price; contributed += t.price; if (isToday) depositToday += t.price; break;
        case 'Withdraw': cash -= t.price; contributed -= t.price; if (isToday) depositToday -= t.price; break;
        case 'Dividend': cash += t.price; break;
        case 'Buy': cash -= (t.quantity * t.price + (t.fees || 0)); shares[t.ticker] = (shares[t.ticker] || 0) + t.quantity; break;
        case 'Sell': cash += (t.quantity * t.price - (t.fees || 0)); shares[t.ticker] = (shares[t.ticker] || 0) - t.quantity; break;
      }
    }
    let holdingsVal = 0;
    for (const [tk, q] of Object.entries(shares)) holdingsVal += q * (closeByTicker[tk]?.[i] || 0);
    const value = cash + holdingsVal;
    return { date: d, contributed: Math.round(contributed), value: Math.round(value), gain: Math.round(value - contributed), deposit: depositToday !== 0 ? depositToday : undefined };
  });
}

export interface GoalAnalysis {
  probability: number;          // % of simulated futures that reach the target by horizon
  medianMonths: number | null;  // median months-to-goal among the paths that reach it
  expectedDate: string | null;  // calendar date for medianMonths
  curve: { month: number; date: string; pct: number }[]; // cumulative % reached by month
}

// Across many simulated paths, how likely (and how soon) do we hit a target net worth?
export function goalAnalysis(
  start: number, expectedAnnualReturnPct: number, annualVolPct: number,
  years: number, monthlyContribution: number, target: number, sims = 1500,
): GoalAnalysis {
  const months = Math.max(1, Math.round(years * 12));
  const muM = expectedAnnualReturnPct / 100 / 12;
  const sigmaM = (annualVolPct / 100) / Math.sqrt(12);
  const drift = muM - 0.5 * sigmaM * sigmaM;
  const today = new Date();
  const gauss = makeGauss(mulberry32(seedFrom(start, expectedAnnualReturnPct, annualVolPct, years, monthlyContribution, target, sims)));

  const reachedAt = new Int32Array(sims).fill(-1);
  for (let s = 0; s < sims; s++) {
    let v = start;
    if (v >= target) { reachedAt[s] = 0; continue; }
    for (let m = 1; m <= months; m++) {
      v = v * Math.exp(drift + sigmaM * gauss()) + monthlyContribution;
      if (v >= target) { reachedAt[s] = m; break; }
    }
  }

  const reachedMonths: number[] = [];
  for (let s = 0; s < sims; s++) if (reachedAt[s] >= 0) reachedMonths.push(reachedAt[s]);
  const probability = Math.round((reachedMonths.length / sims) * 1000) / 10;

  let medianMonths: number | null = null, expectedDate: string | null = null;
  if (reachedMonths.length >= sims * 0.5) {
    reachedMonths.sort((a, b) => a - b);
    medianMonths = reachedMonths[Math.floor(reachedMonths.length / 2)];
    const d = new Date(today.getFullYear(), today.getMonth() + medianMonths, 1);
    expectedDate = d.toISOString().split('T')[0];
  }

  const curve: GoalAnalysis['curve'] = [];
  for (let m = 0; m <= months; m++) {
    let c = 0;
    for (let s = 0; s < sims; s++) if (reachedAt[s] >= 0 && reachedAt[s] <= m) c++;
    const dt = new Date(today.getFullYear(), today.getMonth() + m, 1);
    curve.push({ month: m, date: dt.toISOString().split('T')[0], pct: Math.round((c / sims) * 1000) / 10 });
  }
  return { probability, medianMonths, expectedDate, curve };
}

// Seeded PRNG (mulberry32) → deterministic, reproducible simulations.
// Same inputs always yield the same probability, so the dashboard never "flickers".
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFrom(...nums: number[]): number {
  let h = 2166136261;
  for (const n of nums) { h ^= Math.round((n || 0) * 1000); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// Standard normal via Box-Muller using a supplied uniform RNG.
function makeGauss(rng: () => number) {
  return () => {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}
function percentile(sorted: Float64Array, p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

// Monte-Carlo wealth forecast (geometric Brownian motion, monthly steps).
export function monteCarloProjection(
  start: number, expectedAnnualReturnPct: number, annualVolPct: number,
  years: number, monthlyContribution: number, sims = 600,
): ProjectionPoint[] {
  const months = Math.max(1, Math.round(years * 12));
  const muM = expectedAnnualReturnPct / 100 / 12;
  const sigmaM = (annualVolPct / 100) / Math.sqrt(12);
  const drift = muM - 0.5 * sigmaM * sigmaM; // log-drift
  const today = new Date();
  const gauss = makeGauss(mulberry32(seedFrom(start, expectedAnnualReturnPct, annualVolPct, years, monthlyContribution, sims)));

  const grid: Float64Array[] = Array.from({ length: months + 1 }, () => new Float64Array(sims));
  for (let s = 0; s < sims; s++) {
    let v = start;
    grid[0][s] = v;
    for (let m = 1; m <= months; m++) {
      v = v * Math.exp(drift + sigmaM * gauss()) + monthlyContribution;
      grid[m][s] = v;
    }
  }
  const out: ProjectionPoint[] = [];
  for (let m = 0; m <= months; m++) {
    const col = grid[m].slice().sort();
    const dt = new Date(today.getFullYear(), today.getMonth() + m, 1);
    out.push({
      month: m,
      date: dt.toISOString().split('T')[0],
      p10: Math.round(percentile(col, 0.10)),
      p50: Math.round(percentile(col, 0.50)),
      p90: Math.round(percentile(col, 0.90)),
      contributedLine: Math.round(start + monthlyContribution * m),
    });
  }
  return out;
}
