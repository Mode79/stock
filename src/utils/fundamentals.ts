// Fundamental data + valuation scoring.
// Data comes from the TradingView scanner (real EGX figures). Any field may be
// null when the exchange/company does not report it — we NEVER fabricate values
// and we scale confidence by how much real data is actually present.

export interface FundamentalData {
  ticker: string;
  pe: number | null;            // price / earnings (trailing)
  roe: number | null;           // return on equity, %
  debtEquity: number | null;    // debt / equity
  eps: number | null;           // earnings per share (trailing)
  marketCap: number | null;
  dividendYield: number | null; // %
  sector: string | null;
}

export interface FundamentalScore {
  available: boolean;
  coverage: number;             // 0..1 fraction of metrics present
  score: number;                // -100..100 (only meaningful if available)
  valuation: 'UNDERVALUED' | 'FAIR' | 'EXPENSIVE' | 'UNKNOWN';
  valuation_ar: string;
  quality: 'STRONG' | 'AVERAGE' | 'WEAK' | 'UNKNOWN';
  flags: string[];
  flags_ar: string[];
}

const n = (v: any): number | null => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));

export function parseFundamentals(ticker: string, row: any[]): FundamentalData {
  // Column order mirrors the /api/fundamentals request in vite.config.ts.
  // [name, close, pe, roe, debtEquity, eps, marketCap, dividendYield, sector]
  return {
    ticker,
    pe: n(row?.[2]),
    roe: n(row?.[3]),
    debtEquity: n(row?.[4]),
    eps: n(row?.[5]),
    marketCap: n(row?.[6]),
    dividendYield: n(row?.[7]),
    sector: row?.[8] ?? null,
  };
}

export function scoreFundamentals(f?: FundamentalData | null): FundamentalScore {
  const empty: FundamentalScore = {
    available: false, coverage: 0, score: 0,
    valuation: 'UNKNOWN', valuation_ar: 'غير معروف',
    quality: 'UNKNOWN', flags: [], flags_ar: [],
  };
  if (!f) return empty;

  const metrics = [f.pe, f.roe, f.debtEquity, f.eps, f.dividendYield];
  const present = metrics.filter(m => m !== null).length;
  if (present === 0) return empty;

  let score = 0, weightUsed = 0;
  const flags: string[] = [], flags_ar: string[] = [];

  // P/E — valuation (weight 35)
  if (f.pe !== null) {
    weightUsed += 35;
    if (f.pe <= 0) { score += -10; flags.push(`Negative earnings (P/E ${f.pe.toFixed(1)}) — unprofitable`); flags_ar.push('أرباح سالبة — الشركة خاسرة'); }
    else if (f.pe < 8) { score += 35; flags.push(`Low P/E ${f.pe.toFixed(1)} — cheaply valued`); flags_ar.push(`مكرر ربحية منخفض ${f.pe.toFixed(1)} — تقييم رخيص`); }
    else if (f.pe < 15) { score += 15; }
    else if (f.pe < 25) { score += -5; }
    else { score += -30; flags.push(`High P/E ${f.pe.toFixed(1)} — richly valued`); flags_ar.push(`مكرر ربحية مرتفع ${f.pe.toFixed(1)} — تقييم مرتفع`); }
  }

  // ROE — profitability quality (weight 25)
  if (f.roe !== null) {
    weightUsed += 25;
    if (f.roe >= 20) { score += 25; flags.push(`Strong ROE ${f.roe.toFixed(0)}% — efficient, profitable`); flags_ar.push(`عائد على حقوق الملكية قوي ${f.roe.toFixed(0)}%`); }
    else if (f.roe >= 10) { score += 12; }
    else if (f.roe >= 0) { score += -5; }
    else { score += -25; flags.push(`Negative ROE ${f.roe.toFixed(0)}% — destroying capital`); flags_ar.push(`عائد سالب على حقوق الملكية`); }
  }

  // Debt/Equity — balance-sheet risk (weight 25)
  if (f.debtEquity !== null) {
    weightUsed += 25;
    if (f.debtEquity < 0.5) { score += 20; flags.push(`Low debt (D/E ${f.debtEquity.toFixed(2)}) — solid balance sheet`); flags_ar.push(`ديون منخفضة — ميزانية قوية`); }
    else if (f.debtEquity < 1) { score += 5; }
    else if (f.debtEquity < 2) { score += -10; }
    else { score += -25; flags.push(`High debt (D/E ${f.debtEquity.toFixed(2)}) — leverage risk`); flags_ar.push(`ديون مرتفعة — مخاطر رافعة مالية`); }
  }

  // Dividend yield — income (weight 15)
  if (f.dividendYield !== null) {
    weightUsed += 15;
    if (f.dividendYield >= 5) { score += 15; flags.push(`High dividend ${f.dividendYield.toFixed(1)}% — income cushion`); flags_ar.push(`توزيعات مرتفعة ${f.dividendYield.toFixed(1)}%`); }
    else if (f.dividendYield >= 2) { score += 7; }
  }

  const coverage = present / metrics.length;
  // Normalize to -100..100 over the weight actually evaluated.
  const normalized = weightUsed > 0 ? Math.max(-100, Math.min(100, (score / weightUsed) * 100)) : 0;

  // Valuation verdict (P/E-led, ROE-adjusted)
  let valuation: FundamentalScore['valuation'] = 'UNKNOWN';
  let valuation_ar = 'غير معروف';
  if (f.pe !== null && f.pe > 0) {
    if (f.pe < 10 && (f.roe === null || f.roe >= 8)) { valuation = 'UNDERVALUED'; valuation_ar = 'مقوّم بأقل من قيمته'; }
    else if (f.pe > 22) { valuation = 'EXPENSIVE'; valuation_ar = 'مرتفع التقييم'; }
    else { valuation = 'FAIR'; valuation_ar = 'تقييم عادل'; }
  }

  // Quality verdict (ROE + debt)
  let quality: FundamentalScore['quality'] = 'UNKNOWN';
  if (f.roe !== null || f.debtEquity !== null) {
    const roeOk = f.roe === null ? 0 : (f.roe >= 15 ? 1 : f.roe >= 5 ? 0 : -1);
    const debtOk = f.debtEquity === null ? 0 : (f.debtEquity < 0.7 ? 1 : f.debtEquity < 1.5 ? 0 : -1);
    const q = roeOk + debtOk;
    quality = q >= 1 ? 'STRONG' : q <= -1 ? 'WEAK' : 'AVERAGE';
  }

  return {
    available: true,
    coverage,
    score: normalized,
    valuation, valuation_ar,
    quality,
    flags: flags.slice(0, 4),
    flags_ar: flags_ar.slice(0, 4),
  };
}
