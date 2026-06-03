export interface StockStats {
  currentPrice: number;
  rsi: number | string;
  sma50: number | string;
  support?: number | string;
  resistance?: number | string;
  high52?: number | string;
  low52?: number | string;
}

export interface RecommendationResult {
  score: number;
  recommendation: 'BUY' | 'ACCUMULATE' | 'HOLD' | 'SELL';
  recommendation_ar: 'شراء' | 'تجميع' | 'انتظار' | 'بيع';
  sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  sentiment_ar: 'متفائل' | 'حيادي' | 'متشائم';
  targetPrice: number;
}

export function calculateRecommendation(stats: StockStats): RecommendationResult {
  const currentPrice = Number(stats.currentPrice) || 0;
  const rsi = Number(stats.rsi) || 50;
  const sma50 = Number(stats.sma50) || currentPrice;
  const support = Number(stats.support) || Number(stats.low52) || (currentPrice * 0.9);
  const resistance = Number(stats.resistance) || Number(stats.high52) || (currentPrice * 1.1);

  let score = 0;

  // 1. RSI (Momentum) Rule
  if (rsi < 30) {
    score += 4;       // Highly Oversold (Strong Buy signal)
  } else if (rsi < 45) {
    score += 2;       // Mildly Oversold (Accumulate signal)
  } else if (rsi > 70) {
    score -= 4;       // Highly Overbought (Strong Sell signal)
  } else if (rsi > 55) {
    score -= 1;       // Mildly Overbought (Caution/Light Bearish)
  }

  // 2. Trend (SMA50) Rule
  if (currentPrice > sma50) {
    score += 2;       // Price in uptrend (Bullish)
  } else {
    score -= 2;       // Price in downtrend (Bearish)
  }

  // 3. Support/Resistance Proximity Rule
  const range = resistance - support;
  if (range > 0) {
    const distToSupport = currentPrice - support;
    const distToResistance = resistance - currentPrice;

    if (distToSupport < range * 0.15) {
      score += 2;     // Near Support floor (Buy zone)
    } else if (distToResistance < range * 0.15) {
      score -= 2;     // Near Resistance ceiling (Sell zone)
    }
  }

  // 4. Map score to Recommendation and Sentiment
  let recommendation: 'BUY' | 'ACCUMULATE' | 'HOLD' | 'SELL';
  let recommendation_ar: 'شراء' | 'تجميع' | 'انتظار' | 'بيع';
  let sentiment: 'BULLISH' | 'NEUTRAL' | 'BEARISH';
  let sentiment_ar: 'متفائل' | 'حيادي' | 'متشائم';

  if (score >= 4) {
    recommendation = 'BUY';
    recommendation_ar = 'شراء';
    sentiment = 'BULLISH';
    sentiment_ar = 'متفائل';
  } else if (score >= 1) {
    recommendation = 'ACCUMULATE';
    recommendation_ar = 'تجميع';
    sentiment = 'BULLISH';
    sentiment_ar = 'متفائل';
  } else if (score >= -2) {
    recommendation = 'HOLD';
    recommendation_ar = 'انتظار';
    sentiment = 'NEUTRAL';
    sentiment_ar = 'حيادي';
  } else {
    recommendation = 'SELL';
    recommendation_ar = 'بيع';
    sentiment = 'BEARISH';
    sentiment_ar = 'متشائم';
  }

  // 5. Calculate target price programmatically
  let targetPrice = currentPrice * 1.1;
  if (recommendation === 'BUY') {
    targetPrice = Math.max(resistance, currentPrice * 1.15);
  } else if (recommendation === 'ACCUMULATE') {
    targetPrice = Math.max(resistance * 0.95, currentPrice * 1.1);
  } else if (recommendation === 'HOLD') {
    targetPrice = currentPrice * 1.05;
  } else {
    targetPrice = currentPrice * 0.95;
  }

  targetPrice = Math.round(targetPrice * 100) / 100;

  return {
    score,
    recommendation,
    recommendation_ar,
    sentiment,
    sentiment_ar,
    targetPrice
  };
}
