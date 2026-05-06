import React, { useState } from 'react';
import { Info } from 'lucide-react';

export const TERMS_INFO: Record<string, { definition: string, calculation: string, benefit: string }> = {
  RSI: {
    definition: "Relative Strength Index. A momentum oscillator that measures the speed and change of price movements.",
    calculation: "100 - (100 / (1 + (Avg Gain / Avg Loss))) over 14 periods.",
    benefit: "Helps identify overbought (>70) or oversold (<30) conditions."
  },
  SMA: {
    definition: "Simple Moving Average. Smooths out price data to identify the trend direction.",
    calculation: "Sum of closing prices over 'n' periods divided by 'n'.",
    benefit: "Identifies support/resistance levels and trend reversals."
  },
  Alpha: {
    definition: "A measure of the active return on an investment compared to a market index.",
    calculation: "Portfolio Return - Benchmark (Index) Return.",
    benefit: "Shows if you are actually 'beating the market' or just following it."
  },
  Beta: {
    definition: "Measures the volatility (risk) of a stock or portfolio compared to the overall market.",
    calculation: "Covariance of Asset and Market / Variance of Market.",
    benefit: "Assesses how much an investment will swing relative to the market."
  },
  'Sharpe Ratio': {
    definition: "Measures the performance of an investment compared to a risk-free asset, after adjusting for its risk.",
    calculation: "(Mean Portfolio Return - Risk-Free Rate) / Standard Deviation.",
    benefit: "Helps you understand if your returns are due to smart strategy or excess risk."
  },
  'Max Drawdown': {
    definition: "The largest peak-to-trough decline before a new peak is achieved.",
    calculation: "(Peak Value - Trough Value) / Peak Value.",
    benefit: "Represents the worst-case scenario for losses in a given period."
  },
  Volatility: {
    definition: "The degree of variation of a trading price series over time.",
    calculation: "Standard deviation of logarithmic returns.",
    benefit: "High volatility indicates high risk but also high reward potential."
  },
  'Sentiment Score': {
    definition: "An AI-calculated score measuring the positivity or negativity of market news and social signals.",
    calculation: "Natural Language Processing (NLP) of news headlines and financial reports.",
    benefit: "Predicts short-term price momentum driven by crowd psychology."
  },
  Diversification: {
    definition: "Spreading investments across different assets or sectors to reduce exposure to any single risk.",
    calculation: "Weighted average of asset correlations.",
    benefit: "Reduces overall portfolio volatility and protects against sector-specific crashes."
  }
};

export function InfoTooltip({ term }: { term: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const info = TERMS_INFO[term];
  if (!info) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-block', marginLeft: '6px', verticalAlign: 'middle' }}>
      <button 
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--color-blue)', display: 'flex', alignItems: 'center', opacity: 0.7 }}
      >
        <Info size={14} />
      </button>
      {isOpen && (
        <div style={{ 
          position: 'absolute', 
          bottom: '100%', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          zIndex: 1000, 
          background: '#1a1b1e', 
          border: '1px solid #333', 
          borderRadius: '12px', 
          padding: '1rem',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
          minWidth: '260px',
          marginBottom: '8px',
          pointerEvents: 'none'
        }}>
          <h4 style={{ margin: '0 0 8px 0', color: 'var(--color-blue)', fontSize: '0.85rem' }}>{term}</h4>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', marginBottom: '8px' }}>{info.definition}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}><strong>Calc:</strong> {info.calculation}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-green)' }}><strong>Benefit:</strong> {info.benefit}</div>
        </div>
      )}
    </div>
  );
}
