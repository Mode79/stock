import type { TechnicalProfile } from './technicalAnalysis';
import { probabilityCone } from './technicalAnalysis';
import type { FundamentalScore } from './fundamentals';
import type { BacktestResult } from './backtest';

// Legacy input shape — still accepted so existing server-side callers keep working.
export interface StockStats {
  currentPrice: number;
  rsi: number | string;
  sma50: number | string;
  support?: number | string;
  resistance?: number | string;
  high52?: number | string;
  low52?: number | string;
}

// Optional richer context for a full institutional-grade verdict.
export interface EngineContext {
  fundamentals?: FundamentalScore | null;
  weeklyTrendRegime?: TechnicalProfile['trendRegime'];
  hasBenchmark?: boolean;
  capital?: number;            // portfolio capital, for position sizing
  riskPerTradePct?: number;    // default 2%
  backtest?: BacktestResult | null;
}

export interface FactorScore {
  key: string;
  label: string;
  label_ar: string;
  score: number;        // normalized -100..100 contribution
  weight: number;       // effective weight after adjustments
  detail: string;
  detail_ar: string;
}

export interface RecommendationResult {
  // ---- Legacy fields (unchanged contract) ----
  score: number;
  recommendation: 'BUY' | 'ACCUMULATE' | 'HOLD' | 'SELL';
  recommendation_ar: 'شراء' | 'تجميع' | 'انتظار' | 'بيع';
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  sentiment_ar: 'متفائل' | 'حيادي' | 'متشائم';
  targetPrice: number;

  // ---- Professional consultant fields ----
  conviction: number;
  compositeScore: number;
  factors: FactorScore[];
  signals: string[];
  signals_ar: string[];
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  riskLevel_ar: 'منخفض' | 'معتدل' | 'مرتفع' | 'مرتفع جداً';
  entryZone: { low: number; high: number };
  stopLoss: number;
  targets: { bear: number; base: number; bull: number };
  upsidePct: number;
  riskReward: number;
  horizon: string;

  // ---- Trust / robustness layer ----
  dataConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
  dataConfidence_ar: 'عالية' | 'متوسطة' | 'منخفضة';
  confidenceReasons: string[];
  timeframeAgreement: 'ALIGNED' | 'CONFLICT' | 'NEUTRAL' | 'UNKNOWN';
  probabilityCone: { mid: number; lo68: number; hi68: number; lo90: number; hi90: number; horizonDays: number } | null;
  positionSizing: { shares: number; riskAmount: number; capitalAtRiskPct: number } | null;
  invalidation: string;
  invalidation_ar: string;
  valuation: FundamentalScore['valuation'];
  trendStrength: 'TRENDING' | 'WEAK' | 'CHOPPY' | 'UNKNOWN';
  asOf: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round2 = (v: number) => Math.round(v * 100) / 100;
const dirOf = (r?: string) => (r === 'STRONG_UP' || r === 'UP' ? 1 : r === 'STRONG_DOWN' || r === 'DOWN' ? -1 : 0);

function statsToProfile(stats: StockStats): TechnicalProfile {
  const currentPrice = Number(stats.currentPrice) || 0;
  const rsi = Number(stats.rsi) || 50;
  const sma50 = Number(stats.sma50) || currentPrice;
  const support = Number(stats.support) || Number(stats.low52) || currentPrice * 0.9;
  const resistance = Number(stats.resistance) || Number(stats.high52) || currentPrice * 1.1;
  return {
    currentPrice, bars: 0,
    sma20: sma50, sma50, sma200: 0,
    ema12: currentPrice, ema26: currentPrice,
    trendRegime: currentPrice > sma50 ? 'UP' : 'DOWN', adx: 0,
    rsi, macd: 0, macdSignal: 0, macdHistogram: 0,
    atr: currentPrice * 0.02, atrPct: 2, annualizedVol: 0, maxDrawdown: 0, beta: 1,
    bollUpper: resistance, bollLower: support, bollPercentB: 0.5, bollSqueeze: false,
    obvSlope: 0, volumeTrendPct: 0, relVolume: 1, volumeDivergence: 'NONE',
    support, resistance, pivot: (currentPrice + support + resistance) / 3,
    perfPct: 0, relStrengthPct: 0, high52: resistance, low52: support, distFromHighPct: 0,
    dailySigma: 0.02,
  };
}

export function calculateRecommendation(input: StockStats | TechnicalProfile, ctx: EngineContext = {}): RecommendationResult {
  const p: TechnicalProfile = ('trendRegime' in input && 'bars' in input)
    ? (input as TechnicalProfile)
    : statsToProfile(input as StockStats);

  const price = p.currentPrice || 0;
  const factors: FactorScore[] = [];
  const signals: string[] = [];
  const signals_ar: string[] = [];

  // ADX-adaptive weighting: trust trend in strong trends, mean-reversion in ranges.
  const trending = p.adx >= 25;
  const choppy = p.adx > 0 && p.adx < 18;
  const wTrend = 0.22 * (trending ? 1.25 : choppy ? 0.85 : 1);
  const wMom = 0.16 * (trending ? 0.7 : choppy ? 1.2 : 1);
  const wStruct = 0.13 * (trending ? 0.75 : choppy ? 1.2 : 1);

  // ---------- FACTOR: Momentum (RSI) ----------
  let momScore = 0;
  if (p.rsi < 30) { momScore = 90; signals.push(`RSI ${p.rsi.toFixed(0)} — deeply oversold, bounce likely`); signals_ar.push(`مؤشر القوة ${p.rsi.toFixed(0)} — تشبع بيعي شديد واحتمال ارتداد`); }
  else if (p.rsi < 45) { momScore = 45; }
  else if (p.rsi > 70) { momScore = -90; signals.push(`RSI ${p.rsi.toFixed(0)} — overbought, pullback risk`); signals_ar.push(`مؤشر القوة ${p.rsi.toFixed(0)} — تشبع شرائي وخطر تصحيح`); }
  else if (p.rsi > 58) { momScore = -35; }
  else momScore = 5;
  factors.push({ key: 'momentum', label: 'Momentum (RSI)', label_ar: 'الزخم', score: momScore, weight: wMom,
    detail: `RSI ${p.rsi.toFixed(1)}`, detail_ar: `مؤشر القوة ${p.rsi.toFixed(1)}` });

  // ---------- FACTOR: Trend (regime + MACD + ADX) ----------
  let trendScore = ({ STRONG_UP: 75, UP: 40, SIDEWAYS: 0, DOWN: -40, STRONG_DOWN: -75 } as any)[p.trendRegime] ?? 0;
  if (p.macdHistogram > 0 && p.macd !== 0) { trendScore += 20; signals.push('MACD above signal — momentum building'); signals_ar.push('الماكد فوق خط الإشارة — زخم صاعد'); }
  else if (p.macdHistogram < 0 && p.macd !== 0) { trendScore -= 20; signals.push('MACD below signal — bearish momentum'); signals_ar.push('الماكد تحت خط الإشارة — زخم هابط'); }
  if (trending) signals.push(`Strong trend (ADX ${p.adx.toFixed(0)}) — direction is reliable`);
  trendScore = clamp(trendScore, -100, 100);
  factors.push({ key: 'trend', label: 'Trend & MACD', label_ar: 'الاتجاه', score: trendScore, weight: wTrend,
    detail: `${p.trendRegime.replace('_', ' ').toLowerCase()}, ADX ${p.adx.toFixed(0)}`,
    detail_ar: dirOf(p.trendRegime) > 0 ? 'اتجاه صاعد' : dirOf(p.trendRegime) < 0 ? 'اتجاه هابط' : 'اتجاه عرضي' });

  // ---------- FACTOR: Price structure (S/R + Bollinger) ----------
  let structScore = 0;
  const band = p.resistance - p.support;
  if (band > 0) {
    const distToSupport = (price - p.support) / band;
    const distToResistance = (p.resistance - price) / band;
    if (distToSupport < 0.15) { structScore = 70; signals.push(`Near support EGP ${round2(p.support)} — favorable entry`); signals_ar.push(`قرب الدعم ${round2(p.support)} — منطقة شراء`); }
    else if (distToResistance < 0.15) { structScore = -70; signals.push(`Near resistance EGP ${round2(p.resistance)} — limited upside`); signals_ar.push(`قرب المقاومة ${round2(p.resistance)} — صعود محدود`); }
    else structScore = (distToResistance - distToSupport) * 40;
  }
  if (p.bollSqueeze) signals.push('Bollinger squeeze — volatility compressed, breakout likely');
  if (p.bollPercentB < 0.05) { structScore += 10; signals.push('Price at lower Bollinger band — stretched down'); }
  else if (p.bollPercentB > 0.95) { structScore -= 10; signals.push('Price at upper Bollinger band — stretched up'); }
  factors.push({ key: 'structure', label: 'Price Structure', label_ar: 'البنية السعرية', score: clamp(structScore, -100, 100), weight: wStruct,
    detail: `S ${round2(p.support)} / R ${round2(p.resistance)}`, detail_ar: `دعم ${round2(p.support)} / مقاومة ${round2(p.resistance)}` });

  // ---------- FACTOR: Institutional flow (OBV + volume + divergence) ----------
  let flowScore = p.obvSlope * 70;
  if (p.volumeTrendPct > 25) { flowScore += 20; signals.push(`Volume rising ${p.volumeTrendPct.toFixed(0)}% — accumulation`); signals_ar.push(`ارتفاع حجم التداول ${p.volumeTrendPct.toFixed(0)}% — تجميع`); }
  else if (p.volumeTrendPct < -25) { flowScore -= 10; }
  if (p.relVolume > 1.8) { flowScore += 10; signals.push(`Volume spike ${p.relVolume.toFixed(1)}x average — strong interest`); signals_ar.push(`قفزة في حجم التداول ${p.relVolume.toFixed(1)}x`); }
  if (p.volumeDivergence === 'BEARISH') { flowScore -= 25; signals.push('Bearish divergence — price up but volume fading'); signals_ar.push('تباعد سلبي — السعر يرتفع وحجم التداول يتراجع'); }
  else if (p.volumeDivergence === 'BULLISH') { flowScore += 20; signals.push('Bullish divergence — selling on falling volume'); signals_ar.push('تباعد إيجابي — بيع بحجم متناقص'); }
  flowScore = clamp(flowScore, -100, 100);
  factors.push({ key: 'flow', label: 'Institutional Flow', label_ar: 'تدفق المؤسسات', score: flowScore, weight: 0.16,
    detail: `OBV ${p.obvSlope >= 0 ? '↑' : '↓'}, vol ${p.volumeTrendPct >= 0 ? '+' : ''}${p.volumeTrendPct.toFixed(0)}%`,
    detail_ar: p.obvSlope >= 0 ? 'تدفق إيجابي' : 'تدفق سلبي' });

  // ---------- FACTOR: Relative strength vs benchmark ----------
  if (ctx.hasBenchmark) {
    const rs = clamp(p.relStrengthPct * 4, -100, 100);
    if (p.relStrengthPct > 5) { signals.push(`Outperforming market by ${p.relStrengthPct.toFixed(0)}% — leadership`); signals_ar.push(`يتفوق على السوق بـ ${p.relStrengthPct.toFixed(0)}%`); }
    else if (p.relStrengthPct < -5) { signals.push(`Lagging market by ${Math.abs(p.relStrengthPct).toFixed(0)}% — laggard`); signals_ar.push(`أداء أقل من السوق بـ ${Math.abs(p.relStrengthPct).toFixed(0)}%`); }
    factors.push({ key: 'relstrength', label: 'Relative Strength', label_ar: 'القوة النسبية', score: rs, weight: 0.10,
      detail: `${p.relStrengthPct >= 0 ? '+' : ''}${p.relStrengthPct.toFixed(1)}% vs index`,
      detail_ar: `${p.relStrengthPct >= 0 ? '+' : ''}${p.relStrengthPct.toFixed(1)}% مقابل المؤشر` });
  }

  // ---------- FACTOR: Fundamentals ----------
  if (ctx.fundamentals?.available) {
    const f = ctx.fundamentals;
    f.flags.forEach(fl => signals.push(fl));
    f.flags_ar.forEach(fl => signals_ar.push(fl));
    factors.push({ key: 'fundamentals', label: 'Fundamentals', label_ar: 'الأساسيات', score: f.score, weight: 0.16 * Math.max(0.4, f.coverage),
      detail: `${f.valuation.toLowerCase()}, ${f.quality.toLowerCase()} quality`, detail_ar: f.valuation_ar });
  }

  // ---------- FACTOR: Risk drag ----------
  let riskScore = 0;
  if (p.annualizedVol > 60) riskScore -= 30;
  else if (p.annualizedVol > 40) riskScore -= 15;
  else if (p.annualizedVol > 0 && p.annualizedVol < 25) riskScore += 10;
  if (p.maxDrawdown > 35) riskScore -= 15;
  factors.push({ key: 'risk', label: 'Risk Profile', label_ar: 'المخاطر', score: clamp(riskScore, -100, 100), weight: 0.10,
    detail: `Vol ${p.annualizedVol.toFixed(0)}%, DD ${p.maxDrawdown.toFixed(0)}%`, detail_ar: `التذبذب ${p.annualizedVol.toFixed(0)}%` });

  // ---------- Composite ----------
  const totalWeight = factors.reduce((a, f) => a + f.weight, 0) || 1;
  const compositeScore = clamp(factors.reduce((a, f) => a + f.score * f.weight, 0) / totalWeight, -100, 100);
  const legacyScore = Math.round(compositeScore / 12.5);

  // ---------- Recommendation ----------
  let recommendation: RecommendationResult['recommendation'];
  let recommendation_ar: RecommendationResult['recommendation_ar'];
  let sentiment: RecommendationResult['sentiment'];
  let sentiment_ar: RecommendationResult['sentiment_ar'];
  if (compositeScore >= 45) { recommendation = 'BUY'; recommendation_ar = 'شراء'; sentiment = 'BULLISH'; sentiment_ar = 'متفائل'; }
  else if (compositeScore >= 15) { recommendation = 'ACCUMULATE'; recommendation_ar = 'تجميع'; sentiment = 'BULLISH'; sentiment_ar = 'متفائل'; }
  else if (compositeScore >= -20) { recommendation = 'HOLD'; recommendation_ar = 'انتظار'; sentiment = 'NEUTRAL'; sentiment_ar = 'حيادي'; }
  else { recommendation = 'SELL'; recommendation_ar = 'بيع'; sentiment = 'BEARISH'; sentiment_ar = 'متشائم'; }

  // ---------- Multi-timeframe agreement ----------
  let timeframeAgreement: RecommendationResult['timeframeAgreement'] = 'UNKNOWN';
  if (ctx.weeklyTrendRegime) {
    const d = dirOf(p.trendRegime), w = dirOf(ctx.weeklyTrendRegime);
    if (d === 0 || w === 0) timeframeAgreement = 'NEUTRAL';
    else if (d === w) { timeframeAgreement = 'ALIGNED'; signals.push('Daily & weekly trends agree — higher conviction'); signals_ar.push('الاتجاه اليومي والأسبوعي متفقان'); }
    else { timeframeAgreement = 'CONFLICT'; signals.push('Daily & weekly trends conflict — treat as short-term only'); signals_ar.push('تعارض بين الاتجاه اليومي والأسبوعي'); }
  }

  // ---------- Conviction ----------
  const dir = Math.sign(compositeScore);
  const agreement = dir === 0 ? 0.5 : factors.filter(f => Math.sign(f.score) === dir).length / factors.length;
  let conviction = 40 + Math.abs(compositeScore) * 0.42 + agreement * 18;
  if (timeframeAgreement === 'ALIGNED') conviction += 8;
  if (timeframeAgreement === 'CONFLICT') conviction -= 12;
  if (ctx.fundamentals?.available && Math.sign(ctx.fundamentals.score) === dir) conviction += 5;
  conviction = Math.round(clamp(conviction, 0, 99));

  // ---------- Risk level ----------
  const vol = p.annualizedVol || p.atrPct * 16;
  let riskLevel: RecommendationResult['riskLevel'];
  let riskLevel_ar: RecommendationResult['riskLevel_ar'];
  if (vol > 60) { riskLevel = 'EXTREME'; riskLevel_ar = 'مرتفع جداً'; }
  else if (vol > 40) { riskLevel = 'HIGH'; riskLevel_ar = 'مرتفع'; }
  else if (vol > 25) { riskLevel = 'MODERATE'; riskLevel_ar = 'معتدل'; }
  else { riskLevel = 'LOW'; riskLevel_ar = 'منخفض'; }

  // ---------- Trade levels ----------
  const atrVal = p.atr > 0 ? p.atr : price * 0.02;
  const entryZone = { low: round2(Math.max(p.support, price - atrVal)), high: round2(Math.min(price + atrVal * 0.5, price)) };
  const stopLoss = round2(Math.min(p.support * 0.985, price - atrVal * 2));

  let base: number;
  if (recommendation === 'BUY') base = Math.max(p.resistance, price + atrVal * 4);
  else if (recommendation === 'ACCUMULATE') base = Math.max(p.resistance * 0.97, price + atrVal * 2.5);
  else if (recommendation === 'HOLD') base = price + atrVal * 1.2;
  else base = price - atrVal * 1.5;
  const bull = round2(Math.max(base * 1.06, p.resistance * 1.03, price + atrVal * 6));
  const bear = round2(Math.min(stopLoss * 1.01, price - atrVal * 1.5, p.support));
  base = round2(base);

  const upsidePct = price > 0 ? round2(((base - price) / price) * 100) : 0;
  const downsideRisk = Math.max(0.01, price - stopLoss);
  const riskReward = round2(Math.max(0, base - price) / downsideRisk);
  const horizon = recommendation === 'BUY' || recommendation === 'ACCUMULATE' ? '3–6 months'
    : recommendation === 'HOLD' ? '1–3 months (review)' : 'Reduce on strength';

  // ---------- Probability cone ----------
  let cone: RecommendationResult['probabilityCone'] = null;
  if (p.dailySigma > 0) {
    const horizonDays = 63; // ~3 trading months
    // Honest statistical cone: a pure-volatility random walk centred on spot.
    // No invented drift — the band reflects only how far price could wander.
    cone = probabilityCone(price, p.dailySigma, horizonDays, 0);
  }

  // ---------- Position sizing ----------
  let positionSizing: RecommendationResult['positionSizing'] = null;
  if (ctx.capital && ctx.capital > 0 && stopLoss < price) {
    const riskPct = ctx.riskPerTradePct ?? 2;
    const riskAmount = ctx.capital * (riskPct / 100);
    const perShareRisk = price - stopLoss;
    const shares = perShareRisk > 0 ? Math.floor(riskAmount / perShareRisk) : 0;
    positionSizing = { shares, riskAmount: round2(riskAmount), capitalAtRiskPct: riskPct };
  }

  // ---------- Data confidence ----------
  const confidenceReasons: string[] = [];
  let confScore = 0;
  if (p.bars >= 120) { confScore += 2; } else if (p.bars >= 60) { confScore += 1; } else { confidenceReasons.push('Limited price history'); }
  if (ctx.fundamentals?.available) { confScore += 1; confidenceReasons.push('Real fundamentals included'); } else { confidenceReasons.push('No fundamental data'); }
  if (agreement >= 0.7) { confScore += 1; confidenceReasons.push('Factors strongly agree'); } else if (agreement < 0.5) { confidenceReasons.push('Factors are mixed'); }
  if (timeframeAgreement === 'ALIGNED') { confScore += 1; confidenceReasons.push('Multi-timeframe aligned'); }
  if (timeframeAgreement === 'CONFLICT') { confScore -= 1; }
  if (ctx.backtest?.reliable) { confScore += 1; confidenceReasons.push(`Backtest: ${ctx.backtest.winRate}% hit-rate`); }
  const dataConfidence = confScore >= 4 ? 'HIGH' : confScore >= 2 ? 'MEDIUM' : 'LOW';
  const dataConfidence_ar = dataConfidence === 'HIGH' ? 'عالية' : dataConfidence === 'MEDIUM' ? 'متوسطة' : 'منخفضة';

  const trendStrength: RecommendationResult['trendStrength'] = p.adx === 0 ? 'UNKNOWN' : p.adx >= 25 ? 'TRENDING' : p.adx < 18 ? 'CHOPPY' : 'WEAK';

  const invalidation = `Thesis fails on a close below EGP ${stopLoss} (breaks support / 2×ATR). ${timeframeAgreement === 'CONFLICT' ? 'Weekly trend disagrees — keep it short-term.' : ''}`.trim();
  const invalidation_ar = `تُلغى الفكرة عند الإغلاق دون ${stopLoss} (كسر الدعم).`;

  return {
    score: legacyScore,
    recommendation, recommendation_ar, sentiment, sentiment_ar,
    targetPrice: base,
    conviction, compositeScore: round2(compositeScore),
    factors, signals: signals.slice(0, 8), signals_ar: signals_ar.slice(0, 8),
    riskLevel, riskLevel_ar,
    entryZone, stopLoss,
    targets: { bear, base, bull },
    upsidePct, riskReward, horizon,
    dataConfidence, dataConfidence_ar, confidenceReasons,
    timeframeAgreement,
    probabilityCone: cone,
    positionSizing,
    invalidation, invalidation_ar,
    valuation: ctx.fundamentals?.valuation ?? 'UNKNOWN',
    trendStrength,
    asOf: new Date().toISOString().split('T')[0],
  };
}
