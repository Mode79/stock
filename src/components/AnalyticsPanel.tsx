import React, { useEffect, useState } from 'react';
import { Holding } from '../types';
import { getAIStockAnalysis } from '../services/aiForecast';
import { Brain, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface AnalyticsPanelProps {
  holdings: Holding[];
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ holdings }) => {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalyses = async () => {
      setLoading(true);
      const results = await Promise.all(
        holdings.map(async (h) => {
          // Simulate price history for the forecast (last 30 days)
          // In a real app, this would be actual historical data
          const history = Array.from({ length: 30 }, (_, i) => 
            h.livePrice * (1 + (Math.random() - 0.5) * 0.1)
          );
          history.push(h.livePrice);
          return await getAIStockAnalysis(h.ticker, history);
        })
      );
      setAnalyses(results);
      setLoading(false);
    };

    if (holdings.length > 0) {
      fetchAnalyses();
    }
  }, [holdings]);

  if (loading) return <div className="card text-center py-8">Analyzing market sentiment...</div>;

  return (
    <div className="grid-cards">
      {analyses.map((analysis) => (
        <div key={analysis.ticker} className="card glass-card">
          <div className="card-header">
            <div className="flex-center gap-2">
              <Brain className="text-blue" size={18} />
              <h3 className="card-title">{analysis.ticker} AI Insight</h3>
            </div>
            <div className={`badge ${analysis.sentiment.toLowerCase()}`}>
              {analysis.sentiment === 'Bullish' ? <TrendingUp size={14} /> : 
               analysis.sentiment === 'Bearish' ? <TrendingDown size={14} /> : <Minus size={14} />}
              {analysis.sentiment}
            </div>
          </div>

          <div className="analytics-body">
            <div className="stat-item">
              <span className="text-dim">Sentiment Score</span>
              <div className="score-bar">
                <div className="score-fill" style={{ width: `${analysis.sentimentScore}%`, backgroundColor: analysis.sentimentScore > 50 ? 'var(--color-green)' : 'var(--color-red)' }}></div>
              </div>
              <span className="font-mono font-bold">{analysis.sentimentScore}/100</span>
            </div>

            <div className="grid-2 mt-4">
              <div>
                <span className="text-dim block text-xs">7D Forecast</span>
                <span className="font-mono text-blue font-bold">{analysis.forecast7d} EGP</span>
              </div>
              <div>
                <span className="text-dim block text-xs">Volatility</span>
                <span className="font-mono text-yellow font-bold">{analysis.volatility}%</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AnalyticsPanel;
