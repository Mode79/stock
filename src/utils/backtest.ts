// Lightweight historical validation of the engine's bullish setup.
// Walks the daily history, and every time a "buy-type" condition fired it
// measures the forward return over a fixed horizon. The result is an honest
// hit-rate ("setups like this were higher N days later X% of the time"),
// so the user can judge how much to trust the live signal.

import { wilderRSI, sma } from './technicalAnalysis';

export interface BacktestResult {
  samples: number;          // number of historical setups found
  winRate: number;          // % of setups that were higher after the horizon
  avgReturn: number;        // average forward return, %
  horizonDays: number;
  reliable: boolean;        // enough samples to mean anything
}

// A "bullish setup" mirrors the live engine in spirit: oversold-ish momentum
// while price holds above its medium-term trend (dip-in-uptrend).
export function backtestBullishSetup(closes: number[], horizonDays = 20): BacktestResult {
  const empty: BacktestResult = { samples: 0, winRate: 0, avgReturn: 0, horizonDays, reliable: false };
  if (!closes || closes.length < 60 + horizonDays) return empty;

  const wins: number[] = [];
  // Need 50 bars of history for SMA/RSI and `horizonDays` of forward data.
  for (let i = 50; i < closes.length - horizonDays; i++) {
    const window = closes.slice(0, i + 1);
    const rsi = wilderRSI(window.slice(-30), 14);
    const sma50 = sma(window, 50);
    const price = closes[i];
    const isSetup = rsi < 45 && price > sma50; // dip while trend intact
    if (!isSetup) continue;
    const fwd = (closes[i + horizonDays] - price) / price * 100;
    wins.push(fwd);
  }

  if (wins.length < 5) return { ...empty, samples: wins.length };
  const winRate = (wins.filter(w => w > 0).length / wins.length) * 100;
  const avgReturn = wins.reduce((a, b) => a + b, 0) / wins.length;
  return {
    samples: wins.length,
    winRate: Math.round(winRate),
    avgReturn: Math.round(avgReturn * 10) / 10,
    horizonDays,
    reliable: wins.length >= 10,
  };
}

// Pearson correlation of two daily-return series — for portfolio concentration.
export function returnCorrelation(closesA: number[], closesB: number[]): number {
  const n = Math.min(closesA.length, closesB.length);
  if (n < 5) return 0;
  const a = closesA.slice(-n), b = closesB.slice(-n);
  const ra: number[] = [], rb: number[] = [];
  for (let i = 1; i < n; i++) { ra.push((a[i] - a[i - 1]) / a[i - 1]); rb.push((b[i] - b[i - 1]) / b[i - 1]); }
  const ma = ra.reduce((x, y) => x + y, 0) / ra.length;
  const mb = rb.reduce((x, y) => x + y, 0) / rb.length;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < ra.length; i++) {
    cov += (ra[i] - ma) * (rb[i] - mb);
    va += (ra[i] - ma) ** 2; vb += (rb[i] - mb) ** 2;
  }
  return va && vb ? cov / Math.sqrt(va * vb) : 0;
}
