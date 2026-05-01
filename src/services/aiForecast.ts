/**
 * Simple Linear Regression to forecast the next value in a series
 */
export function linearRegression(data: number[]): number {
  const n = data.length;
  if (n < 2) return data[0] || 0;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumXX += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Forecast for next index
  return slope * n + intercept;
}

/**
 * Mock AI Analysis for sentiment and volatility
 */
export async function getAIStockAnalysis(ticker: string, history: number[]) {
  // In a real app, this would call Gemini or OpenAI
  // For now, we simulate logic based on volatility
  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance = history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / history.length;
  const stdDev = Math.sqrt(variance);
  const volatility = (stdDev / mean) * 100;

  let sentiment: 'Bullish' | 'Bearish' | 'Neutral' = 'Neutral';
  let score = 50;

  if (history[history.length - 1] > history[0]) {
    sentiment = 'Bullish';
    score = Math.min(95, 60 + volatility);
  } else {
    sentiment = 'Bearish';
    score = Math.max(5, 40 - volatility);
  }

  return {
    ticker,
    sentiment,
    sentimentScore: Math.round(score),
    volatility: volatility.toFixed(2),
    forecast7d: linearRegression(history).toFixed(2)
  };
}
