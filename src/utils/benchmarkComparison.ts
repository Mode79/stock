// Benchmark comparison: what would the same deposits/withdrawals have been worth
// if put into gold or held as USD cash instead of the actual stock portfolio.
// Mirrors the date-axis/forward-fill approach used in wealthProjection.ts's
// reconstructNetWorth, and reuses the risk/return primitives from portfolioMetrics.ts.

import { dailyReturns, stdev } from './portfolioMetrics';

export interface PricePoint { date: string; close: number; }
export interface AssetTrajectoryPoint { date: string; contributed: number; value: number; }
export interface AssetSummary { invested: number; withdrawn: number; terminalValue: number; profitEGP: number; returnPct: number | null; }

const fwdFill = (dates: string[], map: Map<string, number>): number[] => {
  const out: number[] = []; let last = 0;
  for (const d of dates) { const v = map.get(d); if (v != null) last = v; out.push(last); }
  return out;
};

// Combine a USD-denominated series with an FX (EGP per USD) series into an
// EGP-denominated price series, forward-filled onto their shared date axis.
export function toEGPSeries(usdSeries: PricePoint[], fxSeries: PricePoint[]): PricePoint[] {
  if (usdSeries.length === 0 || fxSeries.length === 0) return [];
  const dateSet = new Set<string>();
  usdSeries.forEach(p => dateSet.add(p.date.split('T')[0]));
  fxSeries.forEach(p => dateSet.add(p.date.split('T')[0]));
  const dates = [...dateSet].sort();

  const usdMap = new Map<string, number>(); usdSeries.forEach(p => usdMap.set(p.date.split('T')[0], p.close));
  const fxMap = new Map<string, number>(); fxSeries.forEach(p => fxMap.set(p.date.split('T')[0], p.close));
  const usdFilled = fwdFill(dates, usdMap);
  const fxFilled = fwdFill(dates, fxMap);

  return dates
    .map((d, i) => ({ date: d, close: usdFilled[i] * fxFilled[i] }))
    .filter(p => p.close > 0);
}

// Simulate: every Deposit fully buys this asset at that day's price; every
// Withdraw sells that EGP amount of the asset at that day's price. Buy/Sell/
// Dividend transactions are ignored — they're specific to the real stock book.
export function simulateAssetTrajectory(transactions: any[], priceSeriesEGP: PricePoint[]): AssetTrajectoryPoint[] {
  const flows = [...transactions]
    .filter(t => t.type === 'Deposit' || t.type === 'Withdraw')
    .sort((a, b) => a.date.localeCompare(b.date));
  if (flows.length === 0 || priceSeriesEGP.length === 0) return [];

  const priceMap = new Map<string, number>();
  priceSeriesEGP.forEach(p => priceMap.set(p.date.split('T')[0], p.close));
  const priceDates = priceSeriesEGP.map(p => p.date.split('T')[0]).sort();

  // Nearest available price on/after a given date (price series may not have
  // a point on the exact transaction date, e.g. weekends/holidays).
  const priceOnOrAfter = (date: string): number | null => {
    for (const d of priceDates) if (d >= date) return priceMap.get(d)!;
    return priceDates.length ? priceMap.get(priceDates[priceDates.length - 1])! : null;
  };

  const firstDate = flows[0].date;
  const dateSet = new Set<string>();
  priceDates.forEach(d => { if (d >= firstDate) dateSet.add(d); });
  flows.forEach(t => { if (t.date >= firstDate) dateSet.add(t.date); });
  const dates = [...dateSet].sort();
  if (dates.length === 0) return [];

  const filledPrice = fwdFill(dates, priceMap);

  return dates.map((d, i) => {
    let units = 0, contributed = 0;
    for (const t of flows) {
      if (t.date > d) break;
      const px = priceOnOrAfter(t.date);
      if (!px) continue;
      if (t.type === 'Deposit') { units += t.price / px; contributed += t.price; }
      else if (t.type === 'Withdraw') { units -= t.price / px; contributed -= t.price; }
    }
    const value = units * filledPrice[i];
    return { date: d, contributed: Math.round(contributed), value: Math.round(value) };
  });
}

// Annualized growth rate between two price points, using the actual elapsed time.
export function cagr(startPrice: number, endPrice: number, startDate: string, endDate: string): number | null {
  if (!startPrice || !endPrice) return null;
  const years = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (365 * 86400000);
  if (years <= 0) return null;
  return Math.pow(endPrice / startPrice, 1 / years) - 1;
}

// Annualized volatility (%) from a price series, using the same method as portfolioRisk.
export function annualizedVolPct(series: PricePoint[]): number {
  const closes = series.map(p => p.close);
  if (closes.length < 20) return 0;
  return Math.round(stdev(dailyReturns(closes)) * Math.sqrt(252) * 10000) / 100;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

// invested/returned/profit summary for one leg, matching the "returned + terminal
// − invested" logic already proven in portfolioMetrics.ts's totalReturnOnCapital.
export function summarizeLeg(invested: number, withdrawn: number, terminalValue: number): AssetSummary {
  const profitEGP = Math.round((withdrawn + terminalValue) - invested);
  const returnPct = invested > 0 ? r2((profitEGP / invested) * 100) : null;
  return { invested: Math.round(invested), withdrawn: Math.round(withdrawn), terminalValue: Math.round(terminalValue), profitEGP, returnPct };
}

export interface BenchmarkSummary {
  stocks: AssetSummary;
  gold: AssetSummary;
  usd: AssetSummary;
  deltaGoldEGP: number;
  deltaUsdEGP: number;
  deltaGoldPct: number | null;
  deltaUsdPct: number | null;
}

// Merge several {date, value} series (each on its own trading-day axis, e.g.
// EGX vs. gold/FX calendars) onto one shared, forward-filled date axis for charting.
export function mergeTrajectories(
  series: { key: string; points: { date: string; value: number }[] }[],
): Record<string, string | number>[] {
  const dateSet = new Set<string>();
  series.forEach(s => s.points.forEach(p => dateSet.add(p.date)));
  const dates = [...dateSet].sort();
  const maps = series.map(s => new Map(s.points.map(p => [p.date, p.value])));
  const filled = series.map((_, i) => fwdFill(dates, maps[i]));

  return dates.map((d, i) => {
    const row: Record<string, string | number> = { date: d };
    series.forEach((s, si) => { row[s.key] = filled[si][i]; });
    return row;
  });
}

export function computeBenchmarkSummary(
  transactions: any[],
  stockTerminalValue: number,
  goldTrajectory: AssetTrajectoryPoint[],
  usdTrajectory: AssetTrajectoryPoint[],
): BenchmarkSummary {
  let deposited = 0, withdrawn = 0;
  transactions.forEach(t => {
    if (t.type === 'Deposit') deposited += t.price;
    else if (t.type === 'Withdraw') withdrawn += t.price;
  });

  // stockTerminalValue (equity + walletBalance) already includes any dividend
  // cash that hasn't been withdrawn, so dividends are NOT added again here.
  const stocks = summarizeLeg(deposited, withdrawn, stockTerminalValue);
  const goldEnd = goldTrajectory.length ? goldTrajectory[goldTrajectory.length - 1].value : 0;
  const usdEnd = usdTrajectory.length ? usdTrajectory[usdTrajectory.length - 1].value : 0;
  const gold = summarizeLeg(deposited, withdrawn, goldEnd);
  const usd = summarizeLeg(deposited, withdrawn, usdEnd);

  return {
    stocks, gold, usd,
    deltaGoldEGP: stocks.profitEGP - gold.profitEGP,
    deltaUsdEGP: stocks.profitEGP - usd.profitEGP,
    deltaGoldPct: stocks.returnPct !== null && gold.returnPct !== null ? r2(stocks.returnPct - gold.returnPct) : null,
    deltaUsdPct: stocks.returnPct !== null && usd.returnPct !== null ? r2(stocks.returnPct - usd.returnPct) : null,
  };
}
