import React, { useState, useEffect, useRef } from 'react';
import { 
  Cell, ResponsiveContainer, Tooltip, 
  Bar, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine
} from 'recharts';
import { 
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertTriangle, 
  Wallet, DollarSign, Activity, Clock, Plus, PlusCircle, Trash2, X, Search, TrendingUp,
  BarChart2, Sparkles, Brain, Info, Target, ShieldAlert, Settings as SettingsIcon, ShieldCheck, BookOpen, Bell, Pencil,
  Coins, FilterX
} from 'lucide-react';
import { AreaChart, Area, LineChart, Line } from 'recharts';
import { InfoTooltip } from './components/InfoTooltip';
import './index.css';
import { calculateRecommendation } from './utils/recommendationEngine';
import { buildTechnicalProfile, resampleWeekly } from './utils/technicalAnalysis';
import { isEGXMarketOpen, getEGXMarketStatusText } from './utils/marketHours';
import { parseFundamentals, scoreFundamentals } from './utils/fundamentals';
import { backtestBullishSetup, returnCorrelation } from './utils/backtest';
import { WealthCenter } from './components/WealthCenter';
import { BenchmarkCenter } from './components/BenchmarkCenter';
import { SwingAdvice } from './components/SwingAdvice';
import { StockDetailModal } from './components/StockDetailModal';
import { COMPANY_META, DIVIDEND_META, type PnlExtreme, type ClosedPosition } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { xirr, buildPortfolioCashflows } from './utils/portfolioMetrics';

// Correlation clusters: group holdings that are driven by the same underlying macro variables,
// so that "7 names" doesn't hide "one macro bet". Default derived from sector; user-overridable.
const SECTOR_TO_CLUSTER: Record<string, string> = {
  'Energy': 'Energy & Petrochemicals',
  'Chemicals': 'Energy & Petrochemicals',
  'Basic Materials': 'Energy & Petrochemicals',
  'Food & Beverage': 'Consumer Staples',
  'Consumer Goods': 'Consumer Staples',
  'Pharmaceuticals': 'Healthcare & Pharma',
  'Healthcare': 'Healthcare & Pharma',
  'Electrical': 'Industrials',
  'Automotive': 'Industrials',
  'Construction': 'Industrials',
  'Logistics': 'Industrials',
  'Textiles': 'Textiles',
  'Banking': 'Financials',
  'Financial Services': 'Financials',
  'Fintech': 'Financials',
  'Real Estate': 'Real Estate',
  'Telecommunications': 'Telecom & Utilities',
  'Education': 'Other',
};
const clusterFor = (sector: string | undefined, override?: string) =>
  override || SECTOR_TO_CLUSTER[sector || ''] || 'Other';
const CLUSTER_COLORS = ['#3b82f6', '#f59e0b', '#22c55e', '#ef4444', '#a855f7', '#14b8a6', '#ec4899', '#94a3b8'];
const CLUSTER_OPTIONS = Array.from(new Set(Object.values(SECTOR_TO_CLUSTER))).sort();

// Concentration & Exposure — surfaces the single macro bet hidden behind several names.
// Lives in the Portfolio Health tab; the Portfolio tab is kept for real-time data only.
function ConcentrationPanel({ holdings, clusterMap, setClusterMap, cpiRate, setCpiRate, cashYield, setCashYield }: {
  holdings: { ticker: string; sector: string; shares: number; livePrice: number }[];
  clusterMap: Record<string, string>;
  setClusterMap: (v: Record<string, string>) => void;
  cpiRate: number; setCpiRate: (v: number) => void;
  cashYield: number; setCashYield: (v: number) => void;
}) {
  if (holdings.length === 0) return null;
  const rows = holdings.map(h => {
    // COMPANY_META has consistent, curated sectors; the live feed's sector
    // strings vary and often don't map. Prefer meta, fall back to live.
    const metaSector = COMPANY_META[h.ticker]?.sector || h.sector;
    return {
      ticker: h.ticker, sector: metaSector,
      cluster: clusterFor(metaSector, clusterMap[h.ticker]),
      mv: h.shares * h.livePrice,
    };
  });
  const equity = rows.reduce((s, r) => s + r.mv, 0);
  if (equity <= 0) return null;
  const byCluster: Record<string, { mv: number; tickers: string[] }> = {};
  rows.forEach(r => {
    if (!byCluster[r.cluster]) byCluster[r.cluster] = { mv: 0, tickers: [] };
    byCluster[r.cluster].mv += r.mv;
    byCluster[r.cluster].tickers.push(r.ticker);
  });
  const clusters = Object.entries(byCluster)
    .map(([name, v]) => ({ name, ...v, pct: (v.mv / equity) * 100 }))
    .sort((a, b) => b.mv - a.mv);
  const WARN = 40;
  const topCluster = clusters[0];
  return (
    <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
        <h3 className="card-title" style={{ fontSize: '1.05rem', margin: 0 }}>Concentration & Exposure</h3>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          Single market: <strong style={{ color: '#f97316' }}>100% EGX</strong> · Single currency: <strong style={{ color: '#f97316' }}>100% EGP</strong>
        </div>
      </div>
      {/* stacked exposure bar */}
      <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', marginBottom: '10px' }}>
        {clusters.map((c, i) => (
          <div key={c.name} title={`${c.name}: ${c.pct.toFixed(1)}%`} style={{ width: `${c.pct}%`, background: CLUSTER_COLORS[i % CLUSTER_COLORS.length] }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {clusters.map((c, i) => (
          <div key={c.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: CLUSTER_COLORS[i % CLUSTER_COLORS.length], display: 'inline-block' }} />
              <strong>{c.name}</strong>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>({c.tickers.join(', ')})</span>
            </span>
            <strong className="mono" style={{ color: c.pct >= WARN ? '#f97316' : 'var(--text-primary)' }}>
              {c.pct.toFixed(1)}%{c.pct >= WARN ? ' ⚠' : ''}
            </strong>
          </div>
        ))}
      </div>
      {topCluster && topCluster.pct >= WARN && (
        <div style={{ fontSize: '0.72rem', color: '#f97316', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)' }}>
          ⚠ {topCluster.name} is {topCluster.pct.toFixed(0)}% of equity ({topCluster.tickers.join(', ')}) — these move on the same drivers. This is one bet, not diversification.
        </div>
      )}
      {/* Real-value assumptions (used by the Wallet idle-cash estimate) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
        <span style={{ fontWeight: 600 }}>Assumptions:</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          Inflation (CPI)
          <input type="number" step="0.1" value={cpiRate}
            onChange={e => setCpiRate(parseFloat(e.target.value) || 0)}
            style={{ width: '58px', padding: '2px 5px', background: '#1e2130', color: '#e2e8f0', border: '1px solid var(--border-color)', borderRadius: '4px' }} />%
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          Cash yield
          <input type="number" step="0.1" value={cashYield}
            onChange={e => setCashYield(parseFloat(e.target.value) || 0)}
            style={{ width: '58px', padding: '2px 5px', background: '#1e2130', color: '#e2e8f0', border: '1px solid var(--border-color)', borderRadius: '4px' }} />%
        </label>
      </div>
      {/* Per-ticker cluster override */}
      <details style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
        <summary style={{ cursor: 'pointer', userSelect: 'none' }}>Adjust clusters</summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px', marginTop: '8px' }}>
          {rows.map(r => (
            <div key={r.ticker} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <strong style={{ minWidth: '42px' }}>{r.ticker}</strong>
              <select value={r.cluster}
                onChange={e => setClusterMap({ ...clusterMap, [r.ticker]: e.target.value })}
                style={{ flex: 1, padding: '2px 4px', background: '#1e2130', color: '#e2e8f0', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.72rem' }}>
                {Array.from(new Set([...CLUSTER_OPTIONS, r.cluster, 'Other'])).sort().map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

// --- TYPES ---
type TransactionType = 'Buy' | 'Sell' | 'Deposit' | 'Withdraw' | 'Dividend' | 'StockDividend';

interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  ticker?: string;
  quantity?: number;
  price: number;
  broker: string;
  fees: number;
}

interface Holding {
  ticker: string;
  company: string;
  sector: string;
  shares: number;
  avgCost: number;
  totalCost: number;
  livePrice: number;
  logoid?: string | null;
}

/*
const getLogoUrl = (logoid: string | null | undefined) => {
  return logoid ? `https://s3-symbol-logo.tradingview.com/${logoid}.svg` : null;
};

// Initial state
const SEED_TRANSACTIONS: Transaction[] = [
  { id: 'dep1', date: '2026-04-01', type: 'Deposit', price: 150000, broker: 'Thunder', fees: 0 },
  { id: 's1', date: '2026-04-28', type: 'Buy', ticker: 'MICH', quantity: 288, price: 35.48, broker: 'Thunder', fees: 17.77 },
  { id: 's2', date: '2026-04-28', type: 'Buy', ticker: 'ORWE', quantity: 448, price: 22.90, broker: 'Thunder', fees: 16.81 },
  { id: 's3', date: '2026-04-28', type: 'Buy', ticker: 'SUGR', quantity: 210, price: 49.49, broker: 'Thunder', fees: 15.99 },
  { id: 's4', date: '2026-04-28', type: 'Buy', ticker: 'MPCI', quantity: 58, price: 172.99, broker: 'Thunder', fees: 15.53 },
  { id: 's5', date: '2026-04-28', type: 'Buy', ticker: 'OLFI', quantity: 458, price: 22.28, broker: 'Thunder', fees: 15.75 },
  { id: 's6', date: '2026-04-28', type: 'Buy', ticker: 'AMOC', quantity: 1261, price: 8.40, broker: 'Thunder', fees: 16.24 },
  { id: 's7', date: '2026-04-28', type: 'Buy', ticker: 'SWDY', quantity: 121, price: 87.00, broker: 'Thunder', fees: 16.16 },
  { id: 's8', date: '2026-05-03', type: 'Buy', ticker: 'OLFI', quantity: 362, price: 22.15, broker: 'Telda', fees: 4.00 },
  { id: 's9', date: '2026-05-03', type: 'Buy', ticker: 'MPCI', quantity: 46, price: 172.41, broker: 'Telda', fees: 2.98 },
  { id: 's10', date: '2026-05-03', type: 'Buy', ticker: 'MICH', quantity: 228, price: 35.80, broker: 'Telda', fees: 3.05 },
  { id: 's11', date: '2026-05-03', type: 'Buy', ticker: 'SUGR', quantity: 163, price: 48.90, broker: 'Telda', fees: 3.00 },
  { id: 's12', date: '2026-05-03', type: 'Buy', ticker: 'ORWE', quantity: 400, price: 23.10, broker: 'Telda', fees: 3.30 },
  { id: 's13', date: '2026-05-03', type: 'Buy', ticker: 'SWDY', quantity: 98, price: 87.50, broker: 'Telda', fees: 4.15 },
  { id: 's14', date: '2026-05-03', type: 'Buy', ticker: 'AMOC', quantity: 1155, price: 8.66, broker: 'Telda', fees: 5.50 },
];
*/
function LearningCenter() {
  const [activeSection, setActiveSection] = useState('basics');

  const sections = [
    { id: 'basics', title: 'The Basics', icon: <Info size={18} /> },
    { id: 'technical', title: 'Technical Indicators', icon: <Activity size={18} /> },
    { id: 'risk', title: 'Risk & Strategy', icon: <ShieldAlert size={18} /> },
    { id: 'judgement', title: 'Buy/Sell Guide', icon: <Target size={18} /> }
  ];

  return (
    <div className="grid-2-1" style={{ gap: '2rem' }}>
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
          <h3 style={{ margin: 0 }}>Investor Education Center</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                padding: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: activeSection === s.id ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                border: 'none',
                borderLeft: activeSection === s.id ? '4px solid var(--color-blue)' : '4px solid transparent',
                color: activeSection === s.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
            >
              {s.icon}
              <span style={{ fontWeight: 600 }}>{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        {activeSection === 'basics' && (
          <div className="fade-in">
            <h2 className="text-blue">Market Fundamentals</h2>
            <p>Welcome to Thunder Pro. Mastering the EGX requires understanding both your portfolio and the broader market context.</p>
            
            <div style={{ marginTop: '2rem', display: 'grid', gap: '1.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px' }}>
                <h4 className="text-yellow">Portfolio Performance & Alpha</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  In your dashboard, we use <strong>Basis 100</strong> normalization. If you start with 100 and the index is at 105 while you are at 110, you have 10% total return and 5% <strong>Alpha</strong> (outperformance). Alpha is the primary goal of active management.
                </p>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px' }}>
                <h4 className="text-green">Market Capitalization</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  This is the total value of a company (Shares × Price).
                </p>
                <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                  <li><strong>Large Cap:</strong> Stable, established companies (e.g., COMI). Lower risk, lower growth.</li>
                  <li><strong>Mid/Small Cap:</strong> Emerging companies. Higher growth potential but higher volatility.</li>
                </ul>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px' }}>
                <h4 className="text-blue">Dividends vs. Capital Gains</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <strong>Capital Gains:</strong> Profit from the price increasing.
                  <br />
                  <strong>Dividends:</strong> Cash payments from company profits. High dividend yield stocks (like utility or telecom) are often used for passive income.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'technical' && (
          <div className="fade-in">
            <h2 className="text-blue">Advanced Technical Analysis</h2>
            <div style={{ display: 'grid', gap: '2rem', marginTop: '2rem' }}>
              <div style={{ borderLeft: '3px solid var(--color-green)', paddingLeft: '1rem' }}>
                <h4 className="text-green">RSI (Relative Strength Index)</h4>
                <p style={{ fontSize: '0.9rem' }}>A momentum oscillator that ranges from 0-100.</p>
                <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <li><strong>&gt; 70 (Overbought):</strong> Market may be "exhausted." Probability of a pullback increases.</li>
                  <li><strong>&lt; 30 (Oversold):</strong> Panic selling may have occurred. Probability of a "dead cat bounce" or reversal increases.</li>
                </ul>
              </div>

              <div style={{ borderLeft: '3px solid var(--color-yellow)', paddingLeft: '1rem' }}>
                <h4 className="text-yellow">Moving Averages (SMA/EMA)</h4>
                <p style={{ fontSize: '0.9rem' }}>Smooths price data to identify the trend direction.</p>
                <ul style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <li><strong>Golden Cross:</strong> Short-term MA crosses above long-term MA (Bullish).</li>
                  <li><strong>Death Cross:</strong> Short-term MA crosses below long-term MA (Bearish).</li>
                </ul>
              </div>

              <div style={{ borderLeft: '3px solid var(--color-blue)', paddingLeft: '1rem' }}>
                <h4 className="text-blue">MACD & Volume</h4>
                <p style={{ fontSize: '0.9rem' }}><strong>Volume:</strong> The number of shares traded. A price move with high volume is more "valid" than one with low volume.</p>
                <p style={{ fontSize: '0.9rem' }}><strong>MACD:</strong> Shows relationship between two moving averages. When the MACD line crosses the signal line, it suggests a trend shift.</p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'risk' && (
          <div className="fade-in">
            <h2 className="text-blue">Risk Management Framework</h2>
            <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="card" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <h4 className="text-red">Maximum Drawdown (Max DD)</h4>
                <p style={{ fontSize: '0.85rem' }}>The worst peak-to-trough decline. Professional investors prioritize <strong>Capital Preservation</strong>. A 50% loss requires a 100% gain just to get back to even.</p>
              </div>
              
              <div className="card" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <h4 className="text-blue">The Sharpe Ratio</h4>
                <p style={{ fontSize: '0.85rem' }}>Measures return per unit of risk. A high Sharpe ratio means the returns were earned through smart strategy, not just by taking wild gambles.</p>
              </div>

              <div className="card" style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <h4 className="text-green">Beta (β)</h4>
                <p style={{ fontSize: '0.85rem' }}><strong>β = 1:</strong> Moves exactly with the EGX 30.
                <br /><strong>β &gt; 1:</strong> More volatile than the market (Aggressive).
                <br /><strong>β &lt; 1:</strong> Less volatile than the market (Defensive).</p>
              </div>

              <div className="card" style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <h4 className="text-yellow">Diversification</h4>
                <p style={{ fontSize: '0.85rem' }}>"Don't put all eggs in one basket." Aim for 5-8 sectors. Correlation measures if your stocks move together; you want a mix that doesn't all drop at once.</p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'judgement' && (
          <div className="fade-in">
            <h2 className="text-blue">Institutional Decision Guide</h2>
            
            <div style={{ display: 'grid', gap: '1.5rem', marginTop: '2rem' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid var(--color-green)' }}>
                <h4 className="text-green">Strategic BUY Signals</h4>
                <ul style={{ fontSize: '0.9rem' }}>
                  <li><strong>AI Confirmation:</strong> Sentiment is Bullish + Target Price &gt; 15% from Current.</li>
                  <li><strong>Oversold RSI:</strong> RSI &lt; 35 indicates the selling may be overdone.</li>
                  <li><strong>Support Bounce:</strong> Price hits a historical floor and starts turning up.</li>
                  <li><strong>Volume Surge:</strong> Buying pressure increases with high transaction counts.</li>
                </ul>
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid var(--color-red)' }}>
                <h4 className="text-red">Strategic EXIT Signals</h4>
                <ul style={{ fontSize: '0.9rem' }}>
                  <li><strong>Target Reached:</strong> Price hits the AI-predicted target. Don't be greedy.</li>
                  <li><strong>Bearish AI:</strong> Institutional sentiment turns negative.</li>
                  <li><strong>RSI Divergence:</strong> Price makes a new high but RSI makes a lower high.</li>
                  <li><strong>Trend Break:</strong> Price falls and closes below the 50-day SMA.</li>
                </ul>
              </div>

              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid var(--color-blue)' }}>
                <h4 className="text-blue">The 2% Portfolio Rule</h4>
                <p style={{ fontSize: '0.85rem' }}>Never risk more than 2% of your total capital on a single trade. If your stop loss is triggered, you only lose a small fraction of your "war chest," allowing you to stay in the game for the long run.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // Real-value / idle-cash config (user-editable, persisted). CPI = annual headline inflation %, cashYield = annual profit rate on idle cash %.
  const [cpiRate, setCpiRate] = useLocalStorage<number>('cfg_cpi_rate', 14.9);
  const [cashYield, setCashYield] = useLocalStorage<number>('cfg_cash_yield', 0);
  // User-editable correlation-cluster tag per ticker (for concentration view).
  const [clusterMap, setClusterMap] = useLocalStorage<Record<string, string>>('cfg_cluster_map', {});
  const [marketData, setMarketData] = useState<Record<string, any>>({});
  const [analyticsData, setAnalyticsData] = useState<Record<string, any>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>(['COMI', 'EKHO', 'TMGH', 'ABUK']);
  const [staleData, setStaleData] = useState(false);
  const [pnlExtremes, setPnlExtremes] = useState<Record<string, PnlExtreme>>({});
  const [egx30Alpha, setEgx30Alpha] = useState<number | null>(null);
  const [egx30Return, setEgx30Return] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedStockTicker, setSelectedStockTicker] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'history' | 'health' | 'market' | 'simulator' | 'holdingHistory' | 'wealth' | 'benchmarks' | 'advice'>('portfolio');
  const [isLearningOpen, setIsLearningOpen] = useState(false);
  const [historyStock, setHistoryStock] = useState<string | null>(null);
  const [analysisStock, setAnalysisStock] = useState<Holding | null>(null);
  const [priceHistoryStock, setPriceHistoryStock] = useState<Holding | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [historySort, setHistorySort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('ALL');
  const [historyTickerFilter, setHistoryTickerFilter] = useState('ALL');
  const [historyBrokerFilter, setHistoryBrokerFilter] = useState('ALL');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [portfolioBrokerFilter, setPortfolioBrokerFilter] = useState('ALL');

  const uniqueHistoryTickers = React.useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => { if (t.ticker) set.add(t.ticker.toUpperCase()); });
    return Array.from(set).sort();
  }, [transactions]);

  const uniqueHistoryBrokers = React.useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => set.add(t.broker || 'Thunder'));
    return Array.from(set).sort();
  }, [transactions]);

  // Only Buy transactions to get real stock-purchase brokers (no Deposit/Withdraw noise)
  const uniquePortfolioBrokers = React.useMemo(() => {
    const set = new Set<string>();
    transactions
      .filter(t => t.type === 'Buy' && t.ticker)
      .forEach(t => set.add((t.broker || 'Thunder').trim()));
    return Array.from(set).sort();
  }, [transactions]);

  const filteredTransactions = React.useMemo(() => {
    return transactions.filter(tx => {
      if (historySearch.trim()) {
        const query = historySearch.toLowerCase().trim();
        const tickerMatch = tx.ticker ? tx.ticker.toLowerCase().includes(query) : false;
        const typeMatch = tx.type.toLowerCase().includes(query);
        const brokerMatch = (tx.broker || 'Thunder').toLowerCase().includes(query);
        const dateMatch = tx.date.includes(query);
        if (!tickerMatch && !typeMatch && !brokerMatch && !dateMatch) return false;
      }
      if (historyTypeFilter !== 'ALL' && tx.type !== historyTypeFilter) {
        return false;
      }
      if (historyTickerFilter !== 'ALL') {
        if (!tx.ticker || tx.ticker.toUpperCase() !== historyTickerFilter.toUpperCase()) {
          return false;
        }
      }
      if (historyBrokerFilter !== 'ALL') {
        const b = tx.broker || 'Thunder';
        if (b.toLowerCase() !== historyBrokerFilter.toLowerCase()) {
          return false;
        }
      }
      if (historyDateFrom && tx.date < historyDateFrom) {
        return false;
      }
      if (historyDateTo && tx.date > historyDateTo) {
        return false;
      }
      return true;
    });
  }, [transactions, historySearch, historyTypeFilter, historyTickerFilter, historyBrokerFilter, historyDateFrom, historyDateTo]);

  const sortedTransactions = React.useMemo(() => {
    return [...filteredTransactions].sort((a: any, b: any) => {
      const key = historySort.key;
      const dir = historySort.direction === 'asc' ? 1 : -1;

      let valA: any;
      let valB: any;

      if (key === 'total') {
        valA = (a.quantity ? (a.quantity * a.price) : a.price) + (a.fees || 0);
        valB = (b.quantity ? (b.quantity * b.price) : b.price) + (b.fees || 0);
      } else if (key === 'quantity' || key === 'price' || key === 'fees') {
        valA = a[key] ?? 0;
        valB = b[key] ?? 0;
      } else if (key === 'broker') {
        valA = (a.broker || 'Thunder').toLowerCase();
        valB = (b.broker || 'Thunder').toLowerCase();
      } else if (key === 'ticker') {
        valA = (a.ticker || '').toLowerCase();
        valB = (b.ticker || '').toLowerCase();
      } else {
        valA = a[key] ?? '';
        valB = b[key] ?? '';
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * dir;
      }
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });
  }, [filteredTransactions, historySort]);

  const hasHistoryFilters = Boolean(
    historySearch || 
    historyTypeFilter !== 'ALL' || 
    historyTickerFilter !== 'ALL' || 
    historyBrokerFilter !== 'ALL' || 
    historyDateFrom || 
    historyDateTo
  );

  const resetHistoryFilters = () => {
    setHistorySearch('');
    setHistoryTypeFilter('ALL');
    setHistoryTickerFilter('ALL');
    setHistoryBrokerFilter('ALL');
    setHistoryDateFrom('');
    setHistoryDateTo('');
  };

  const handleHistorySort = (key: string) => {
    setHistorySort(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: key === 'date' ? 'desc' : 'asc' };
    });
  };
  const [aiSettings, setAiSettings] = useState({
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    geminiKey: '',
    openaiKey: '',
    enableLogging: true,
    goldKarat: 21,
    goldPrice21k: 6502.73,
  });
  const [_liveGoldPrice21k, setLiveGoldPrice21k] = useState<number | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const fetchModels = async () => {
      setLoadingModels(true);
      try {
        const res = await fetch(`/api/db/ai/models?provider=${aiSettings.provider}`, {
          headers: { 'X-AI-Key': aiSettings.provider === 'gemini' ? aiSettings.geminiKey : aiSettings.openaiKey }
        });
        const data = await res.json();
        if (aiSettings.provider === 'gemini') {
          const models = data
            .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m: any) => m.name.replace('models/', ''));
          setAvailableModels(models);
        } else {
          const models = data.map((m: any) => m.id).sort();
          setAvailableModels(models);
        }
      } catch (e) {
        console.error('Failed to fetch models', e);
        setAvailableModels([]);
      }
      setLoadingModels(false);
    };
    fetchModels();
  }, [aiSettings.provider, aiSettings.geminiKey, aiSettings.openaiKey, isSettingsOpen]);

  // --- DATABASE SYNC ---
  useEffect(() => {
    const initData = async () => {
      try {
        const res = await fetch('/api/db/init');
        const data = await res.json();
        if (data.transactions) setTransactions(data.transactions);
        if (data.analytics) setAnalyticsData(data.analytics);
        if (data.settings && Object.keys(data.settings).length > 0) {
          setAiSettings(prev => ({ ...prev, ...data.settings }));
        }
      } catch (e) { console.error('DB Init Error', e); }
    };
    initData();
  }, []);

  const saveTransaction = async (tx: Transaction) => {
    await fetch('/api/db/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx)
    });
    setTransactions(prev => {
      const idx = prev.findIndex(t => t.id === tx.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = tx;
        return next;
      }
      return [...prev, tx];
    });
  };

  const deleteTransaction = async (id: string) => {
    await fetch(`/api/db/transactions/${id}`, { method: 'DELETE' });
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const saveSettings = async (settings: any) => {
    setAiSettings(settings);
    await fetch('/api/db/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  };

  const saveAnalytics = async (data: Record<string, any>) => {
    setAnalyticsData(data);
    await fetch('/api/db/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => 
      Object.values(obj).map(val => `"${val}"`).join(',')
    ).join('\n');
    const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSortedHoldings = (holdings: Holding[]) => {
    if (!sortConfig) return holdings;
    return [...holdings].sort((a: any, b: any) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const SortIndicator = ({ column }: { column: string }) => {
    if (!sortConfig || sortConfig.key !== column) return <span style={{ opacity: 0.2 }}> ↕</span>;
    return <span> {sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  // --- CONSTANTS ---
  const SHARIA_TICKERS = [
    'ADIB', 'SAUD', 'AMOC', 'TMGH', 'SWDY', 'ABUK', 'ETEL', 'FWRY', 'MNHD', 
    'ORAS', 'JUFO', 'EFIH', 'EFID', 'ARCC', 'CIRA', 'ALCN', 'ESRS', 'ISPH', 
    'ORWE', 'PHDC', 'SKPC', 'DOCK', 'MFOT', 'CCAP', 'BISC', 'BINV', 'DOMT'
  ];

  const calculatePortfolio = () => {
    let walletBalance = 0;
    let totalDeposited = 0;
    let realizedPnL = 0;
    let dividendsCollected = 0;
    const dividendsByTicker: Record<string, number> = {};
    const stockDividendsByTicker: Record<string, number> = {};
    const holdingsMap: Record<string, { shares: number; totalCost: number }> = {};
    // Per-ticker realized trade ledger (survives even after a position is fully exited)
    const realizedMap: Record<string, {
      buyShares: number; buyCost: number; grossBuy: number;
      soldShares: number; grossProceeds: number; netProceeds: number;
      costBasisSold: number; realizedPnL: number; fees: number;
      firstBuyDate: string; lastSellDate: string;
    }> = {};
    const ensureRealized = (ticker: string) => {
      if (!realizedMap[ticker]) realizedMap[ticker] = {
        buyShares: 0, buyCost: 0, grossBuy: 0,
        soldShares: 0, grossProceeds: 0, netProceeds: 0,
        costBasisSold: 0, realizedPnL: 0, fees: 0,
        firstBuyDate: '', lastSellDate: ''
      };
      return realizedMap[ticker];
    };

    const sortedTx = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedTx.forEach(tx => {
      switch (tx.type) {
        case 'Deposit':
          walletBalance += tx.price;
          totalDeposited += tx.price;
          break;
        case 'Withdraw':
          walletBalance -= tx.price;
          break;
        case 'Dividend':
          walletBalance += tx.price;
          dividendsCollected += tx.price;
          if (tx.ticker) {
            dividendsByTicker[tx.ticker] = (dividendsByTicker[tx.ticker] || 0) + tx.price;
          }
          break;
        case 'StockDividend':
          // Stock dividend: receive free shares — no cash changes, no cost basis added.
          // This correctly handles the post-dividend price drop: avg cost per share decreases
          // proportionally (same total cost spread over more shares), matching the lower market price.
          if (tx.ticker && tx.quantity) {
            if (!holdingsMap[tx.ticker]) holdingsMap[tx.ticker] = { shares: 0, totalCost: 0 };
            holdingsMap[tx.ticker].shares += tx.quantity;
            // totalCost intentionally NOT increased — free shares at zero cost basis
            stockDividendsByTicker[tx.ticker] = (stockDividendsByTicker[tx.ticker] || 0) + tx.quantity;

            // Update the realized ledger so these shares are tracked for future sell calculations
            const r = ensureRealized(tx.ticker);
            r.buyShares += tx.quantity;
            // grossBuy and buyCost NOT increased — keeps avg buy price accurate for the cash-paid shares
            if (!r.firstBuyDate || tx.date < r.firstBuyDate) r.firstBuyDate = tx.date;
          }
          break;
        case 'Buy':
          if (tx.ticker && tx.quantity) {
            const cost = (tx.quantity * tx.price) + (tx.fees || 0);
            walletBalance -= cost;
            if (!holdingsMap[tx.ticker]) holdingsMap[tx.ticker] = { shares: 0, totalCost: 0 };
            holdingsMap[tx.ticker].shares += tx.quantity;
            holdingsMap[tx.ticker].totalCost += cost;

            const r = ensureRealized(tx.ticker);
            r.buyShares += tx.quantity;
            r.buyCost += cost;
            r.grossBuy += tx.quantity * tx.price;
            r.fees += tx.fees || 0;
            if (!r.firstBuyDate || tx.date < r.firstBuyDate) r.firstBuyDate = tx.date;
          }
          break;
        case 'Sell':
          if (tx.ticker && tx.quantity) {
            const proceeds = (tx.quantity * tx.price) - (tx.fees || 0);
            walletBalance += proceeds;
            const h = holdingsMap[tx.ticker];
            if (h && h.shares > 0) {
              const avgCost = h.totalCost / h.shares;
              const costBasisOfSold = avgCost * tx.quantity;
              realizedPnL += (proceeds - costBasisOfSold);
              h.shares -= tx.quantity;
              h.totalCost -= costBasisOfSold;

              const r = ensureRealized(tx.ticker);
              r.soldShares += tx.quantity;
              r.grossProceeds += tx.quantity * tx.price;
              r.netProceeds += proceeds;
              r.costBasisSold += costBasisOfSold;
              r.realizedPnL += (proceeds - costBasisOfSold);
              r.fees += tx.fees || 0;
              if (!r.lastSellDate || tx.date > r.lastSellDate) r.lastSellDate = tx.date;
            }
          }
          break;
      }
    });

    const holdings: Holding[] = Object.entries(holdingsMap)
      .filter(([_, data]) => data.shares > 0)
      .map(([ticker, data]) => {
        const meta = marketData[ticker] || {};
        return {
          ticker,
          company: meta.name || 'Loading...',
          sector: meta.sector || '...',
          shares: data.shares,
          avgCost: data.totalCost / data.shares,
          totalCost: data.totalCost,
          livePrice: meta.price || (data.totalCost / data.shares),
          logoid: meta.logoid
        };
      });

    // Build closed / partially-exited positions from the realized ledger.
    // Any ticker that has ever been sold gets a record, even if it no longer appears in holdings.
    const closedPositions: ClosedPosition[] = Object.entries(realizedMap)
      .filter(([_, r]) => r.soldShares > 0)
      .map(([ticker, r]) => {
        const meta = marketData[ticker] || {};
        const openShares = holdingsMap[ticker]?.shares || 0;
        const isFullyClosed = openShares <= 0.0001;
        const dividends = dividendsByTicker[ticker] || 0;
        const avgBuyPrice = r.buyShares > 0 ? r.grossBuy / r.buyShares : 0;
        const avgSellPrice = r.soldShares > 0 ? r.grossProceeds / r.soldShares : 0;
        const livePrice = meta.price || 0;
        const postSellDiffPct = (livePrice > 0 && avgSellPrice > 0)
          ? ((livePrice - avgSellPrice) / avgSellPrice) * 100
          : 0;
        const postSellAmountDiff = (livePrice > 0 && avgSellPrice > 0)
          ? (livePrice - avgSellPrice) * r.soldShares
          : 0;
        const realizedPnLPct = r.costBasisSold > 0 ? (r.realizedPnL / r.costBasisSold) * 100 : 0;
        const holdingDays = (r.firstBuyDate && r.lastSellDate)
          ? Math.max(0, Math.round((new Date(r.lastSellDate).getTime() - new Date(r.firstBuyDate).getTime()) / 86400000))
          : 0;
        return {
          ticker,
          company: meta.name || ticker,
          sector: meta.sector || '—',
          soldShares: r.soldShares,
          avgBuyPrice,
          avgSellPrice,
          livePrice,
          postSellDiffPct,
          postSellAmountDiff,
          costBasisSold: r.costBasisSold,
          netProceeds: r.netProceeds,
          realizedPnL: r.realizedPnL,
          realizedPnLPct,
          dividends,
          totalReturn: r.realizedPnL + dividends,
          fees: r.fees,
          firstBuyDate: r.firstBuyDate,
          lastSellDate: r.lastSellDate,
          holdingDays,
          isFullyClosed,
          openShares
        };
      })
      .sort((a, b) => new Date(b.lastSellDate).getTime() - new Date(a.lastSellDate).getTime());

    return { holdings, walletBalance, totalDeposited, realizedPnL, dividendsCollected, dividendsByTicker, stockDividendsByTicker, closedPositions };
  };

  const { holdings, walletBalance, totalDeposited, realizedPnL, dividendsCollected, dividendsByTicker, stockDividendsByTicker, closedPositions } = calculatePortfolio();

  // Broker-filtered holdings for the Active Holdings table
  const displayedHoldings = React.useMemo(() => {
    if (portfolioBrokerFilter === 'ALL') return holdings;
    // Recompute shares/cost using only the selected broker's Buy/Sell transactions
    const brokerTx = transactions.filter(t =>
      (t.type === 'Buy' || t.type === 'Sell') &&
      (t.broker || 'Thunder').toLowerCase() === portfolioBrokerFilter.toLowerCase()
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const map: Record<string, { shares: number; totalCost: number }> = {};
    brokerTx.forEach(tx => {
      if (!tx.ticker || !tx.quantity) return;
      if (!map[tx.ticker]) map[tx.ticker] = { shares: 0, totalCost: 0 };
      if (tx.type === 'Buy') {
        const cost = tx.quantity * tx.price + (tx.fees || 0);
        map[tx.ticker].shares += tx.quantity;
        map[tx.ticker].totalCost += cost;
      } else if (tx.type === 'Sell') {
        const h = map[tx.ticker];
        if (h && h.shares > 0) {
          const avgCost = h.totalCost / h.shares;
          h.totalCost -= avgCost * tx.quantity;
          h.shares -= tx.quantity;
        }
      }
    });

    // Build a fast lookup of globally-open tickers (avoids ghost positions
    // where sells were done via a different broker than the buys).
    const globalOpenTickers = new Set(holdings.map(h => h.ticker));

    return Object.entries(map)
      .filter(([ticker, d]) => d.shares > 0.0001 && globalOpenTickers.has(ticker))
      .map(([ticker, d]) => {
        // Use marketData directly so tickers that are globally closed
        // (not in the full holdings array) still show company name & live price
        const meta = marketData[ticker] || {};
        // Fallback chain: marketData → active holding → avg cost
        const livePrice = meta.price || holdings.find(h => h.ticker === ticker)?.livePrice || (d.totalCost / d.shares);
        return {
          ticker,
          company: meta.name || '...',
          sector: meta.sector || '...',
          shares: d.shares,
          avgCost: d.totalCost / d.shares,
          totalCost: d.totalCost,
          livePrice,
          logoid: meta.logoid,
        };
      });
  }, [holdings, transactions, portfolioBrokerFilter, marketData]);

  // --- P&L EXTREMES CALCULATION (Historical peaks/troughs up to day before current date) ---
  const computePnlExtremes = async () => {
    if (holdings.length === 0 || transactions.length === 0) return;
    const results: Record<string, { maxPnl: number; maxPnlDate: string; maxPnlPct: number; maxPnlPrice: number; minPnl: number; minPnlDate: string; minPnlPct: number; minPnlPrice: number }> = {};
    
    // Day before current date (yesterday)
    const now = new Date();
    const yesterdayObj = new Date(now);
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterday = yesterdayObj.toISOString().split('T')[0];

    await Promise.all(holdings.map(async (h) => {
      try {
        // Sort all transactions for this ticker by date ascending
        const tickerTxs = transactions
          .filter(t => t.ticker === h.ticker)
          .sort((a, b) => a.date.localeCompare(b.date));

        if (tickerTxs.length === 0) return;

        // Find the start date of the CURRENT active position run
        let currentRunStartDate = '';
        let runningShares = 0;

        tickerTxs.forEach(tx => {
          if (runningShares <= 0.0001 && tx.type === 'Buy') {
            currentRunStartDate = tx.date;
          }
          if (tx.type === 'Buy') {
            runningShares += tx.quantity || 0;
          } else if (tx.type === 'Sell') {
            runningShares -= tx.quantity || 0;
            if (runningShares <= 0.0001) {
              runningShares = 0;
              currentRunStartDate = '';
            }
          }
        });

        // Fallback if no active run start date found
        if (!currentRunStartDate) {
          const buyTxs = tickerTxs.filter(t => t.type === 'Buy');
          if (buyTxs.length > 0) currentRunStartDate = buyTxs[0].date;
          else return;
        }

        const daysSinceBuy = Math.max(1, Math.ceil((Date.now() - new Date(currentRunStartDate).getTime()) / (1000 * 60 * 60 * 24)));
        const histRange = daysSinceBuy <= 30 ? '1m' : daysSinceBuy <= 90 ? '3m' : daysSinceBuy <= 180 ? '6m' : daysSinceBuy <= 365 ? '1y' : '5y';

        let maxPnl = -Infinity;
        let maxPnlDate = currentRunStartDate <= yesterday ? currentRunStartDate : yesterday;
        let maxPnlPct = 0;
        let maxPnlPrice = 0;
        let minPnl = Infinity;
        let minPnlDate = currentRunStartDate <= yesterday ? currentRunStartDate : yesterday;
        let minPnlPct = 0;
        let minPnlPrice = 0;

        try {
          const res = await fetch(`/api/history?symbol=${h.ticker}&range=${histRange}`);
          const history = await res.json();

          if (Array.isArray(history) && history.length > 0) {
            // Filter history: only valid dates >= currentRunStartDate AND <= yesterday (day before current)
            const relevantHistory = history.filter((p: any) => {
              if (!p || p.close == null || isNaN(p.close)) return false;
              const pDate = p.date ? p.date.split('T')[0] : '';
              return pDate >= currentRunStartDate && pDate <= yesterday;
            });

            relevantHistory.forEach((point: any) => {
              const pDate = point.date.split('T')[0];
              let shares = 0;
              let totalCost = 0;

              tickerTxs.forEach(tx => {
                if (tx.date > pDate) return;
                if (tx.type === 'Buy') {
                  shares += tx.quantity!;
                  totalCost += (tx.quantity! * tx.price) + (tx.fees || 0);
                } else if (tx.type === 'Sell') {
                  const avgCost = shares > 0 ? totalCost / shares : 0;
                  const costBasisSold = avgCost * tx.quantity!;
                  shares -= tx.quantity!;
                  totalCost -= costBasisSold;
                }
              });

              if (shares > 0 && totalCost > 0) {
                const currentValue = shares * point.close;
                const pnl = currentValue - totalCost;
                const pnlPct = (pnl / totalCost) * 100;

                if (pnl > maxPnl) {
                  maxPnl = pnl;
                  maxPnlDate = pDate;
                  maxPnlPct = pnlPct;
                  maxPnlPrice = point.close;
                }
                if (pnl < minPnl) {
                  minPnl = pnl;
                  minPnlDate = pDate;
                  minPnlPct = pnlPct;
                  minPnlPrice = point.close;
                }
              }
            });
          }
        } catch (fetchErr) {
          console.warn(`History fetch failed for ${h.ticker}`, fetchErr);
        }

        // Default baseline if no points evaluated prior to today
        if (maxPnl === -Infinity || minPnl === Infinity) {
          maxPnl = 0;
          maxPnlDate = currentRunStartDate <= yesterday ? currentRunStartDate : yesterday;
          maxPnlPct = 0;
          maxPnlPrice = h.livePrice || 0;
          minPnl = 0;
          minPnlDate = currentRunStartDate <= yesterday ? currentRunStartDate : yesterday;
          minPnlPct = 0;
          minPnlPrice = h.livePrice || 0;
        }

        results[h.ticker] = {
          maxPnl,
          maxPnlDate,
          maxPnlPct,
          maxPnlPrice,
          minPnl,
          minPnlDate,
          minPnlPct,
          minPnlPrice
        };
      } catch (e) {
        console.error(`Failed to compute P&L extremes for ${h.ticker}`, e);
      }
    }));

    setPnlExtremes(results);
  };

  const holdingsKey = holdings.map(h => `${h.ticker}:${h.shares}:${h.livePrice}:${h.totalCost}`).join('|');

  useEffect(() => {
    if (holdings.length > 0 && transactions.length > 0) {
      computePnlExtremes();
    }
  }, [holdingsKey, transactions.length]);

  // Compute Benchmark Alpha vs EGX30 for Total Return card
  useEffect(() => {
    const buyTxDates = (transactions || [])
      .filter(t => t.type === 'Buy' && t.date)
      .map(t => t.date)
      .sort((a, b) => a.localeCompare(b));
    const allTxDates = (transactions || []).map(t => t.date).filter(Boolean).sort((a, b) => a.localeCompare(b));
    const jDate = buyTxDates.length > 0 ? buyTxDates[0] : (allTxDates.length > 0 ? allTxDates[0] : '');

    if (!jDate) return;

    const days = Math.max(1, Math.ceil((Date.now() - new Date(jDate).getTime()) / (1000 * 60 * 60 * 24)));
    const range = days <= 30 ? '1m' : days <= 90 ? '3m' : days <= 180 ? '6m' : days <= 365 ? '1y' : '5y';

    const totalMarketValue = holdings.reduce((sum, h) => sum + (h.shares * h.livePrice), 0);
    const totalInvested = holdings.reduce((sum, h) => sum + h.totalCost, 0);
    const totalPnL = totalMarketValue - totalInvested;
    const uPnL = totalPnL || 0;
    const rPnL = realizedPnL || 0;
    const divCol = dividendsCollected || 0;
    const combinedTotalReturn = uPnL + rPnL + divCol;
    const baseCap = (totalInvested && totalInvested > 0) ? totalInvested : (totalDeposited || 0);
    const totReturnPct = baseCap > 0 ? (combinedTotalReturn / baseCap) * 100 : 0;

    fetch(`/api/history?symbol=%5EEGX30&range=${range}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const startPt = data.find((p: any) => p.date.split('T')[0] >= jDate) || data[0];
          const lastPt = data[data.length - 1];
          if (startPt && lastPt && startPt.close > 0) {
            const egxReturn = ((lastPt.close - startPt.close) / startPt.close) * 100;
            setEgx30Alpha(totReturnPct - egxReturn);
            setEgx30Return(egxReturn);
          }
        }
      })
      .catch(e => console.error('Failed to fetch EGX30 benchmark for Alpha:', e));
  }, [holdingsKey, transactions.length, realizedPnL, dividendsCollected, totalDeposited]);

  const fetchLivePrices = async (isManualOrInitial: boolean = true) => {
    if (!isManualOrInitial && !isEGXMarketOpen()) {
      console.log('[Periodic Query] EGX Stock Market is OFF (closed). Skipping periodic quote query.');
      return;
    }
    try {
      setIsUpdating(true);
      // Also fetch live Gold & FX to compute 24k Gold per gram in EGP dynamically
      try {
        const [goldRes, fxRes] = await Promise.all([
          fetch('/api/history?symbol=GC=F&range=1d').then(r => r.json()).catch(() => null),
          fetch('/api/history?symbol=USDEGP=X&range=1d').then(r => r.json()).catch(() => null)
        ]);
        if (Array.isArray(goldRes) && goldRes.length > 0 && Array.isArray(fxRes) && fxRes.length > 0) {
          const gc = goldRes[goldRes.length - 1].close;
          const fx = fxRes[fxRes.length - 1].close;
          if (gc && fx) {
            // 21K gold = 24K price * (21/24)
            const perGram21kEGP = Math.round((((gc * fx) / 31.1034768) * (21 / 24)) * 100) / 100;
            setLiveGoldPrice21k(perGram21kEGP);
          }
        }
      } catch (e) {
        console.error('Failed to fetch live gold price:', e);
      }

      const soldTickers = (transactions || [])
        .filter(t => t.type === 'Sell' && t.ticker)
        .map(t => t.ticker!);

      const tickers = Array.from(new Set([
        ...(holdings || []).map(h => `${h.ticker.trim().toUpperCase()}.CA`),
        ...(soldTickers || []).map(t => `${t.trim().toUpperCase()}.CA`),
        ...(watchlist || []).map(t => `${t.trim().toUpperCase()}.CA`)
      ]));
      if (tickers.length === 0) return;
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers })
      });
      const data = await res.json();
      setMarketData(data);
    } catch (err) {
      console.error(err);
      setStaleData(true);
    } finally {
      setIsUpdating(false);
    }
  };

  const updateAllAnalytics = async () => {
    console.log('[Frontend] Starting Global Portfolio Analysis');
    if (holdings.length === 0) {
      console.warn('[Frontend] No holdings found for analysis');
      return;
    }
    setIsAnalyzingAll(true);
    
    try {
      // 1. Sync prices first to ensure AI has latest data
      await fetchLivePrices();
      
      const allTickersToAnalyze = [...new Set([
        ...holdings.map(h => ({ ticker: h.ticker, company: h.company, livePrice: h.livePrice })),
        ...watchlist.map(t => ({ ticker: t, company: marketData[t]?.name || t, livePrice: marketData[t]?.price || 0 }))
      ])];

      if (allTickersToAnalyze.length === 0) {
        console.warn('[Frontend] No assets found for analysis');
        return;
      }

      const results = await Promise.all(allTickersToAnalyze.map(async h => {
        try {
          const resHistory = await fetch(`/api/history?symbol=${h.ticker}&range=6m`);
          const history = await resHistory.json();
          if (!history || history.length < 20) return null;

          let gains = 0, losses = 0;
          for (let i = history.length - 14; i < history.length; i++) {
            const diff = history[i].close - history[i-1].close;
            if (diff > 0) gains += diff; else losses -= diff;
          }
          const rs = (gains / 14) / (losses / 14 || 1);
          const rsi = 100 - (100 / (1 + rs));
          const sma50 = (history.slice(-50).reduce((a:any, b:any) => a + b.close, 0) / Math.min(history.length, 50)).toFixed(2);
          const resistance = Math.max(...history.map((q:any)=>q.close)).toFixed(2);
          const support = Math.min(...history.map((q:any)=>q.close)).toFixed(2);

          const techData = {
            ticker: h.ticker,
            company: h.company,
            history: history.slice(-10),
            stats: { currentPrice: h.livePrice, rsi: rsi.toFixed(1), sma50, resistance, support }
          };
          return techData;
        } catch (e) {
          console.error(`Failed technicals for ${h.ticker}`, e);
          return null;
        }
      }));

      const batchData = results.filter(r => r !== null);
      if (batchData.length === 0) throw new Error('No stocks were ready for analysis');

      const aiRes = await fetch('/api/ai-analyze-batch', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-AI-Provider': aiSettings.provider,
          'X-AI-Model': aiSettings.model,
          'X-AI-Key': aiSettings.provider === 'gemini' ? aiSettings.geminiKey : aiSettings.openaiKey,
          'X-AI-Logging': aiSettings.enableLogging ? 'true' : 'false'
        },
        body: JSON.stringify({ stocks: batchData })
      });
      
      const responseText = await aiRes.text();
      if (!aiRes.ok) {
        let errorMsg = responseText;
        try {
          const errorJson = JSON.parse(responseText);
          errorMsg = errorJson.error || errorJson.message || responseText;
        } catch (e) {
          // Not JSON
        }
        throw new Error(errorMsg || 'Server returned an empty error response');
      }
      
      let aiResults;
      try {
        aiResults = JSON.parse(responseText);
      } catch (e) {
        throw new Error('Invalid AI Response Format');
      }
      
      const finalAnalytics: Record<string, any> = { ...analyticsData };
      const aiResultsProcessed = aiResults.stocks || aiResults.analysis || aiResults;
      
      if (!aiResultsProcessed || typeof aiResultsProcessed !== 'object') {
        throw new Error('AI returned an unexpected data format for batch analysis');
      }

      allTickersToAnalyze.forEach(s => {
        const ticker = s.ticker.toUpperCase();
        const cleanTicker = ticker.split('.')[0];
        const aiKey = Object.keys(aiResultsProcessed).find(k => {
          const cleanK = k.toUpperCase().split('.')[0].replace('EGX:', '').trim();
          return cleanK === cleanTicker || ticker === k.toUpperCase();
        });

        const result = aiKey ? aiResultsProcessed[aiKey] : null;
        if (result) {
          const matchingResult = results.find(r => r?.ticker === s.ticker);
          finalAnalytics[s.ticker] = {
            ...finalAnalytics[s.ticker],
            sentiment: result.sentiment || result.Sentiment || 'NEUTRAL',
            sentiment_ar: result.sentiment_ar || result.Sentiment_ar,
            recommendation: result.recommendation || result.Recommendation || 'HOLD',
            recommendation_ar: result.recommendation_ar || result.Recommendation_ar,
            targetPrice: result.targetPrice || result.TargetPrice || s.livePrice * 1.1,
            narrative: result.narrative || result.Narrative,
            narrative_ar: result.narrative_ar || result.Narrative_ar,
            key_metrics: result.key_metrics || result.Key_metrics || [],
            risks: result.risks || result.Risks || [],
            catalysts: result.catalysts || result.Catalysts || [],
            rsi: matchingResult?.stats?.rsi || '50.0',
            lastUpdate: new Date().toISOString()
          };
        }
      });

      saveAnalytics(finalAnalytics);
    } catch (e: any) {
      alert(`AI Intelligence Error: ${e.message || 'Operation failed'}`);
    } finally {
      setIsAnalyzingAll(false);
    }
  };

  useEffect(() => {
    if (holdings.length > 0 && Object.keys(analyticsData).length === 0) {
      updateAllAnalytics();
    }
  }, [holdings.length]);

  useEffect(() => {
    fetchLivePrices(true);
    const interval = setInterval(() => {
      fetchLivePrices(false);
    }, 60000);
    return () => clearInterval(interval);
  }, [holdingsKey, watchlist]); // Reset interval when data changes to ensure latest state is captured

  const totalMarketValue = holdings.reduce((sum, h) => sum + (h.shares * h.livePrice), 0);
  const totalInvested = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalPnL = totalMarketValue - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  // Broker-filtered stats for the top cards
  const brokerStats = React.useMemo(() => {
    if (portfolioBrokerFilter === 'ALL') return null;

    // Equity & Unrealized P&L straight from displayedHoldings
    const bMarketValue = displayedHoldings.reduce((s, h) => s + h.shares * h.livePrice, 0);
    const bInvested    = displayedHoldings.reduce((s, h) => s + h.totalCost, 0);
    const bUnrealizedPnL = bMarketValue - bInvested;
    const bUnrealizedPct = bInvested > 0 ? (bUnrealizedPnL / bInvested) * 100 : 0;

    // Realized P&L: replay only this broker's Buy/Sell transactions
    const brokerTx = [...transactions]
      .filter(t => (t.broker || 'Thunder') === portfolioBrokerFilter && (t.type === 'Buy' || t.type === 'Sell'))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const posMap: Record<string, { shares: number; totalCost: number }> = {};
    let bRealizedPnL = 0;
    let bSoldPositions = 0;

    brokerTx.forEach(tx => {
      if (!tx.ticker || !tx.quantity) return;
      if (!posMap[tx.ticker]) posMap[tx.ticker] = { shares: 0, totalCost: 0 };
      if (tx.type === 'Buy') {
        posMap[tx.ticker].shares += tx.quantity;
        posMap[tx.ticker].totalCost += tx.quantity * tx.price + (tx.fees || 0);
      } else if (tx.type === 'Sell') {
        const p = posMap[tx.ticker];
        if (p && p.shares > 0) {
          const avgCost = p.totalCost / p.shares;
          const proceeds = tx.quantity * tx.price - (tx.fees || 0);
          bRealizedPnL += proceeds - avgCost * tx.quantity;
          p.totalCost -= avgCost * tx.quantity;
          p.shares -= tx.quantity;
          bSoldPositions++;
        }
      }
    });

    // Dividends: sum dividends for tickers the broker holds (dividends have no broker field)
    const brokerTickers = new Set(displayedHoldings.map(h => h.ticker));
    let bDividends = 0;
    const bDividendsByTicker: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'Dividend' && t.ticker && brokerTickers.has(t.ticker))
      .forEach(t => {
        bDividends += t.price;
        bDividendsByTicker[t.ticker!] = (bDividendsByTicker[t.ticker!] || 0) + t.price;
      });

    // First Buy date for this broker
    const brokerBuyDates = transactions
      .filter(t => t.type === 'Buy' && (t.broker || 'Thunder') === portfolioBrokerFilter && t.date)
      .map(t => t.date)
      .sort((a, b) => a.localeCompare(b));
    const bJoinDate = brokerBuyDates[0] || '';

    return {
      marketValue: bMarketValue,
      invested: bInvested,
      unrealizedPnL: bUnrealizedPnL,
      unrealizedPct: bUnrealizedPct,
      realizedPnL: bRealizedPnL,
      soldPositions: bSoldPositions,
      dividends: bDividends,
      dividendsByTicker: bDividendsByTicker,
      joinDate: bJoinDate,
    };
  }, [displayedHoldings, transactions, portfolioBrokerFilter]);

  // Card display values: broker-filtered when active, otherwise global
  const cardMarketValue    = brokerStats?.marketValue    ?? totalMarketValue;
  const cardInvested       = brokerStats?.invested       ?? totalInvested;
  const cardUnrealizedPnL  = brokerStats?.unrealizedPnL  ?? totalPnL;
  const cardUnrealizedPct  = brokerStats?.unrealizedPct  ?? totalPnLPercent;
  const cardRealizedPnL    = brokerStats?.realizedPnL    ?? realizedPnL;
  const cardSoldPositions  = brokerStats?.soldPositions  ?? closedPositions.length;
  const cardDividends      = brokerStats?.dividends      ?? dividendsCollected;
  const cardDividendsByTicker = brokerStats?.dividendsByTicker ?? dividendsByTicker;
  const cardJoinDate       = brokerStats?.joinDate       ?? null;

  // Cash actually pulled out of the account (respects the active broker filter), to show
  // that realized gains were redeployed rather than banked.
  const cardWithdrawn = (transactions || [])
    .filter(t => t.type === 'Withdraw' && (portfolioBrokerFilter === 'ALL' || t.broker === portfolioBrokerFilter))
    .reduce((s, t) => s + Math.abs(t.price ?? 0), 0);

  // Money-weighted return (annualized XIRR) — accounts for WHEN capital was funded,
  // unlike the simple % which ignores progressive deposits. Global view only.
  const portfolioXirr = React.useMemo(() => {
    if (portfolioBrokerFilter !== 'ALL') return null;
    const asOf = new Date().toISOString().split('T')[0];
    const terminal = totalMarketValue + walletBalance;
    if (terminal <= 0) return null;
    return xirr(buildPortfolioCashflows(transactions, terminal, asOf));
  }, [transactions, totalMarketValue, walletBalance, portfolioBrokerFilter]);


  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Activity className="text-blue" size={24} />
          <h2>
            Thunder Pro 
            {(() => {
              const status = getEGXMarketStatusText();
              return (
                <span 
                  className={`badge ${status.isOpen ? 'badge-green' : 'badge-yellow'}`}
                  style={{ fontSize: '0.65rem', marginLeft: '8px', cursor: 'help' }}
                  title={status.details}
                >
                  {status.label}
                </span>
              );
            })()}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="icon-btn" title="Learning Center" onClick={() => setIsLearningOpen(true)}>
            <BookOpen size={20} />
          </button>
          <button className="icon-btn" title="Settings" onClick={() => setIsSettingsOpen(true)}>
            <SettingsIcon size={20} />
          </button>
          <button className="btn-primary" onClick={() => fetchLivePrices(true)} disabled={isUpdating}>
            <RefreshCw size={18} className={isUpdating ? 'spinning' : ''} />
            <span>Sync</span>
          </button>
          <button className="btn-primary" onClick={updateAllAnalytics} disabled={isAnalyzingAll}>
            <Brain size={18} className={isAnalyzingAll ? 'spinning' : ''} />
            <span>{isAnalyzingAll ? 'Analyzing...' : 'Update Analytics'}</span>
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div style={{ padding: '0 1.5rem', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '2rem' }}>
        <button 
          onClick={() => setActiveTab('portfolio')}
          style={{ 
            padding: '1rem 0.5rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'portfolio' ? '2px solid var(--color-blue)' : '2px solid transparent',
            color: activeTab === 'portfolio' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Activity size={16} /> Portfolio
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          style={{ 
            padding: '1rem 0.5rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'history' ? '2px solid var(--color-blue)' : '2px solid transparent',
            color: activeTab === 'history' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Clock size={16} /> Transaction History
        </button>
        <button 
          onClick={() => setActiveTab('health')}
          style={{ 
            padding: '1rem 0.5rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'health' ? '2px solid var(--color-blue)' : '2px solid transparent',
            color: activeTab === 'health' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Sparkles size={16} className="text-yellow" /> Portfolio Health
        </button>
        <button
          onClick={() => setActiveTab('advice')}
          style={{ padding: '1rem 0.5rem', background: 'none', border: 'none',
            borderBottom: activeTab === 'advice' ? '2px solid var(--color-blue)' : '2px solid transparent',
            color: activeTab === 'advice' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
        ><Target size={16} /> Order Planner</button>
        <button 
          onClick={() => setActiveTab('market')}
          style={{ 
            padding: '1rem 0.5rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'market' ? '2px solid var(--color-blue)' : '2px solid transparent',
            color: activeTab === 'market' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Search size={16} /> Market Intelligence
        </button>
        <button 
          onClick={() => setActiveTab('holdingHistory')}
          style={{ 
            padding: '1rem 0.5rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'holdingHistory' ? '2px solid var(--color-blue)' : '2px solid transparent',
            color: activeTab === 'holdingHistory' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <BarChart2 size={16} /> Holding History
        </button>
        <button 
          onClick={() => setActiveTab('simulator')}
          style={{ 
            padding: '1rem 0.5rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'simulator' ? '2px solid var(--color-blue)' : '2px solid transparent',
            color: activeTab === 'simulator' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Target size={16} /> Simulation Lab
        </button>
        <button
          onClick={() => setActiveTab('wealth')}
          style={{
            padding: '1rem 0.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'wealth' ? '2px solid var(--color-green)' : '2px solid transparent',
            color: activeTab === 'wealth' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Sparkles size={16} className="text-green" /> Wealth Center
        </button>
        <button
          onClick={() => setActiveTab('benchmarks')}
          style={{
            padding: '1rem 0.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'benchmarks' ? '2px solid var(--color-yellow)' : '2px solid transparent',
            color: activeTab === 'benchmarks' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Coins size={16} className="text-yellow" /> Gold & USD
        </button>
      </div>

      <main className="main-content">
        {activeTab === 'wealth' && <WealthCenter holdings={holdings} transactions={transactions} walletBalance={walletBalance} />}
        {activeTab === 'benchmarks' && <BenchmarkCenter holdings={holdings} transactions={transactions} walletBalance={walletBalance} />}
        {activeTab === 'advice' && <SwingAdvice holdings={holdings} transactions={transactions} />}
        {activeTab === 'market' && <MarketIntelligence watchlist={watchlist} setWatchlist={setWatchlist} marketData={marketData} analyticsData={analyticsData} setAnalysisStock={setAnalysisStock} shariaTickers={SHARIA_TICKERS} onSelectStock={setSelectedStockTicker} />}
        {activeTab === 'simulator' && <StrategySimulator holdings={holdings} analyticsData={analyticsData} totalMarketValue={totalMarketValue} />}
        {activeTab === 'health' && (
          <>
            <ConcentrationPanel
              holdings={holdings}
              clusterMap={clusterMap} setClusterMap={setClusterMap}
              cpiRate={cpiRate} setCpiRate={setCpiRate}
              cashYield={cashYield} setCashYield={setCashYield}
            />
            <PerformanceDashboard transactions={transactions} holdings={holdings} analyticsData={analyticsData} walletBalance={walletBalance} marketData={marketData} />
          </>
        )}
        {activeTab === 'holdingHistory' && <HoldingHistory holdings={holdings} analyticsData={analyticsData} transactions={transactions} />}

        {activeTab === 'portfolio' && (
          <>
            <div className="top-cards-row">
              {/* Equity */}
              <div className="card" style={{ borderLeft: '4px solid var(--color-blue)' }}>
                <div className="card-header"><span className="card-title text-blue">Equity</span><Wallet size={20} className="text-blue" /></div>
                <h2 className="mono" style={{ fontSize: '2rem' }}>EGP {cardMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Basis EGP {cardInvested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>

              {/* Unrealized P&L */}
              <div className="card" style={{ borderLeft: `4px solid ${cardUnrealizedPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)'}` }}>
                <div className="card-header"><span className="card-title" style={{ color: cardUnrealizedPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>Unrealized P&L</span>{cardUnrealizedPnL >= 0 ? <ArrowUpRight size={20} className="text-green" /> : <ArrowDownRight size={20} className="text-red" />}</div>
                <h2 className="mono" style={{ fontSize: '2rem', color: cardUnrealizedPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{cardUnrealizedPnL >= 0 ? '+' : ''}{cardUnrealizedPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{cardUnrealizedPct.toFixed(2)}% Performance</p>
              </div>

              {/* Realized P&L */}
              <div className="card" style={{ borderLeft: `4px solid ${cardRealizedPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)'}` }}>
                <div className="card-header">
                  <span className="card-title" style={{ color: cardRealizedPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>Realized P&L</span>
                  {cardRealizedPnL >= 0 ? <TrendingUp size={20} className="text-green" /> : <ArrowDownRight size={20} className="text-red" />}
                </div>
                <h2 className="mono" style={{ fontSize: '2rem', color: cardRealizedPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                  {cardRealizedPnL >= 0 ? '+' : ''}EGP {cardRealizedPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {cardSoldPositions > 0 ? `${cardSoldPositions} sell transaction${cardSoldPositions > 1 ? 's' : ''}` : 'No closed sales'}
                </p>
                {cardRealizedPnL > 0 && (
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed var(--border-color)' }}
                     title="Realized gains that were not withdrawn remain deployed as market exposure — they are not banked cash.">
                    Withdrawn: EGP {cardWithdrawn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    {' · '}
                    Redeployed: EGP {Math.max(0, cardRealizedPnL - cardWithdrawn).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                )}
              </div>

              {/* Wallet Balance — global only (deposits are cross-broker) */}
              <div className="card" style={{ borderLeft: '4px solid var(--color-yellow)' }}>
                <div className="card-header"><span className="card-title text-yellow">Wallet Balance</span><DollarSign size={20} className="text-yellow" /></div>
                <h2 className="mono" style={{ fontSize: '2rem' }}>EGP {walletBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {portfolioBrokerFilter !== 'ALL' ? 'Portfolio-wide cash' : 'Available Liquid Cash'}
                </p>
                {walletBalance > 0 && (() => {
                  const realDragAnnual = cpiRate - cashYield; // net % lost to inflation per year
                  const monthlyLoss = walletBalance * (realDragAnnual / 100) / 12;
                  // Days idle: since most recent Buy/Sell (last time cash was actively deployed)
                  const deployDates = (transactions || [])
                    .filter(t => (t.type === 'Buy' || t.type === 'Sell') && t.date)
                    .map(t => t.date).sort((a, b) => b.localeCompare(a));
                  let daysIdle = 0;
                  if (deployDates[0]) {
                    daysIdle = Math.max(0, Math.round((Date.now() - new Date(deployDates[0] + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24)));
                  }
                  const lostWhileIdle = monthlyLoss * (daysIdle / 30);
                  if (realDragAnnual <= 0) return null;
                  return (
                    <div style={{ fontSize: '0.72rem', color: '#f97316', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div>Earning {cashYield}% · real value −{monthlyLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo at {cpiRate}% CPI</div>
                      {daysIdle > 0 && (
                        <div style={{ opacity: 0.9 }}>{daysIdle}d idle · ≈{lostWhileIdle.toLocaleString(undefined, { maximumFractionDigits: 0 })} EGP real value lost</div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Dividends */}
              <div className="card" style={{ borderLeft: '4px solid var(--color-green)', background: 'linear-gradient(135deg, rgba(16,185,129,0.07) 0%, transparent 100%)' }}>
                <div className="card-header"><span className="card-title text-green">Dividends</span><ArrowUpRight size={20} className="text-green" /></div>
                <h2 className="mono" style={{ fontSize: '2rem', color: 'var(--color-green)' }}>EGP {cardDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {Object.keys(cardDividendsByTicker).length > 0
                    ? `${Object.keys(cardDividendsByTicker).length} source${Object.keys(cardDividendsByTicker).length > 1 ? 's' : ''}`
                    : 'No dividends recorded'}
                </p>
                {(() => {
                  const totalStockDivShares = Object.values(stockDividendsByTicker).reduce((s, v) => s + v, 0);
                  if (totalStockDivShares <= 0) return null;
                  const stockDivSources = Object.keys(stockDividendsByTicker).length;
                  return (
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-blue)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      📈 +{totalStockDivShares.toLocaleString()} shares received ({stockDivSources} stock div{stockDivSources > 1 ? 's' : ''})
                    </p>
                  );
                })()}
              </div>

              {/* Total Return */}
              <div className="card" style={{ borderLeft: `4px solid ${((cardUnrealizedPnL || 0) + (cardRealizedPnL || 0) + (cardDividends || 0)) >= 0 ? 'var(--color-green)' : 'var(--color-red)'}`, background: 'gradient(135deg, rgba(59,130,246,0.05) 0%, transparent 100%)' }}>
                {(() => {
                  const uPnL = cardUnrealizedPnL || 0;
                  const rPnL = cardRealizedPnL || 0;
                  const divCol = cardDividends || 0;
                  const combinedTotalReturn = uPnL + rPnL + divCol;
                  const baseCap = (cardInvested && cardInvested > 0) ? cardInvested : (totalDeposited || 0);
                  const totalReturnPct = baseCap > 0 ? (combinedTotalReturn / baseCap) * 100 : 0;

                  // Join date: broker-specific or global
                  const joinDate = cardJoinDate ?? (() => {
                    const buyTxDates = (transactions || []).filter(t => t.type === 'Buy' && t.date).map(t => t.date).sort((a, b) => a.localeCompare(b));
                    const allTxDates = (transactions || []).map(t => t.date).filter(Boolean).sort((a, b) => a.localeCompare(b));
                    return buyTxDates[0] ?? allTxDates[0] ?? '';
                  })();

                  let daysSinceJoined = 0;
                  if (joinDate) {
                    const joinTime = new Date(joinDate + 'T00:00:00').getTime();
                    daysSinceJoined = Math.max(1, Math.round((Date.now() - joinTime) / (1000 * 60 * 60 * 24)));
                  }

                  return (
                    <>
                      <div className="card-header">
                        <span className="card-title" style={{ color: combinedTotalReturn >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>Total Return</span>
                        {combinedTotalReturn >= 0 ? <ArrowUpRight size={20} className="text-green" /> : <ArrowDownRight size={20} className="text-red" />}
                      </div>
                      <h2 className="mono" style={{ fontSize: '2rem', color: combinedTotalReturn >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                        {combinedTotalReturn >= 0 ? '+' : ''}EGP {combinedTotalReturn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </h2>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {totalReturnPct >= 0 ? '+' : ''}{totalReturnPct.toFixed(2)}% Overall (Unrealized + Realized + Dividends)
                      </p>
                      {portfolioXirr !== null && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}
                           title="Money-weighted annualized return (XIRR). Unlike the simple %, this accounts for when capital was actually deployed — progressive deposits since April are weighted by their timing. Annualizing a sub-year window extrapolates heavily and overstates a durable rate.">
                          Money-weighted: <strong className="mono" style={{ color: portfolioXirr >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{portfolioXirr >= 0 ? '+' : ''}{(portfolioXirr * 100).toFixed(1)}%/yr</strong> <span style={{ opacity: 0.7 }}>(XIRR{daysSinceJoined < 365 ? `, annualized from ${daysSinceJoined}d` : ''})</span>
                        </p>
                      )}
                      {joinDate && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', opacity: 0.9, marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{portfolioBrokerFilter !== 'ALL' ? `${portfolioBrokerFilter} since:` : 'Joined Market:'}</span>
                            <strong className="mono" style={{ color: 'var(--text-primary)' }}>
                              {new Date(joinDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} ({daysSinceJoined}d)
                            </strong>
                          </div>
                          {portfolioBrokerFilter === 'ALL' && (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Alpha vs EGX30:</span>
                                <strong className="mono" style={{ color: egx30Alpha !== null ? (egx30Alpha >= 0 ? 'var(--color-green)' : 'var(--color-red)') : 'var(--text-secondary)' }}>
                                  {egx30Alpha !== null ? `${egx30Alpha >= 0 ? '+' : ''}${egx30Alpha.toFixed(2)}%` : '—'}
                                </strong>
                              </div>
                              {egx30Return !== null && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.85 }}>
                                  <span>EGX30 same window:</span>
                                  <strong className="mono" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                                    {egx30Return >= 0 ? '+' : ''}{egx30Return.toFixed(2)}%
                                  </strong>
                                </div>
                              )}
                              {egx30Alpha !== null && daysSinceJoined < 365 && (
                                <div style={{ fontSize: '0.68rem', color: '#f97316', opacity: 0.95, fontStyle: 'italic', marginTop: '1px' }}>
                                  Over {daysSinceJoined}d in one market regime — too short to indicate skill.
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                      {combinedTotalReturn > 0 && (() => {
                        const parts = [
                          { label: 'Unrealized', val: uPnL, color: 'var(--color-blue)' },
                          { label: 'Realized', val: rPnL, color: 'var(--color-green)' },
                          { label: 'Dividends', val: divCol, color: 'var(--color-yellow)' },
                        ].filter(p => p.val > 0);
                        const totalPos = parts.reduce((s, p) => s + p.val, 0) || 1;
                        const unrealizedShare = Math.round((Math.max(0, uPnL) / totalPos) * 100);
                        return (
                          <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)' }}>
                            <div style={{ display: 'flex', height: '7px', borderRadius: '4px', overflow: 'hidden', background: 'var(--bg-card)' }}>
                              {parts.map(p => (
                                <div key={p.label} title={`${p.label}: ${p.val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} style={{ width: `${(p.val / totalPos) * 100}%`, background: p.color }} />
                              ))}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span><strong style={{ color: unrealizedShare >= 70 ? '#f97316' : 'var(--text-primary)' }}>{unrealizedShare}% unrealized</strong> · not yet banked</span>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0 }}>
              <div className="card-header" style={{ padding: '0.85rem 1.25rem', marginBottom: 0, borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h3 className="card-title" style={{ fontSize: '1.05rem', margin: 0, flex: '1 1 auto' }}>Active Holdings</h3>
                {staleData && <div className="badge badge-yellow" style={{ fontSize: '0.7rem' }}><AlertTriangle size={12} /> Prices Stale</div>}
                {/* Broker Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Broker:</label>
                  <select
                    value={portfolioBrokerFilter}
                    onChange={e => setPortfolioBrokerFilter(e.target.value)}
                    style={{
                      fontSize: '0.78rem',
                      padding: '3px 8px',
                      background: '#1e2130',
                      color: '#e2e8f0',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="ALL" style={{ background: '#1e2130', color: '#e2e8f0' }}>All Brokers</option>
                    {uniquePortfolioBrokers.map(b => (
                      <option key={b} value={b} style={{ background: '#1e2130', color: '#e2e8f0' }}>{b}</option>
                    ))}
                  </select>
                  {portfolioBrokerFilter !== 'ALL' && (
                    <button
                      onClick={() => setPortfolioBrokerFilter('ALL')}
                      title="Clear broker filter"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '2px' }}
                    >
                      <FilterX size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => requestSort('ticker')} style={{ cursor: 'pointer' }}>Ticker <SortIndicator column="ticker" /></th>
                    <th>Company Name</th>
                    <th onClick={() => requestSort('shares')} style={{ cursor: 'pointer', textAlign: 'right' }}>Shares <SortIndicator column="shares" /></th>
                    <th onClick={() => requestSort('avgCost')} style={{ cursor: 'pointer', textAlign: 'right' }}>Avg Cost <SortIndicator column="avgCost" /></th>
                    <th style={{ textAlign: 'right' }}>Purchased Value</th>
                    <th onClick={() => requestSort('livePrice')} style={{ cursor: 'pointer', textAlign: 'right' }}>Live Price <SortIndicator column="livePrice" /></th>
                    <th style={{ textAlign: 'right' }}>Market Value</th>
                    <th style={{ textAlign: 'right' }}>Unrealized P&L</th>
                    <th style={{ textAlign: 'right' }}>Realized P&L</th>
                    <th style={{ textAlign: 'right' }} title="Highest historical P&L achieved (stock price at peak in brackets)">Max P&L ▲</th>
                    <th style={{ textAlign: 'right' }} title="Lowest historical P&L achieved (stock price at trough in brackets)">Min P&L ▼</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedHoldings(displayedHoldings).map(h => {
                    const value = h.shares * h.livePrice;
                    const pnl = value - h.totalCost;
                    const pnlPct = h.totalCost > 0 ? (pnl / h.totalCost) * 100 : 0;
                    
                    const extreme = pnlExtremes[h.ticker];
                    const isNewPeak = extreme && pnl > extreme.maxPnl;
                    const closedInfo = closedPositions.find(p => p.ticker === h.ticker);
                    const stockRealized = closedInfo ? closedInfo.realizedPnL : 0;
                    return (
                      <tr 
                        key={h.ticker} 
                        className="clickable-row"
                        onClick={() => setSelectedStockTicker(h.ticker)}
                        title="Click to view detailed buying/selling history, dividends & stock info"
                        style={{ background: isNewPeak ? 'rgba(250, 204, 21, 0.08)' : pnl >= 0 ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)' }}
                      >
                        <td style={{ fontWeight: 700 }}>{h.ticker}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{h.company}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{h.shares}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{h.avgCost.toFixed(2)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{h.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{h.livePrice.toFixed(2)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="mono" style={{ textAlign: 'right', color: isNewPeak ? '#facc15' : pnl >= 0 ? 'var(--color-green)' : 'var(--color-red)', fontWeight: isNewPeak ? 700 : 400 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                            {isNewPeak && <span style={{ fontSize: '0.62rem', background: 'rgba(250,204,21,0.2)', color: '#facc15', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>NEW MAX ★</span>}
                            <span>{pnl >= 0 ? '+' : ''}{pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                          </div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</div>
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: stockRealized > 0 ? 'var(--color-green)' : stockRealized < 0 ? 'var(--color-red)' : 'var(--text-secondary)' }}>
                          {stockRealized !== 0 ? `${stockRealized >= 0 ? '+' : ''}${stockRealized.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {extreme ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <span style={{ color: extreme.maxPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)', fontWeight: 600, fontSize: '0.85rem' }}>
                                {extreme.maxPnl >= 0 ? '+' : ''}{extreme.maxPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                {extreme.maxPnlPrice != null && extreme.maxPnlPrice > 0 && (
                                  <span style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 400, marginLeft: '3px' }}>
                                    ({extreme.maxPnlPrice.toFixed(2)})
                                  </span>
                                )}
                              </span>
                              <span style={{ fontSize: '0.65rem', color: extreme.maxPnlPct >= 0 ? 'var(--color-green)' : 'var(--color-red)', opacity: 0.8 }}>
                                {extreme.maxPnlPct >= 0 ? '+' : ''}{extreme.maxPnlPct.toFixed(2)}%
                              </span>
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {new Date(extreme.maxPnlDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>—</span>
                          )}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          {extreme ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <span style={{ color: extreme.minPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)', fontWeight: 600, fontSize: '0.85rem' }}>
                                {extreme.minPnl >= 0 ? '+' : ''}{extreme.minPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                {extreme.minPnlPrice != null && extreme.minPnlPrice > 0 && (
                                  <span style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 400, marginLeft: '3px' }}>
                                    ({extreme.minPnlPrice.toFixed(2)})
                                  </span>
                                )}
                              </span>
                              <span style={{ fontSize: '0.65rem', color: extreme.minPnlPct >= 0 ? 'var(--color-green)' : 'var(--color-red)', opacity: 0.8 }}>
                                {extreme.minPnlPct >= 0 ? '+' : ''}{extreme.minPnlPct.toFixed(2)}%
                              </span>
                              <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {new Date(extreme.minPnlDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 1.25rem', borderTop: '1px solid var(--border-color)', fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.1)' }}>
                <span>
                  Active Positions: <strong>{displayedHoldings.length}</strong>
                  {portfolioBrokerFilter !== 'ALL' && (
                    <span style={{ marginLeft: '0.5rem', color: 'var(--color-blue)' }}>
                      · {portfolioBrokerFilter} only
                    </span>
                  )}
                </span>
                <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: '0.78rem' }} onClick={() => exportToCSV(displayedHoldings, portfolioBrokerFilter !== 'ALL' ? `portfolio_${portfolioBrokerFilter.toLowerCase()}` : 'portfolio_holdings')}>
                  Export CSV
                </button>
              </div>
            </div>
          <TotalReturnHistory transactions={transactions} />

          {/* Dividend Breakdown & Projections Panel */}
          {(holdings.length > 0 || Object.keys(dividendsByTicker).length > 0 || Object.keys(stockDividendsByTicker).length > 0) && (() => {
            const tickerSet = new Set<string>();
            holdings.forEach(h => tickerSet.add(h.ticker));
            Object.keys(dividendsByTicker).forEach(t => tickerSet.add(t));
            Object.keys(stockDividendsByTicker).forEach(t => tickerSet.add(t));

            const divItems = Array.from(tickerSet).map(ticker => {
              const holding = holdings.find(h => h.ticker === ticker);
              const companyMeta = COMPANY_META[ticker];
              const company = holding?.company || companyMeta?.company || ticker;
              const amountReceived = dividendsByTicker[ticker] || 0;
              
              const divMeta = DIVIDEND_META[ticker] || { frequency: 'Yearly' as const };
              const frequency = divMeta.frequency;

              let expectedAnnualDividend = 0;
              let expectedYieldPct = 0;

              if (holding && holding.shares > 0) {
                const livePrice = holding.livePrice || 0;
                const fnYield = analyticsData[ticker]?.fundamentals?.dividendYield;

                if (divMeta.defaultDps && divMeta.defaultDps > 0) {
                  expectedAnnualDividend = holding.shares * divMeta.defaultDps;
                  expectedYieldPct = livePrice > 0 ? (divMeta.defaultDps / livePrice) * 100 : 0;
                } else if (fnYield && fnYield > 0 && livePrice > 0) {
                  expectedYieldPct = fnYield;
                  expectedAnnualDividend = holding.shares * livePrice * (fnYield / 100);
                }
              }

              const yieldOnCost = holding && holding.totalCost > 0 && amountReceived > 0
                ? ((amountReceived / holding.totalCost) * 100).toFixed(2)
                : '—';

              const pct = dividendsCollected > 0
                ? ((amountReceived / dividendsCollected) * 100).toFixed(1)
                : '0.0';

              return {
                ticker,
                company,
                shares: holding?.shares || 0,
                amountReceived,
                pct,
                yieldOnCost,
                frequency,
                notes: divMeta.notes,
                expectedAnnualDividend,
                expectedYieldPct,
                totalCost: holding?.totalCost || 0,
                isActive: Boolean(holding && holding.shares > 0),
                stockDivShares: stockDividendsByTicker[ticker] || 0
              };
            }).sort((a, b) => {
              if (b.amountReceived !== a.amountReceived) return b.amountReceived - a.amountReceived;
              if (b.expectedAnnualDividend !== a.expectedAnnualDividend) return b.expectedAnnualDividend - a.expectedAnnualDividend;
              return a.ticker.localeCompare(b.ticker);
            });

            const totalEstAnnualIncome = divItems.reduce((sum, i) => sum + i.expectedAnnualDividend, 0);

            return (
              <div className="card" style={{ marginTop: '1.5rem' }}>
                <div className="card-header" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem' }}>
                      <Coins size={20} className="text-green" /> Dividend Income & Expected Yield
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Track received dividend payouts and projected annual dividends across all your portfolio stocks
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Total Received To Date</span>
                      <strong className="mono text-green" style={{ fontSize: '1.1rem' }}>
                        +EGP {dividendsCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div style={{ borderLeft: '1px solid var(--border-color)', height: '30px' }} />
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Est. Annual Income</span>
                      <strong className="mono text-blue" style={{ fontSize: '1.1rem' }}>
                        EGP {totalEstAnnualIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Company</th>
                        <th style={{ textAlign: 'center' }}>Payout Frequency</th>
                        <th style={{ textAlign: 'right' }}>Est. Annual Dividend</th>
                        <th style={{ textAlign: 'right' }}>Total Received (EGP)</th>
                        <th style={{ textAlign: 'right' }}>Stock Div Shares</th>
                        <th style={{ textAlign: 'right' }}>% of Total Received</th>
                        <th style={{ textAlign: 'right' }}>Yield on Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {divItems.map(item => {
                        const freqBadgeClass = 
                          item.frequency === 'Yearly' ? 'badge-blue' :
                          item.frequency === 'Semi-Annually' ? 'badge-green' :
                          item.frequency === 'Quarterly' ? 'badge-yellow' : 'badge-purple';

                        return (
                          <tr 
                            key={item.ticker} 
                            className="clickable-row" 
                            onClick={() => setSelectedStockTicker(item.ticker)}
                            title="Click to view stock details & dividend history"
                          >
                            <td style={{ fontWeight: 700 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {item.ticker}
                                {!item.isActive && (
                                  <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>Closed</span>
                                )}
                              </div>
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                              {item.company}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <div>
                                <span className={`badge ${freqBadgeClass}`} style={{ fontSize: '0.75rem' }}>
                                  {item.frequency}
                                </span>
                                {item.notes && (
                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'block', marginTop: '3px' }}>
                                    {item.notes}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="mono" style={{ textAlign: 'right' }}>
                              {item.expectedAnnualDividend > 0 ? (
                                <div>
                                  <span style={{ fontWeight: 600, color: 'var(--color-blue)' }}>
                                    EGP {item.expectedAnnualDividend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>
                                    ({item.expectedYieldPct.toFixed(1)}% yield)
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>—</span>
                              )}
                            </td>
                            <td className="mono" style={{ textAlign: 'right' }}>
                              {item.amountReceived > 0 ? (
                                <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>
                                  +EGP {item.amountReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>EGP 0.00</span>
                              )}
                            </td>
                            <td className="mono" style={{ textAlign: 'right' }}>
                              {item.stockDivShares > 0 ? (
                                <span style={{ color: 'var(--color-blue)', fontWeight: 600 }}>
                                  +{item.stockDivShares.toLocaleString()} shares
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>—</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                <div style={{ width: '70px', height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                                  <div style={{ width: `${item.pct}%`, height: '100%', background: 'var(--color-green)', borderRadius: '3px' }} />
                                </div>
                                <span className="mono" style={{ fontSize: '0.85rem' }}>{item.pct}%</span>
                              </div>
                            </td>
                            <td className="mono" style={{ textAlign: 'right', color: item.yieldOnCost !== '—' ? 'var(--color-blue)' : 'var(--text-secondary)' }}>
                              {item.yieldOnCost !== '—' ? `${item.yieldOnCost}%` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span>* <strong>Payout Frequency</strong>: Based on official EGX dividend distribution policy (Yearly vs. Semi-Annually).</span>
                  <span>* <strong>Yield on Cost</strong> = Total received dividends ÷ Cost basis of that holding.</span>
                </div>
              </div>
            );
          })()}

          {/* Closed Positions (Realized) Panel */}
          {closedPositions.length > 0 && (
            <div className="card" style={{ marginTop: '1.5rem' }}>
              <div className="card-header" style={{ padding: '1.5rem' }}>
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={18} className="text-blue" /> Closed Positions <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-secondary)' }}>(Realized)</span>
                </h3>
                {(() => {
                  const totalRealized = closedPositions.reduce((s, p) => s + p.realizedPnL, 0);
                  return (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Net realized:{' '}
                      <strong style={{ color: totalRealized >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                        {totalRealized >= 0 ? '+' : ''}EGP {totalRealized.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </strong>
                    </span>
                  );
                })()}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ticker</th>
                      <th>Company</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'right' }}>Shares Sold</th>
                      <th style={{ textAlign: 'right' }}>Avg Buy</th>
                      <th style={{ textAlign: 'right' }}>Avg Sell</th>
                      <th style={{ textAlign: 'right' }} title="Current live market price of the stock">Current Price</th>
                      <th style={{ textAlign: 'right' }} title="Neutral reference: current price vs the price you sold at. A short-term move after a sale is market noise, not a measure of the exit decision.">Price vs Exit</th>
                      <th style={{ textAlign: 'right' }}>Cost Basis</th>
                      <th style={{ textAlign: 'right' }}>Proceeds</th>
                      <th style={{ textAlign: 'right' }}>Realized P&L</th>
                      <th style={{ textAlign: 'right' }}>Dividends</th>
                      <th style={{ textAlign: 'right' }}>Total Return</th>
                      <th style={{ textAlign: 'right' }}>Held</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closedPositions.map(p => (
                      <tr 
                        key={p.ticker} 
                        className="clickable-row"
                        onClick={() => setSelectedStockTicker(p.ticker)}
                        title="Click to view closed position details, buy/sell history & dividends"
                        style={{ background: p.realizedPnL >= 0 ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)' }}
                      >
                        <td style={{ fontWeight: 700 }}>{p.ticker}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{p.company}</td>
                        <td style={{ textAlign: 'center' }}>
                          {p.isFullyClosed
                            ? <span className="badge badge-blue" style={{ fontSize: '0.65rem' }}>Closed</span>
                            : <span className="badge badge-yellow" style={{ fontSize: '0.65rem' }}>Partial · {p.openShares} left</span>}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>{p.soldShares.toLocaleString()}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{p.avgBuyPrice.toFixed(2)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{p.avgSellPrice.toFixed(2)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                          {p.livePrice > 0 ? p.livePrice.toFixed(2) : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {p.livePrice > 0 && p.avgSellPrice > 0 ? (
                            <div>
                              <div style={{ fontSize: '0.82rem' }}>
                                {p.livePrice.toFixed(2)} {p.postSellDiffPct >= 0 ? '+' : ''}{p.postSellDiffPct.toFixed(2)}%
                              </div>
                              <div style={{ fontSize: '0.66rem', opacity: 0.8 }}>
                                sold at {p.avgSellPrice.toFixed(2)}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>—</span>
                          )}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{p.costBasisSold.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{p.netProceeds.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="mono" style={{ textAlign: 'right', color: p.realizedPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)', fontWeight: 600 }}>
                          <div>{p.realizedPnL >= 0 ? '+' : ''}{p.realizedPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{p.realizedPnLPct >= 0 ? '+' : ''}{p.realizedPnLPct.toFixed(2)}%</div>
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: p.dividends > 0 ? 'var(--color-green)' : 'var(--text-secondary)' }}>
                          {p.dividends > 0 ? `+${p.dividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: p.totalReturn >= 0 ? 'var(--color-green)' : 'var(--color-red)', fontWeight: 700 }}>
                          {p.totalReturn >= 0 ? '+' : ''}{p.totalReturn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{p.holdingDays}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Realized P&L = Net sale proceeds − average cost basis of sold shares. <strong>Price since exit</strong> is shown as a neutral reference only — a short-term price move after a sale reflects market noise, not the quality of the exit decision.
              </div>
            </div>
          )}
          </>
        )}

        {activeTab === 'history' && (
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card-header" style={{ padding: '1.5rem 1.5rem 0.5rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 className="card-title" style={{ fontSize: '1.25rem' }}>Transaction History</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Showing <strong>{sortedTransactions.length}</strong> of <strong>{transactions.length}</strong> transactions
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {hasHistoryFilters && (
                  <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--color-red)' }} onClick={resetHistoryFilters}>
                    <FilterX size={14} /> Clear Filters
                  </button>
                )}
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => exportToCSV(sortedTransactions, 'transaction_history')}>
                  Export CSV ({sortedTransactions.length})
                </button>
                <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setIsModalOpen(true)}>
                  <Plus size={16} /> <span>Add New</span>
                </button>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div style={{ padding: '0 1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', alignItems: 'center' }}>
              {/* Search Bar */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Search ticker, broker..." 
                  value={historySearch} 
                  onChange={e => setHistorySearch(e.target.value)} 
                  style={{ paddingLeft: '30px', fontSize: '0.8rem', height: '34px' }}
                />
              </div>

              {/* Type Filter */}
              <div>
                <select 
                  className="input-field" 
                  value={historyTypeFilter} 
                  onChange={e => setHistoryTypeFilter(e.target.value)}
                  style={{ fontSize: '0.8rem', height: '34px' }}
                >
                  <option value="ALL">All Types</option>
                  <option value="Buy">Buy</option>
                  <option value="Sell">Sell</option>
                  <option value="Deposit">Deposit</option>
                  <option value="Withdraw">Withdraw</option>
                  <option value="Dividend">Dividend</option>
                </select>
              </div>

              {/* Symbol / Ticker Filter */}
              <div>
                <select 
                  className="input-field" 
                  value={historyTickerFilter} 
                  onChange={e => setHistoryTickerFilter(e.target.value)}
                  style={{ fontSize: '0.8rem', height: '34px' }}
                >
                  <option value="ALL">All Symbols</option>
                  {uniqueHistoryTickers.map(tk => (
                    <option key={tk} value={tk}>{tk}</option>
                  ))}
                </select>
              </div>

              {/* Broker Filter */}
              <div>
                <select 
                  className="input-field" 
                  value={historyBrokerFilter} 
                  onChange={e => setHistoryBrokerFilter(e.target.value)}
                  style={{ fontSize: '0.8rem', height: '34px' }}
                >
                  <option value="ALL">All Brokers</option>
                  {uniqueHistoryBrokers.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div>
                <input 
                  type="date" 
                  className="input-field" 
                  value={historyDateFrom} 
                  onChange={e => setHistoryDateFrom(e.target.value)}
                  placeholder="From Date"
                  title="Filter transactions from date"
                  style={{ fontSize: '0.8rem', height: '34px' }}
                />
              </div>

              {/* Date To */}
              <div>
                <input 
                  type="date" 
                  className="input-field" 
                  value={historyDateTo} 
                  onChange={e => setHistoryDateTo(e.target.value)}
                  placeholder="To Date"
                  title="Filter transactions to date"
                  style={{ fontSize: '0.8rem', height: '34px' }}
                />
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto', padding: '0 1.5rem 1.5rem 1.5rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => handleHistorySort('date')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Date {historySort.key === 'date' ? (historySort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th onClick={() => handleHistorySort('ticker')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Symbol {historySort.key === 'ticker' ? (historySort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th onClick={() => handleHistorySort('type')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Type {historySort.key === 'type' ? (historySort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th onClick={() => handleHistorySort('broker')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Broker {historySort.key === 'broker' ? (historySort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th onClick={() => handleHistorySort('quantity')} style={{ cursor: 'pointer', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      Qty {historySort.key === 'quantity' ? (historySort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th onClick={() => handleHistorySort('price')} style={{ cursor: 'pointer', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      Price {historySort.key === 'price' ? (historySort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th onClick={() => handleHistorySort('fees')} style={{ cursor: 'pointer', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      Fees {historySort.key === 'fees' ? (historySort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th onClick={() => handleHistorySort('total')} style={{ cursor: 'pointer', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      Total {historySort.key === 'total' ? (historySort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTransactions.map(tx => {
                    const totalVal = (tx.quantity ? (tx.quantity * tx.price) : tx.price) + (tx.fees || 0);
                    return (
                      <tr key={tx.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{tx.date}</td>
                        <td 
                          style={{ fontWeight: 700, cursor: (tx.ticker && ['Buy','Sell','Dividend'].includes(tx.type)) ? 'pointer' : 'default', color: (tx.ticker && ['Buy','Sell','Dividend'].includes(tx.type)) ? 'var(--color-blue)' : 'var(--text-secondary)' }}
                          onClick={() => tx.ticker && ['Buy','Sell','Dividend'].includes(tx.type) && setSelectedStockTicker(tx.ticker)}
                          title={(tx.ticker && ['Buy','Sell','Dividend'].includes(tx.type)) ? "Click to view stock history & details" : ""}
                        >
                          {['Buy', 'Sell', 'Dividend'].includes(tx.type) ? (tx.ticker || '—') : '—'}
                        </td>
                        <td>
                          <span className={`badge ${
                            tx.type === 'Buy' ? 'badge-blue' : 
                            tx.type === 'Sell' ? 'badge-red' : 
                            tx.type === 'Deposit' ? 'badge-green' : 
                            tx.type === 'Withdraw' ? 'badge-yellow' : 'badge-purple'
                          }`}>{tx.type}</span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{tx.broker || 'Thunder'}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{tx.quantity ? tx.quantity.toLocaleString() : '-'}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{tx.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {(tx.fees || 0) > 0
                            ? (tx.fees || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : (tx.type === 'Buy' || tx.type === 'Sell')
                              ? <span title="No separate fee recorded — brokerage fees are embedded in the unit price for this trade." style={{ fontStyle: 'italic', opacity: 0.7 }}>incl.</span>
                              : '—'}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                          {totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button className="icon-btn" onClick={() => setEditingTransaction(tx)} title="Edit">
                              <Pencil size={14} className="text-blue" />
                            </button>
                            <button className="icon-btn" onClick={() => deleteTransaction(tx.id)} title="Delete">
                              <Trash2 size={16} className="text-red" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedTransactions.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                        {hasHistoryFilters ? 'No transactions match the selected filters.' : 'No transactions found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '0.75rem 1.5rem', fontSize: '0.72rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)' }}>
              <strong>Fees:</strong> <em>incl.</em> means no separate fee was recorded because brokerage fees are embedded in the unit price for that trade. A plain <em>0.00</em> would be misleading, so embedded-fee trades are marked explicitly.
            </div>
          </div>
        )}
      </main>



      {/* --- MODALS --- */}
      
      {isLearningOpen && (
        <div className="modal-overlay" onClick={() => setIsLearningOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '1000px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <BookOpen size={20} className="text-blue" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Learning Center</h2>
              </div>
              <button className="icon-btn" onClick={() => setIsLearningOpen(false)}><X size={20} /></button>
            </div>
            <div style={{ padding: '2rem' }}>
              <LearningCenter />
            </div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <SettingsIcon size={20} className="text-blue" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>AI Settings</h2>
              </div>
              <button className="icon-btn" onClick={() => setIsSettingsOpen(false)}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>AI Provider</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button className={aiSettings.provider === 'gemini' ? 'btn-primary' : 'btn-secondary'} onClick={() => saveSettings({...aiSettings, provider: 'gemini'})}>Gemini</button>
                  <button className={aiSettings.provider === 'openai' ? 'btn-primary' : 'btn-secondary'} onClick={() => saveSettings({...aiSettings, provider: 'openai'})}>OpenAI</button>
                </div>
              </div>
              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>API Key</label>
                <input 
                  type="password" 
                  className="input-field" 
                  value={aiSettings.provider === 'gemini' ? aiSettings.geminiKey : aiSettings.openaiKey} 
                  onChange={e => saveSettings({...aiSettings, [aiSettings.provider === 'gemini' ? 'geminiKey' : 'openaiKey']: e.target.value})}
                  placeholder={`Enter ${aiSettings.provider} key`}
                />
              </div>
              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>AI Model</label>
                {loadingModels ? (
                  <div style={{ padding: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    <RefreshCw size={14} className="spinning" style={{ marginRight: '8px' }} />
                    Discovering models...
                  </div>
                ) : (
                  <select 
                    className="input-field" 
                    value={aiSettings.model} 
                    onChange={e => saveSettings({...aiSettings, model: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Select a model</option>
                    {availableModels.map(m => {
                      const isRecommended = [
                        'gemini-2.5-flash', 
                        'gemini-flash-latest', 
                        'gemini-3-flash-preview',
                        'gemini-3.1-flash-lite-preview',
                        'gemini-2.5-flash-lite',
                        'gpt-4o',
                        'gpt-4o-mini'
                      ].includes(m);
                      return (
                        <option key={m} value={m}>
                          {m}{isRecommended ? ' (Recommended)' : ''}
                        </option>
                      );
                    })}
                    {availableModels.length === 0 && (
                      <option value={aiSettings.provider === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o'}>
                        {aiSettings.provider === 'gemini' ? 'gemini-2.0-flash (Default)' : 'gpt-4o (Default)'}
                      </option>
                    )}
                  </select>
                )}
              </div>
              <div>
                <label className="text-muted" style={{ display: 'block', marginBottom: '0.5rem' }}>Gold 21K Price (EGP / gram)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="input-field" 
                  value={aiSettings.goldPrice21k ?? 6502.73} 
                  onFocus={e => e.target.select()}
                  onChange={e => saveSettings({...aiSettings, goldPrice21k: parseFloat(e.target.value) || 6502.73})}
                  placeholder="6502.73"
                  style={{ width: '100%' }}
                />
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                  Nisab Threshold (85g of 21K Gold): <strong>EGP {Math.round(85 * (aiSettings.goldPrice21k ?? 6502.73)).toLocaleString()}</strong>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={() => setIsSettingsOpen(false)}>Close Settings</button>
                <button className="btn-secondary" style={{ color: 'var(--color-red)', borderColor: 'var(--color-red)' }} onClick={async () => {
                  if (confirm('Are you sure you want to reset all portfolio data to defaults?')) {
                    await fetch('/api/db/reset', { method: 'POST' });
                    localStorage.clear();
                    window.location.reload();
                  }
                }}>Reset Data</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(isModalOpen || editingTransaction) && (
        <TransactionForm
          initialData={editingTransaction || undefined}
          onClose={() => { setIsModalOpen(false); setEditingTransaction(null); }}
          onSave={async (tx) => {
            const id = editingTransaction ? editingTransaction.id : Date.now().toString();
            await saveTransaction({ ...tx, id });
            setIsModalOpen(false);
            setEditingTransaction(null);
          }}
        />
      )}

      {selectedStockTicker && (
        <StockDetailModal
          ticker={selectedStockTicker}
          transactions={transactions}
          holdings={holdings}
          closedPositions={closedPositions}
          dividendsByTicker={dividendsByTicker}
          marketData={marketData}
          pnlExtremes={pnlExtremes}
          onClose={() => setSelectedStockTicker(null)}
          onDeleteTransaction={deleteTransaction}
          onAddTransactionForTicker={(t) => {
            setEditingTransaction({
              id: '',
              date: new Date().toISOString().split('T')[0],
              type: 'Buy',
              ticker: t,
              price: 0,
              broker: 'Thndr',
              fees: 0
            });
            setIsModalOpen(true);
          }}
          onOpenAIAnalysis={(h) => {
            setAnalysisStock(h);
          }}
        />
      )}

      {historyStock && (
        <HistoryModal 
          ticker={historyStock} 
          transactions={transactions.filter(t => t.ticker === historyStock)} 
          onClose={() => setHistoryStock(null)} 
          onDelete={deleteTransaction}
        />
      )}

      {analysisStock && (
        <AIAnalysisModal 
          stock={analysisStock} 
          aiSettings={aiSettings}
          initialData={analyticsData[analysisStock.ticker]}
          onSave={saveAnalytics}
          onClose={() => setAnalysisStock(null)} 
        />
      )}

      {priceHistoryStock && (
        <PriceHistoryModal 
          stock={priceHistoryStock} 
          onClose={() => setPriceHistoryStock(null)} 
        />
      )}

    </div>
  );
}

// --- SUB-COMPONENTS ---

function TransactionForm({ onClose, onSave, initialData }: { onClose: () => void; onSave: (tx: any) => void; initialData?: Transaction }) {
  const isEdit = !!initialData;
  const [formData, setFormData] = useState({
    date: initialData?.date ?? new Date().toISOString().split('T')[0],
    type: (initialData?.type ?? 'Buy') as TransactionType,
    ticker: initialData?.ticker ?? 'SWDY',
    quantity: (initialData?.quantity !== undefined && initialData?.quantity !== 0) ? String(initialData.quantity) : '',
    price: (initialData?.price !== undefined && initialData?.price !== 0) ? String(initialData.price) : '',
    broker: initialData?.broker ?? 'Thunder',
    fees: (initialData?.fees !== undefined && initialData?.fees !== 0) ? String(initialData.fees) : '',
  });

  const handleSave = () => {
    const isStockType = ['Buy', 'Sell', 'Dividend', 'StockDividend'].includes(formData.type);
    const hasQuantity = ['Buy', 'Sell', 'StockDividend'].includes(formData.type);
    onSave({
      ...formData,
      ticker: isStockType ? formData.ticker : undefined,
      quantity: hasQuantity ? (formData.quantity === '' ? 0 : Number(formData.quantity)) : (formData.quantity === '' ? 0 : Number(formData.quantity)),
      price: formData.type === 'StockDividend' ? 0 : (formData.price === '' ? 0 : Number(formData.price)),
      fees: formData.type === 'StockDividend' ? 0 : (formData.fees === '' ? 0 : Number(formData.fees)),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isEdit ? <Pencil size={18} className="text-blue" /> : null}
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{isEdit ? 'Edit Transaction' : 'New Transaction'}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="grid-2" style={{ gap: '1rem' }}>
            <div>
              <label className="text-muted" style={{ fontSize: '0.8rem' }}>Type</label>
              <select className="input-field" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as TransactionType})}>
                <option value="Buy">Buy</option>
                <option value="Sell">Sell</option>
                <option value="Deposit">Deposit</option>
                <option value="Withdraw">Withdraw</option>
                <option value="Dividend">Dividend</option>
                <option value="StockDividend">Stock Dividend</option>
              </select>
            </div>
            <div>
              <label className="text-muted" style={{ fontSize: '0.8rem' }}>Date</label>
              <input type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            </div>
          </div>
          {['Buy', 'Sell', 'Dividend', 'StockDividend'].includes(formData.type) && (
            <div className={['Buy', 'Sell', 'StockDividend'].includes(formData.type) ? 'grid-2' : ''} style={{ gap: '1rem' }}>
              <div>
                <label className="text-muted" style={{ fontSize: '0.8rem' }}>
                  {formData.type === 'Dividend' ? 'Source Symbol (Stock)' : formData.type === 'StockDividend' ? 'Stock Received' : 'Ticker'}
                </label>
                <select
                  className="input-field"
                  value={formData.ticker || 'SWDY'}
                  onChange={e => setFormData({...formData, ticker: e.target.value})}
                  style={{ width: '100%', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                >
                  {formData.ticker && !COMPANY_META[formData.ticker] && (
                    <option value={formData.ticker}>{formData.ticker}</option>
                  )}
                  {Object.keys(COMPANY_META).sort().map(t => (
                    <option key={t} value={t}>
                      {t} - {COMPANY_META[t].company}
                    </option>
                  ))}
                </select>
              </div>
              {['Buy', 'Sell', 'StockDividend'].includes(formData.type) && (
                <div>
                  <label className="text-muted" style={{ fontSize: '0.8rem' }}>{formData.type === 'StockDividend' ? 'Shares Received' : 'Quantity'}</label>
                  <input 
                    type="number" 
                    step="any"
                    className="input-field" 
                    placeholder="0"
                    value={formData.quantity} 
                    onFocus={e => e.target.select()}
                    onChange={e => setFormData({...formData, quantity: e.target.value})} 
                  />
                </div>
              )}
            </div>
          )}
          {formData.type !== 'StockDividend' && (
          <div>
            <label className="text-muted" style={{ fontSize: '0.8rem' }}>{['Deposit', 'Withdraw', 'Dividend'].includes(formData.type) ? 'Amount (EGP)' : 'Price per Share (EGP)'}</label>
            <input 
              type="number" 
              step="any"
              className="input-field" 
              placeholder="0.00"
              value={formData.price} 
              onFocus={e => e.target.select()}
              onChange={e => setFormData({...formData, price: e.target.value})} 
            />
          </div>
          )}
          <div className="grid-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label className="text-muted" style={{ fontSize: '0.8rem' }}>Broker Name</label>
              <select 
                className="input-field" 
                value={formData.broker === 'Telda' ? 'Telda' : 'Thunder'} 
                onChange={e => setFormData({ ...formData, broker: e.target.value })}
                style={{ width: '100%', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              >
                <option value="Thunder">Thunder</option>
                <option value="Telda">Telda</option>
              </select>
            </div>
            <div className="form-group">
              <label className="text-muted" style={{ fontSize: '0.8rem' }}>Fees (EGP)</label>
              <input 
                type="number" 
                step="any"
                className="input-field" 
                placeholder="0"
                value={formData.fees} 
                onFocus={e => e.target.select()}
                onChange={e => setFormData({ ...formData, fees: e.target.value })} 
              />
            </div>
          </div>
          <button className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={handleSave}>
            {isEdit ? 'Update Transaction' : 'Save Transaction'}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ ticker, transactions, onClose, onDelete }: { ticker: string; transactions: Transaction[]; onClose: () => void; onDelete: (id: string) => void }) {
  const isGlobal = ticker === 'All Transactions';
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: isGlobal ? '800px' : '600px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{ticker}</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div style={{ padding: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                {isGlobal && <th>Symbol</th>}
                <th>Type</th>
                <th>Broker</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Fees</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...transactions].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).map(tx => (
                <tr key={tx.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{tx.date}</td>
                  {isGlobal && (
                    <td style={{ fontWeight: 700 }}>{tx.ticker || '-'}</td>
                  )}
                  <td>
                    <span className={`badge ${
                      tx.type === 'Buy' ? 'badge-blue' : 
                      tx.type === 'Sell' ? 'badge-red' : 
                      tx.type === 'Deposit' ? 'badge-green' : 
                      tx.type === 'Withdraw' ? 'badge-yellow' : 
                      tx.type === 'StockDividend' ? 'badge-green' : 'badge-purple'
                    }`}>{tx.type === 'StockDividend' ? 'Stock Div' : tx.type}</span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{tx.broker || 'Thunder'}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{tx.quantity || '-'}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>
                    {tx.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{tx.fees || 0}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="icon-btn" onClick={() => onDelete(tx.id)}>
                      <Trash2 size={14} className="text-red" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AIAnalysisModal({ stock, aiSettings, initialData, onSave, onClose }: { stock: Holding; aiSettings: any; initialData?: any; onSave: (data: any) => void; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(initialData || null);
  const [lang, setLang] = useState<'en' | 'ar'>('en');

  const generateAnalysis = async () => {
    setLoading(true);
    try {
      const resHistory = await fetch(`/api/history?symbol=${stock.ticker}&range=6m`);
      const history = await resHistory.json();
      
      if (!Array.isArray(history) || history.length < 5) {
        throw new Error('Could not retrieve enough historical data for this stock. Please try again later.');
      }

      // Safe technical calculations
      const validQuotes = history.filter(q => typeof q.close === 'number' && !isNaN(q.close));
      if (validQuotes.length < 5) throw new Error('Historical data contains invalid price points.');

      let gains = 0, losses = 0;
      const rsiPeriod = Math.min(validQuotes.length - 1, 14);
      for (let i = validQuotes.length - rsiPeriod; i < validQuotes.length; i++) {
        const diff = validQuotes[i].close - validQuotes[i-1].close;
        if (diff > 0) gains += diff; else losses -= diff;
      }
      const rs = (gains / rsiPeriod) / (losses / rsiPeriod || 1);
      const rsi = 100 - (100 / (1 + rs));
      
      const smaLen = Math.min(validQuotes.length, 50);
      const sma50 = validQuotes.slice(-smaLen).reduce((a, b) => a + b.close, 0) / smaLen;
      const high52 = Math.max(...validQuotes.map(h => h.close));
      const low52 = Math.min(...validQuotes.map(h => h.close));

      const aiRes = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-AI-Provider': aiSettings.provider,
          'X-AI-Model': aiSettings.model,
          'X-AI-Key': aiSettings.provider === 'gemini' ? aiSettings.geminiKey : aiSettings.openaiKey,
          'X-AI-Logging': aiSettings.enableLogging ? 'true' : 'false'
        },
        body: JSON.stringify({
          ticker: stock.ticker,
          company: stock.company === 'Loading...' ? stock.ticker : stock.company,
          history: validQuotes.slice(-30), // Pass recent history for context
          stats: { 
            currentPrice: stock.livePrice, 
            rsi: rsi.toFixed(1), 
            sma50: sma50.toFixed(2),
            high52: high52.toFixed(2),
            low52: low52.toFixed(2)
          }
        })
      });

      if (!aiRes.ok) {
        const errData = await aiRes.json().catch(() => ({}));
        throw new Error(errData.error || `AI Service Error (Status ${aiRes.status})`);
      }

      const aiData = await aiRes.json();
      const newAnalysis = { 
        rsi, sma50, high52, low52,
        sentiment: aiData.sentiment || 'NEUTRAL',
        sentiment_ar: aiData.sentiment_ar || 'حيادي',
        recommendation: aiData.recommendation || 'HOLD',
        recommendation_ar: aiData.recommendation_ar || 'انتظار',
        strategy: aiData.narrative || '...',
        strategy_ar: aiData.narrative_ar || '...',
        targetPrice: Number(aiData.targetPrice) || stock.livePrice * 1.1,
        key_metrics: Array.isArray(aiData.key_metrics) ? aiData.key_metrics : (typeof aiData.key_metrics === 'object' && aiData.key_metrics !== null ? Object.entries(aiData.key_metrics).map(([k,v]) => `${k}: ${v}`) : []),
        risks: Array.isArray(aiData.risks) ? aiData.risks : (typeof aiData.risks === 'object' && aiData.risks !== null ? Object.values(aiData.risks) : []),
        catalysts: Array.isArray(aiData.catalysts) ? aiData.catalysts : (typeof aiData.catalysts === 'object' && aiData.catalysts !== null ? Object.values(aiData.catalysts) : []),
        trend: stock.livePrice > sma50 ? 'Bullish' : 'Bearish',
        lastUpdate: new Date().toISOString()
      };
      
      const finalAnalytics = { ...initialData, ...newAnalysis, ticker: stock.ticker };
      setAnalysis(finalAnalytics);
      onSave(finalAnalytics);
    } catch (e: any) { 
      console.error('Analysis Error:', e);
      alert(e.message); 
      if (!analysis && !initialData) onClose(); 
    }
    finally { setLoading(false); }
  };

  if (!analysis && !loading) return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px', textAlign: 'center', padding: '4rem' }}>
        <div style={{ background: 'rgba(234, 179, 8, 0.1)', width: '80px', height: '80px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem' }}>
          <Brain className="text-yellow" size={40} />
        </div>
        <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Analysis Found</h3>
        <p className="text-muted" style={{ marginBottom: '2rem' }}>Generate a professional-grade AI report for {stock.ticker} using {aiSettings.model}.</p>
        <button className="btn-primary" style={{ width: '100%', padding: '12px' }} onClick={generateAnalysis}>
           Start AI Intelligence Dive
        </button>
        <button className="btn-secondary" style={{ width: '100%', padding: '12px', marginTop: '10px' }} onClick={onClose}>Close</button>
      </div>
    </div>
  );

  if (loading && !analysis) return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '500px', textAlign: 'center', padding: '4rem' }}>
        <div className="loader-container" style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 2rem' }}>
          <RefreshCw className="spinning text-blue" size={80} style={{ opacity: 0.2 }} />
          <Brain className="text-yellow" size={40} style={{ position: 'absolute', top: '20px', left: '20px' }} />
        </div>
        <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Analyzing Market Vectors</h3>
        <p className="text-muted">Synthesizing technical and fundamental data for {stock.ticker}...</p>
      </div>
    </div>
  );

  const t = lang === 'en' ? {
    sentiment: 'Market Sentiment', recommendation: 'AI Recommendation', target: 'Target Price', 
    technical: 'RSI (Strength)', sma: 'SMA 50 (Trend)', performance: 'Price vs SMA50',
    metrics: 'Key Metrics', risks: 'Potential Risks', catalysts: 'Growth Catalysts',
    strategy: 'Investment Strategy & Narrative', lastUpdated: 'Last Updated', dir: 'ltr'
  } : {
    sentiment: 'مشاعر السوق', recommendation: 'توصية الذكاء الاصطناعي', target: 'السعر المستهدف', 
    technical: 'مؤشر القوة RSI', sma: 'المتوسط المتحرك 50', performance: 'السعر مقابل المتوسط',
    metrics: 'مقاييس رئيسية', risks: 'المخاطر المحتملة', catalysts: 'محفزات النمو',
    strategy: 'إستراتيجية الاستثمار والتحليل', lastUpdated: 'آخر تحديث', dir: 'rtl'
  };

  const smaDiff = ((stock.livePrice - analysis.sma50) / analysis.sma50) * 100;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '1100px', width: '95%', direction: t.dir as 'ltr' | 'rtl', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header" style={{ padding: '1.5rem 2rem', background: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ background: 'rgba(234, 179, 8, 0.1)', padding: '10px', borderRadius: '12px' }}>
              <Brain size={28} className="text-yellow" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{stock.ticker} <span style={{ fontWeight: 400, opacity: 0.6 }}>|</span> {stock.company === 'Loading...' ? stock.ticker : stock.company}</h2>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '4px', alignItems: 'center' }}>
                 <span className="badge badge-blue">Professional Grade Analysis</span>
                 {analysis.lastUpdate && (
                   <span style={{ fontSize: '0.75rem', opacity: 0.5, display: 'flex', alignItems: 'center', gap: '4px' }}>
                     <Clock size={12} /> {t.lastUpdated}: {new Date(analysis.lastUpdate).toLocaleString()}
                   </span>
                 )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-primary" style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={generateAnalysis} disabled={loading}>
               <RefreshCw size={16} className={loading ? 'spinning' : ''} /> {loading ? 'Analyzing...' : 'Re-Analyze'}
            </button>
            <button className="btn-secondary" style={{ padding: '6px 16px' }} onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>
               {lang === 'en' ? 'Arabic' : 'English'}
            </button>
            <button className="icon-btn" onClick={onClose}><X size={24} /></button>
          </div>
        </div>

        <div style={{ padding: '2rem' }}>
          {/* Dashboard Section */}
          <div className="grid-4" style={{ gap: '1.25rem', marginBottom: '2.5rem' }}>
            <div className="card" style={{ padding: '1.25rem', borderTop: '4px solid var(--color-blue)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="text-muted small-caps">{t.sentiment}</label>
                <TrendingUp size={16} className="text-blue" />
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.5rem' }}>{lang === 'en' ? analysis.sentiment : analysis.sentiment_ar}</div>
            </div>
            <div className="card" style={{ padding: '1.25rem', borderTop: '4px solid var(--color-green)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="text-muted small-caps">{t.recommendation}</label>
                <ShieldAlert size={16} className="text-green" />
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--color-green)' }}>{lang === 'en' ? analysis.recommendation : analysis.recommendation_ar}</div>
            </div>
            <div className="card" style={{ padding: '1.25rem', borderTop: '4px solid var(--color-yellow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="text-muted small-caps">{t.target}</label>
                <Target size={16} className="text-yellow" />
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.5rem' }}>EGP {Number(analysis.targetPrice).toFixed(2)}</div>
            </div>
            <div className="card" style={{ padding: '1.25rem', borderTop: `4px solid ${smaDiff >= 0 ? 'var(--color-green)' : 'var(--color-red)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="text-muted small-caps">{t.performance}</label>
                {smaDiff >= 0 ? <ArrowUpRight size={16} className="text-green" /> : <ArrowDownRight size={16} className="text-red" />}
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.5rem', color: smaDiff >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                {smaDiff >= 0 ? '+' : ''}{Number(smaDiff).toFixed(2)}%
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {/* Main Narrative */}
                <div className="card" style={{ padding: '2rem', background: 'rgba(56, 139, 253, 0.05)', border: '1px solid rgba(56, 139, 253, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem' }}>
                    <Sparkles size={20} className="text-blue" />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{t.strategy}</h3>
                  </div>
                  <p style={{ lineHeight: 1.8, fontSize: '1.05rem', whiteSpace: 'pre-wrap' }}>
                    {lang === 'en' ? analysis.strategy : analysis.strategy_ar}
                  </p>
                </div>

                {/* Key Insights Grid */}
                <div className="grid-3" style={{ gap: '1.5rem' }}>
                  <div className="card" style={{ padding: '1.5rem' }}>
                    <h4 style={{ color: 'var(--color-blue)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>{t.metrics}</h4>
                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(Array.isArray(analysis.key_metrics) ? analysis.key_metrics : []).map((m: any, i: number) => <li key={i} style={{ fontSize: '0.9rem', display: 'flex', gap: '8px' }}><div style={{ color: 'var(--color-blue)' }}>•</div> {m}</li>)}
                      {!analysis.key_metrics?.length && <li className="text-muted italic">Processing metrics...</li>}
                    </ul>
                  </div>
                  <div className="card" style={{ padding: '1.5rem' }}>
                    <h4 style={{ color: 'var(--color-red)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>{t.risks}</h4>
                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(Array.isArray(analysis.risks) ? analysis.risks : []).map((m: any, i: number) => <li key={i} style={{ fontSize: '0.9rem', display: 'flex', gap: '8px' }}><div style={{ color: 'var(--color-red)' }}>•</div> {m}</li>)}
                      {!analysis.risks?.length && <li className="text-muted italic">Identifying risks...</li>}
                    </ul>
                  </div>
                  <div className="card" style={{ padding: '1.5rem' }}>
                    <h4 style={{ color: 'var(--color-green)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>{t.catalysts}</h4>
                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(Array.isArray(analysis.catalysts) ? analysis.catalysts : []).map((m: any, i: number) => <li key={i} style={{ fontSize: '0.9rem', display: 'flex', gap: '8px' }}><div style={{ color: 'var(--color-green)' }}>•</div> {m}</li>)}
                      {!analysis.catalysts?.length && <li className="text-muted italic">Locating catalysts...</li>}
                    </ul>
                  </div>
                </div>
             </div>

             {/* Sidebar Technicals */}
             <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '1.5rem' }}>
                   <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <BarChart2 size={18} className="text-purple" /> Technical Indicators
                   </h3>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-muted">{t.technical}</span>
                        <span style={{ fontWeight: 700, color: Number(analysis.rsi) > 70 ? 'var(--color-red)' : Number(analysis.rsi) < 30 ? 'var(--color-green)' : 'inherit' }}>{Number(analysis.rsi).toFixed(1)}</span>
                      </div>
                      <div className="rsi-bar" style={{ height: '6px', background: '#333', borderRadius: '3px', position: 'relative', margin: '4px 0' }}>
                         <div style={{ position: 'absolute', height: '100%', left: '30%', right: '30%', background: 'rgba(255,255,255,0.1)' }}></div>
                         <div style={{ position: 'absolute', height: '12px', width: '2px', background: 'white', top: '-3px', left: `${Number(analysis.rsi)}%`, transition: 'all 0.5s ease' }}></div>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                        <span className="text-muted">{t.sma}</span>
                        <span style={{ fontWeight: 700 }}>{Number(analysis.sma50).toFixed(2)}</span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-muted">Trend Status</span>
                        <span className={`badge ${analysis.trend === 'Bullish' ? 'badge-green' : 'badge-red'}`}>{analysis.trend}</span>
                      </div>
                   </div>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                   <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>52 Week Range</h3>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <span>EGP {Number(analysis.low52).toFixed(2)}</span>
                      <span>EGP {Number(analysis.high52).toFixed(2)}</span>
                   </div>
                   <div style={{ height: '6px', background: '#333', borderRadius: '3px', position: 'relative' }}>
                      {/* Current price indicator on 52w range */}
                      <div style={{ 
                        position: 'absolute', 
                        height: '100%', 
                        background: 'var(--color-blue)', 
                        left: '0', 
                        width: `${Math.min(100, Math.max(0, (stock.livePrice - Number(analysis.low52)) / (Number(analysis.high52) - Number(analysis.low52)) * 100))}%`,
                        borderRadius: '3px 0 0 3px'
                      }}></div>
                   </div>
                   <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.8rem' }}>
                      Current: <span style={{ fontWeight: 700 }}>{stock.livePrice}</span>
                   </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', border: '1px dashed var(--border-color)', background: 'none' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <Info size={16} className="text-muted" />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                      This analysis is generated by AI using technical signals and historical data. 
                      Investment carries risk. Consult a certified financial advisor before trading.
                    </p>
                  </div>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function PriceHistoryModal({ stock, onClose }: { stock: Holding; onClose: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [range, setRange] = useState('1m');
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'line' | 'candle'>('line');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/history?symbol=${stock.ticker}&range=${range}`);
        const result = await res.json();
        if (Array.isArray(result)) {
          setData(result.map(d => ({
            ...d,
            // Format for charts
            candle: [d.open, d.close],
            wick: [d.low, d.high],
            color: d.close >= d.open ? '#22c55e' : '#ef4444',
            displayDate: new Date(d.date).toLocaleDateString(undefined, {
              month: 'short',
              day: range === '1d' ? undefined : 'numeric',
              hour: range === '1d' ? 'numeric' : undefined,
              minute: range === '1d' ? 'numeric' : undefined
            })
          })));
        }
      } catch (e) { console.error('History Fetch Error', e); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [stock.ticker, range]);

  const ranges = [
    { label: '1D', value: '1d' },
    { label: '1W', value: '1w' },
    { label: '1M', value: '1m' },
    { label: '6M', value: '6m' },
    { label: '1Y', value: '1y' },
    { label: '5Y', value: '5y' },
  ];

  const currentPrice = data.length > 0 ? data[data.length - 1].close : stock.livePrice;
  const startPrice = data.length > 0 ? data[0].close : stock.livePrice;
  const change = currentPrice - startPrice;
  const changePct = (change / startPrice) * 100;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '900px', width: '90%', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        {/* Header Section */}
        <div style={{ padding: '2rem 2rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
               <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border-color)', padding: '4px' }}>
                  <img src={`https://s3-symbol-logo.tradingview.com/${stock.ticker === 'Unknown' ? 'indices' : stock.ticker.toLowerCase()}--big.svg`} 
                       onError={(e:any) => e.target.src = 'https://s3-symbol-logo.tradingview.com/indices--big.svg'}
                       style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
               </div>
               <div>
                 <h4 style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{stock.ticker}</h4>
                 <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '2px 0 8px' }}>{stock.company === 'Loading...' ? stock.ticker : stock.company}</h2>
                 <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                   <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>EGP {currentPrice.toFixed(2)}</span>
                   <span className={change >= 0 ? 'text-green' : 'text-red'} style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                     {change >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                     {Math.abs(change).toFixed(2)} ({Math.abs(changePct).toFixed(2)}%)
                     <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '4px' }}>Past {range.toUpperCase()}</span>
                   </span>
                 </div>
               </div>
            </div>
            <button className="icon-btn" onClick={onClose}><X size={24} /></button>
          </div>
        </div>

        {/* Chart Area */}
        <div style={{ padding: '2rem' }}>
          <div style={{ height: '400px', width: '100%', position: 'relative' }}>
            {loading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,11,14,0.5)', zIndex: 10 }}>
                <RefreshCw className="spinning text-blue" size={32} />
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={change >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={change >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="displayDate" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                  minTickGap={30}
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                  orientation="right"
                  tickFormatter={(val) => val.toFixed(1)}
                />
                <Tooltip 
                  contentStyle={{ background: '#1a1b1e', border: '1px solid #333', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                  itemStyle={{ color: '#fff' }}
                />
                <ReferenceLine y={startPrice} stroke="var(--text-muted)" strokeDasharray="3 3" label={{ position: 'left', value: startPrice.toFixed(2), fill: 'var(--text-muted)', fontSize: 10 }} />
                
                {chartType === 'line' ? (
                  <Area 
                    type="monotone" 
                    dataKey="close" 
                    stroke={change >= 0 ? '#22c55e' : '#ef4444'} 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorPrice)" 
                    animationDuration={800}
                  />
                ) : (
                  // Simple candlestick simulation using Bars
                  <Bar dataKey="wick" fill="none" strokeWidth={1}>
                    {data.map((entry, index) => (
                      <Cell key={`cell-wick-${index}`} stroke={entry.color} />
                    ))}
                  </Bar>
                )}
                
                {/* Volume at bottom */}
                <Bar dataKey="volume" yAxisId="volume" fill="rgba(255,255,255,0.1)" radius={[2, 2, 0, 0]} />
                <YAxis yAxisId="volume" hide domain={[0, (dataMax:any) => dataMax * 4]} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Timeframe & Chart Type Selectors */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
            <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-card)', padding: '4px', borderRadius: '12px' }}>
              {ranges.map(r => (
                <button 
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: range === r.value ? 'var(--color-blue)' : 'transparent',
                    color: range === r.value ? 'white' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    transition: 'all 0.2s'
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            
            <button className="icon-btn" onClick={() => setChartType(chartType === 'line' ? 'candle' : 'line')} style={{ background: 'var(--bg-card)', padding: '10px' }}>
              {chartType === 'line' ? <BarChart2 size={20} /> : <TrendingUp size={20} />}
            </button>
          </div>
        </div>


      </div>
    </div>
  );
}

function TotalReturnHistory({ transactions }: { transactions: Transaction[] }) {
  const [selectedTicker, setSelectedTicker] = useState('ALL');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState('max');

  const tickers = ['ALL', ...new Set(transactions.filter(t => t.ticker).map(t => t.ticker!))];

  useEffect(() => {
    const calculateHistory = async () => {
      if (transactions.length === 0) return;
      setLoading(true);
      try {
        const targetTickers = selectedTicker === 'ALL' ? tickers.filter(t => t !== 'ALL') : [selectedTicker];
        const histories: Record<string, any[]> = {};

        await Promise.all(targetTickers.map(async t => {
          const res = await fetch(`/api/history?symbol=${t}&range=${range}`);
          const json = await res.json();
          if (Array.isArray(json)) histories[t] = json;
        }));

        const allDates = [...new Set(Object.values(histories).flat().map(p => p.date.split('T')[0]))].sort();
        const sortedTxs = [...transactions].sort((a,b) => a.date.localeCompare(b.date));
        const firstTxDate = sortedTxs[0]?.date || new Date().toISOString().split('T')[0];
        
        const points = allDates.filter(d => d >= firstTxDate).map(date => {
          let unrealizedPnL = 0;
          let realizedPnL = 0;
          let dividends = 0;
          
          targetTickers.forEach(ticker => {
            const history = histories[ticker];
            if (!history) return;

            const pricePoint = history.find(p => p.date.split('T')[0] === date) || [...history].reverse().find(p => p.date.split('T')[0] <= date);

            let shares = 0;
            let totalCost = 0;
            
            transactions
              .filter(t => t.ticker === ticker && t.date <= date)
              .sort((a,b) => a.date.localeCompare(b.date))
              .forEach(tx => {
                if (tx.type === 'Buy') {
                  shares += tx.quantity!;
                  totalCost += (tx.quantity! * tx.price) + (tx.fees || 0);
                } else if (tx.type === 'Sell') {
                  const avgCost = shares > 0 ? totalCost / shares : 0;
                  const costBasisSold = avgCost * tx.quantity!;
                  const netProceeds = (tx.quantity! * tx.price) - (tx.fees || 0);
                  realizedPnL += (netProceeds - costBasisSold);
                  shares -= tx.quantity!;
                  totalCost -= costBasisSold;
                } else if (tx.type === 'Dividend') {
                  dividends += (tx.price || 0) - (tx.fees || 0);
                }
              });

            if (shares > 0 && pricePoint && pricePoint.close) {
              const currentValue = shares * pricePoint.close;
              unrealizedPnL += (currentValue - totalCost);
            }
          });

          const totalReturn = unrealizedPnL + realizedPnL + dividends;

          return {
            date,
            displayDate: new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }),
            totalReturn: Math.round(totalReturn),
            unrealizedPnL: Math.round(unrealizedPnL),
            realizedPnL: Math.round(realizedPnL),
            dividends: Math.round(dividends)
          };
        });

        setData(points);
      } catch (e) {
        console.error('Total Return History Error:', e);
      } finally {
        setLoading(false);
      }
    };

    calculateHistory();
  }, [transactions, selectedTicker, range]);

  return (
    <div className="card" style={{ marginTop: '2rem', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} className="text-green" /> Total Return Trend
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Historical total return evolution (Unrealized P&L + Realized Profits + Dividends)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <select 
            value={selectedTicker} 
            onChange={e => setSelectedTicker(e.target.value)}
            className="input-field"
            style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto' }}
          >
            {tickers.map(t => <option key={t} value={t}>{t === 'ALL' ? 'Entire Portfolio' : t}</option>)}
          </select>
          <div className="time-filters">
            {['1w', '1m', '3m', '6m', 'ytd', '1y', 'max'].map(r => (
              <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ height: '350px', width: '100%' }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} className="spinning" style={{ marginRight: '12px' }} />
            Recalculating historical vectors...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="totalReturnGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-green)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-green)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="totalReturnGradientRed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-red)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-red)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="displayDate" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                minTickGap={30}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                tickFormatter={(val) => `EGP ${val.toLocaleString()}`}
              />
              <Tooltip 
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}
                formatter={(val: any) => [`EGP ${Number(val).toLocaleString()}`, 'Total Return']}
              />
              <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="3 3" />
              <Area 
                type="monotone" 
                dataKey="totalReturn" 
                stroke={data.length > 0 && data[data.length - 1]?.totalReturn >= 0 ? 'var(--color-green)' : 'var(--color-red)'} 
                strokeWidth={3}
                dot={data.length < 10 ? { r: 4, strokeWidth: 2, fill: 'var(--bg-card)' } : false}
                activeDot={{ r: 6, strokeWidth: 0 }}
                fillOpacity={1} 
                fill={`url(#${data.length > 0 && data[data.length - 1]?.totalReturn >= 0 ? 'totalReturnGradient' : 'totalReturnGradientRed'})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function TradingViewWidget({ symbol }: { symbol: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": symbol,
      "interval": "D",
      "timezone": "Etc/UTC",
      "theme": "dark",
      "style": "1",
      "locale": "en",
      "toolbar_bg": "#f1f3f6",
      "enable_publishing": false,
      "hide_top_toolbar": false,
      "hide_legend": false,
      "withdateranges": true,
      "hide_side_toolbar": false,
      "allow_symbol_change": true,
      "save_image": true,
      "hide_volume": false,
      "range": "YTD",
      "details": true,
      "hotlist": true,
      "calendar": false,
      "show_popup_button": true,
      "popup_width": "1000",
      "popup_height": "650",
      "support_host": "https://www.tradingview.com"
    });
    
    if (container.current) {
      container.current.innerHTML = "";
      const widgetDiv = document.createElement("div");
      widgetDiv.className = "tradingview-widget-container__widget";
      widgetDiv.style.height = "100%";
      widgetDiv.style.width = "100%";
      container.current.appendChild(widgetDiv);
      container.current.appendChild(script);
    }

    return () => {
      // Use a timeout to avoid immediate cleanup that might trigger script errors
      const current = container.current;
      setTimeout(() => {
        if (current) current.innerHTML = "";
      }, 0);
    };
  }, [symbol]);

  return (
    <div className="tradingview-widget-container" ref={container} style={{ height: "100%", width: "100%" }}>
    </div>
  );
}
function HoldingHistory({ holdings, analyticsData, transactions }: { holdings: Holding[], analyticsData: Record<string, any>, transactions: Transaction[] }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState('6m');
  const [visibleTickers, setVisibleTickers] = useState<string[]>([]);
  const [showTrend, setShowTrend] = useState(false);
  const [tickerHistories, setTickerHistories] = useState<Record<string, any[]>>({});
  const [fundamentals, setFundamentals] = useState<Record<string, any[]>>({});
  const [benchmarkHistory, setBenchmarkHistory] = useState<any[]>([]);
  const [lang, setLang] = useState<'EN' | 'AR'>('EN');
  const [showMarkers, setShowMarkers] = useState(false);
  const [markerSettings, setMarkerSettings] = useState({
    style: 'dot', // dot, square, diamond, label
    size: 6,
    colorMode: 'status', // status (green/red), match (line color)
    showLabels: false,
    showQuantity: false
  });
  const [isSettingsOpen, setIsMarkerSettingsOpen] = useState(false);
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);

  useEffect(() => {
    if (holdings.length > 0 && visibleTickers.length === 0) {
      setVisibleTickers(holdings.map(h => h.ticker));
    }
  }, [holdings.length]);

  useEffect(() => {
    const fetchData = async () => {
      if (visibleTickers.length === 0) {
        setData([]);
        return;
      }
      setLoading(true);
      try {
        const histories: Record<string, any[]> = {};
        await Promise.all(visibleTickers.map(async ticker => {
          try {
            const res = await fetch(`/api/history?symbol=${ticker}&range=${range}`);
            const json = await res.json();
            if (Array.isArray(json)) histories[ticker] = json;
          } catch (e) {
            console.error(`Failed history for ${ticker}`, e);
          }
        }));

        // Benchmark (EGX30) for relative strength + beta, and real fundamentals.
        fetch(`/api/history?symbol=^EGX30&range=${range}`)
          .then(r => r.json()).then(j => { if (Array.isArray(j)) setBenchmarkHistory(j); })
          .catch(() => {});
        fetch(`/api/fundamentals?symbols=${visibleTickers.join(',')}`)
          .then(r => r.json()).then(j => { if (j && typeof j === 'object') setFundamentals(j); })
          .catch(() => {});

        // Align dates
        const allDates = new Set<string>();
        Object.values(histories).forEach(h => h.forEach(p => allDates.add(p.date.split('T')[0])));
        const sortedDates = Array.from(allDates).sort();

        const chartData = sortedDates.map(date => {
          const point: any = { date, displayDate: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) };
          visibleTickers.forEach(ticker => {
            const h = histories[ticker];
            if (h && h.length > 0) {
              const pIndex = h.findIndex(x => x.date.split('T')[0] === date);
              if (pIndex >= 0) {
                const p = h[pIndex];
                const startPrice = h[0].close || 1;
                const normalizedPrice = (p.close / startPrice) * 100;
                point[ticker] = normalizedPrice;
                point[`${ticker}_raw`] = p.close;

                // SMA-20 Trend
                if (pIndex >= 20) {
                   const slice = h.slice(pIndex - 20, pIndex);
                   const sma = slice.reduce((a, b) => a + b.close, 0) / 20;
                   point[`${ticker}_trend`] = (sma / startPrice) * 100;
                }

                // Buy Markers
                const buyTx = transactions.find(tx => tx.ticker === ticker && tx.type === 'Buy' && tx.date === date);
                if (buyTx) {
                  point[`${ticker}_buy`] = normalizedPrice;
                  point[`${ticker}_buy_details`] = {
                    price: buyTx.price,
                    quantity: buyTx.quantity,
                    ticker: ticker
                  };
                }
              }
            }
          });
          return point;
        });
        setData(chartData);
        setTickerHistories(histories);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [visibleTickers, range, transactions]);

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#a855f7', '#6366f1'];

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h3 style={{ margin: 0 }}>Holding Performance History</h3>
          <p className="text-muted" style={{ fontSize: '0.85rem' }}>Compare normalized performance (Basis 100) of your active positions</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div className="btn-group">
            <button className={lang === 'EN' ? 'active' : ''} onClick={() => setLang('EN')}>EN</button>
            <button className={lang === 'AR' ? 'active' : ''} onClick={() => setLang('AR')}>AR</button>
          </div>
          <button 
            onClick={() => setShowTrend(!showTrend)}
            className={`btn-secondary ${showTrend ? 'active' : ''}`}
            style={{ 
              fontSize: '0.8rem', 
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: showTrend ? 'var(--color-blue)' : 'transparent',
              color: showTrend ? 'white' : 'var(--text-secondary)'
            }}
          >
            <Sparkles size={14} /> {showTrend ? 'Hide Trends' : 'Show Trends'} <InfoTooltip term="SMA" />
          </button>
          <button 
            onClick={() => setShowMarkers(!showMarkers)}
            className={`btn-secondary ${showMarkers ? 'active' : ''}`}
            style={{ 
              fontSize: '0.8rem', 
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: showMarkers ? 'var(--color-green)' : 'transparent',
              color: showMarkers ? 'white' : 'var(--text-secondary)'
            }}
          >
            <PlusCircle size={14} /> {showMarkers ? 'Hide Buy Markers' : 'Show Buy Markers'}
          </button>
          
          {showMarkers && (
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setIsMarkerSettingsOpen(!isSettingsOpen)}
                className="icon-btn"
                style={{ padding: '8px', background: isSettingsOpen ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}
              >
                <SettingsIcon size={18} />
              </button>
              
              {isSettingsOpen && (
                <div style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  right: 0, 
                  zIndex: 100, 
                  background: '#1a1b1e', 
                  border: '1px solid #333', 
                  borderRadius: '12px', 
                  padding: '1rem',
                  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
                  minWidth: '220px',
                  marginTop: '0.5rem'
                }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>Marker Visualization</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Shape</span>
                      <select 
                        value={markerSettings.style} 
                        onChange={(e) => setMarkerSettings(prev => ({ ...prev, style: e.target.value }))}
                        style={{ background: '#2a2b2e', border: '1px solid #444', color: 'white', fontSize: '0.8rem', borderRadius: '4px' }}
                      >
                        <option value="dot">Classic Dot</option>
                        <option value="square">Modern Square</option>
                        <option value="diamond">Pro Diamond</option>
                        <option value="label">Direct Label</option>
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Size</span>
                      <input 
                        type="range" min="4" max="12" step="2"
                        value={markerSettings.size}
                        onChange={(e) => setMarkerSettings(prev => ({ ...prev, size: parseInt(e.target.value) }))}
                        style={{ width: '80px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Color</span>
                      <select 
                        value={markerSettings.colorMode} 
                        onChange={(e) => setMarkerSettings(prev => ({ ...prev, colorMode: e.target.value }))}
                        style={{ background: '#2a2b2e', border: '1px solid #444', color: 'white', fontSize: '0.8rem', borderRadius: '4px' }}
                      >
                        <option value="status">Status (Green)</option>
                        <option value="match">Match Ticker Color</option>
                      </select>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={markerSettings.showLabels}
                        onChange={(e) => setMarkerSettings(prev => ({ ...prev, showLabels: e.target.checked }))}
                      />
                      <span style={{ fontSize: '0.8rem' }}>Show Price on Graph</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={markerSettings.showQuantity}
                        onChange={(e) => setMarkerSettings(prev => ({ ...prev, showQuantity: e.target.checked }))}
                      />
                      <span style={{ fontSize: '0.8rem' }}>Scale by Quantity</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="btn-group">
            {['1m', '3m', '6m', '1y'].map(r => (
              <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '2rem' }}>
        {holdings.map((h, idx) => (
          <button 
            key={h.ticker} 
            onClick={() => setVisibleTickers(prev => prev.includes(h.ticker) ? prev.filter(t => t !== h.ticker) : [...prev, h.ticker])}
            style={{ 
              padding: '6px 12px',
              borderRadius: '20px',
              border: '1px solid',
              borderColor: visibleTickers.includes(h.ticker) ? colors[idx % colors.length] : 'var(--border-color)',
              background: visibleTickers.includes(h.ticker) ? `${colors[idx % colors.length]}15` : 'transparent',
              color: visibleTickers.includes(h.ticker) ? colors[idx % colors.length] : 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: visibleTickers.includes(h.ticker) ? colors[idx % colors.length] : '#333' }} />
            {h.ticker}
          </button>
        ))}
      </div>

      <div style={{ height: '500px', width: '100%', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(26, 27, 30, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '12px' }}>
            <RefreshCw className="spinning text-blue" size={32} />
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%" debounce={100}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickFormatter={v => `${v.toFixed(0)}`} domain={['auto', 'auto']} />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const buys = payload.filter((p: any) => p.dataKey.endsWith('_buy'));
                  const prices = payload.filter((p: any) => !p.dataKey.endsWith('_buy') && !p.dataKey.endsWith('_trend'));
                  
                  return (
                    <div style={{ 
                      background: '#1a1b1e', 
                      border: '1px solid #333', 
                      borderRadius: '12px', 
                      padding: '1rem',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
                      minWidth: '180px'
                    }}>
                      <div style={{ borderBottom: '1px solid #333', paddingBottom: '0.5rem', marginBottom: '0.5rem', fontWeight: 700, fontSize: '0.9rem' }}>
                        {label}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {prices.map((p: any) => {
                          const holding = holdings.find(h => h.ticker === p.name);
                          const rawPrice = p.payload[`${p.dataKey}_raw`];
                          const avgCost = holding?.avgCost || 0;
                          const pnl = avgCost > 0 ? ((rawPrice - avgCost) / avgCost) * 100 : 0;
                          
                          return (
                            <div key={p.dataKey} style={{ 
                              padding: '6px 0', 
                              borderBottom: '1px solid rgba(255,255,255,0.03)',
                              opacity: hoveredTicker && !p.name.startsWith(hoveredTicker) ? 0.3 : 1 
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                <span style={{ color: p.color, fontWeight: 700, fontSize: '0.9rem' }}>{p.name}</span>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>EGP {Number(rawPrice).toFixed(2)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                <span>Cost: {avgCost > 0 ? `EGP ${avgCost.toFixed(2)}` : 'N/A'}</span>
                                <span style={{ color: pnl >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                  {pnl >= 0 ? '▲' : '▼'} {Math.abs(pnl).toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {buys.length > 0 && hoveredTicker && (
                        <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px dashed #444' }}>
                          {buys.filter((b: any) => b.name.startsWith(hoveredTicker)).map((b: any) => {
                            const details = b.payload?.[`${b.dataKey}_details`];
                            if (!details) return null;
                            return (
                              <div key={b.dataKey} style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '8px', borderRadius: '8px', marginBottom: '4px', borderLeft: '3px solid #10b981' }}>
                                <div style={{ color: '#10b981', fontWeight: 800, fontSize: '0.75rem', marginBottom: '2px' }}>BUY: {b.name.split(' ')[0]}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                  Price: <span style={{ color: 'white' }}>EGP {details.price}</span> | Qty: <span style={{ color: 'white' }}>{details.quantity}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend verticalAlign="top" align="right" iconType="circle" />
            {visibleTickers.map((ticker, i) => (
              <React.Fragment key={ticker}>
                <Line 
                  type="monotone" 
                  dataKey={ticker} 
                  name={ticker}
                  stroke={colors[i % colors.length]} 
                  strokeWidth={3} 
                  dot={false} 
                  animationDuration={800} 
                  zIndex={10}
                />
                {showTrend && (
                  <Line 
                    type="monotone" 
                    dataKey={`${ticker}_trend`} 
                    name={`${ticker} Trend`}
                    stroke={colors[i % colors.length]} 
                    strokeWidth={1} 
                    strokeDasharray="5 5"
                    dot={false} 
                    animationDuration={800} 
                    opacity={0.6}
                  />
                )}
                {showMarkers && (
                  <Line 
                    type="monotone" 
                    dataKey={`${ticker}_buy`} 
                    name={`${ticker} Purchase`}
                    stroke="none" 
                    dot={(props: any) => {
                      const { cx, cy, payload, value } = props;
                      if (!value) return null;
                      
                      const details = payload[`${ticker}_buy_details`];
                      const baseColor = markerSettings.colorMode === 'match' ? colors[i % colors.length] : '#10b981';
                      
                      // Calculate scale if enabled
                      let radius = markerSettings.size;
                      if (markerSettings.showQuantity && details?.quantity) {
                        radius = Math.min(15, Math.max(radius, radius * (Math.log10(details.quantity) / 2)));
                      }

                      let shape: any = null;
                      switch(markerSettings.style) {
                        case 'square':
                          shape = <rect x={cx - radius} y={cy - radius} width={radius*2} height={radius*2} fill={baseColor} stroke="#fff" strokeWidth={2} />;
                          break;
                        case 'diamond':
                          const d = radius * 1.4;
                          shape = <path d={`M ${cx} ${cy-d} L ${cx+d} ${cy} L ${cx} ${cy+d} L ${cx-d} ${cy} Z`} fill={baseColor} stroke="#fff" strokeWidth={2} />;
                          break;
                        case 'label':
                          shape = null; // We'll show text only
                          break;
                        default:
                          shape = <circle cx={cx} cy={cy} r={radius} fill={baseColor} stroke="#fff" strokeWidth={2} />;
                      }

                      return (
                        <g 
                          key={`marker-${ticker}-${cx}`}
                          onMouseEnter={() => setHoveredTicker(ticker)}
                          onMouseLeave={() => setHoveredTicker(null)}
                          style={{ cursor: 'pointer' }}
                        >
                          {shape}
                          {markerSettings.showLabels && (
                            <text 
                              x={cx} 
                              y={cy - radius - 8} 
                              textAnchor="middle" 
                              fill="white" 
                              fontSize="10" 
                              fontWeight="bold"
                              style={{ pointerEvents: 'none', filter: 'drop-shadow(0px 1px 2px rgba(0,0,0,0.8))' }}
                            >
                              {details?.price}
                            </text>
                          )}
                        </g>
                      );
                    }} 
                    legendType="none"
                    animationDuration={800}
                  />
                )}
              </React.Fragment>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Intelligence & Analysis Grid */}
      <div style={{ marginTop: '3rem' }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={22} className="text-blue" /> Institutional Sentiment & Analysis
        </h3>

        {(() => {
          // Portfolio concentration check: warn when holdings move together.
          const visible = holdings.filter(h => visibleTickers.includes(h.ticker));
          const benchClose = benchmarkHistory.map(p => p.close);
          const pairs: { a: string; b: string; corr: number }[] = [];
          for (let i = 0; i < visible.length; i++) {
            for (let j = i + 1; j < visible.length; j++) {
              const ha = tickerHistories[visible[i].ticker]?.map(p => p.close) || [];
              const hb = tickerHistories[visible[j].ticker]?.map(p => p.close) || [];
              if (ha.length > 10 && hb.length > 10) {
                const c = returnCorrelation(ha, hb);
                if (c > 0.6) pairs.push({ a: visible[i].ticker, b: visible[j].ticker, corr: c });
              }
            }
          }
          if (pairs.length === 0) return null;
          pairs.sort((x, y) => y.corr - x.corr);
          return (
            <div style={{ marginBottom: '1.25rem', padding: '12px 16px', borderRadius: '12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: '12px', direction: lang === 'AR' ? 'rtl' : 'ltr' }}>
              <Bell size={18} className="text-yellow" />
              <div style={{ fontSize: '0.8rem' }}>
                <strong>{lang === 'AR' ? 'تنبيه تركّز المحفظة:' : 'Concentration warning:'}</strong>{' '}
                {lang === 'AR' ? 'هذه الأسهم تتحرك معاً بشكل كبير، مما يقلل التنويع الفعلي — ' : 'These holdings move together, reducing real diversification — '}
                {pairs.slice(0, 3).map(p => `${p.a}↔${p.b} (${(p.corr * 100).toFixed(0)}%)`).join(', ')}
                {benchClose.length === 0 ? '' : ''}
              </div>
            </div>
          );
        })()}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {holdings.filter(h => visibleTickers.includes(h.ticker)).map(h => {
            const analysis = analyticsData[h.ticker];

            // Total portfolio capital, for risk-based position sizing.
            const portfolioCapital = holdings.reduce((sum, x) => sum + (x.livePrice || 0) * (x.shares || 0), 0);

            // Build the full institutional-grade technical profile (daily + weekly),
            // pull real fundamentals + benchmark, then run the engine with full context.
            const benchClose = benchmarkHistory.map(p => p.close);
            const profile = (() => {
              const hist = tickerHistories[h.ticker];
              if (!hist || hist.length < 15) return null;
              return buildTechnicalProfile(hist as any, benchClose.length > 2 ? benchClose : undefined);
            })();
            const weeklyProfile = (() => {
              const hist = tickerHistories[h.ticker];
              if (!hist || hist.length < 40) return null;
              return buildTechnicalProfile(resampleWeekly(hist as any) as any);
            })();
            const fundScore = scoreFundamentals(
              fundamentals[h.ticker] ? parseFundamentals(h.ticker, fundamentals[h.ticker]) : null
            );
            const backtest = (() => {
              const hist = tickerHistories[h.ticker];
              if (!hist || hist.length < 80) return null;
              return backtestBullishSetup(hist.map((p: any) => p.close));
            })();
            const localRec = profile ? calculateRecommendation(profile, {
              fundamentals: fundScore,
              weeklyTrendRegime: weeklyProfile?.trendRegime,
              hasBenchmark: benchClose.length > 2,
              capital: portfolioCapital,
              backtest,
            }) : null;

            const recVal = analysis?.recommendation || localRec?.recommendation || 'HOLD';
            const recValAr = analysis?.recommendation_ar || localRec?.recommendation_ar || 'انتظار';
            const sentVal = analysis?.sentiment || localRec?.sentiment || 'NEUTRAL';
            const sentValAr = analysis?.sentiment_ar || localRec?.sentiment_ar || 'حيادي';
            const targetPriceVal = analysis?.targetPrice || localRec?.targetPrice || h.livePrice * 1.1;

            const isBullish = sentVal.toUpperCase().includes('BULL') || recVal === 'BUY' || recVal === 'ACCUMULATE';
            const isBearish = sentVal.toUpperCase().includes('BEAR') || recVal === 'SELL';
            
            const stats = (() => {
              const history = tickerHistories[h.ticker];
              if (!history || history.length < 2) return null;
              const prices = history.map(p => p.close);
              const startPrice = prices[0];
              const currentPrice = prices[prices.length - 1];
              const perf = ((currentPrice - startPrice) / startPrice) * 100;
              let maxDD = 0; let peak = -Infinity;
              prices.forEach(p => {
                if (p > peak) peak = p;
                const dd = (peak - p) / peak;
                if (dd > maxDD) maxDD = dd;
              });
              const returns = [];
              for (let i = 1; i < prices.length; i++) returns.push((prices[i] - prices[i-1]) / prices[i-1]);
              const avgReturn = returns.reduce((a,b) => a+b, 0) / returns.length;
              const variance = returns.reduce((a,b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
              const vol = Math.sqrt(variance) * Math.sqrt(252) * 100;
              return { perf, maxDD: maxDD * 100, vol };
            })();

            const accent = isBullish ? 'var(--color-green)' : isBearish ? 'var(--color-red)' : 'var(--color-yellow)';
            const conviction = localRec?.conviction ?? 50;
            const riskColors: Record<string, string> = { LOW: 'var(--color-green)', MODERATE: 'var(--color-yellow)', HIGH: '#f97316', EXTREME: 'var(--color-red)' };
            const perfVal = stats?.perf ?? profile?.perfPct ?? 0;
            const ddVal = stats?.maxDD ?? profile?.maxDrawdown ?? 0;
            const volVal = stats?.vol ?? profile?.annualizedVol ?? 0;
            const aiNarrative = lang === 'AR' ? analysis?.narrative_ar : analysis?.narrative;
            const signalsList = lang === 'AR' ? (localRec?.signals_ar || []) : (localRec?.signals || []);

            return (
              <div key={h.ticker} className="card" style={{
                padding: '1.5rem',
                borderTop: `4px solid ${accent}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                position: 'relative',
                cursor: 'default'
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {h.logoid ? (
                      <img src={`https://s3-symbol-logo.tradingview.com/${h.logoid}--big.svg`} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                    ) : (
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{h.ticker[0]}</div>
                    )}
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', letterSpacing: '0.5px' }}>{h.ticker}</h4>
                      <p className="text-muted" style={{ fontSize: '0.75rem', margin: 0 }}>{h.company}</p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={`badge ${isBullish ? 'badge-green' : isBearish ? 'badge-red' : 'badge-yellow'}`} style={{ padding: '4px 10px', fontSize: '0.72rem', fontWeight: 700 }}>
                      {lang === 'AR' ? recValAr : recVal}
                    </div>
                    {localRec && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', marginTop: '5px' }}>
                        <span title={localRec.confidenceReasons.join(' · ')} style={{
                          fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.3px', padding: '2px 6px', borderRadius: '6px',
                          background: localRec.dataConfidence === 'HIGH' ? 'rgba(16,185,129,0.15)' : localRec.dataConfidence === 'MEDIUM' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                          color: localRec.dataConfidence === 'HIGH' ? 'var(--color-green)' : localRec.dataConfidence === 'MEDIUM' ? 'var(--color-yellow)' : 'var(--color-red)',
                        }}>
                          {lang === 'AR' ? `ثقة ${localRec.dataConfidence_ar}` : `${localRec.dataConfidence} TRUST`}
                        </span>
                      </div>
                    )}
                    {localRec && (
                      <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {lang === 'AR' ? 'الأفق' : 'Horizon'}: {localRec.horizon}
                      </div>
                    )}
                  </div>
                </div>

                {/* Conviction gauge */}
                {localRec && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '4px' }}>
                      <span className="text-muted">{lang === 'AR' ? 'درجة الثقة' : 'Conviction'}</span>
                      <span style={{ fontWeight: 700, color: accent }}>{conviction}%</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ width: `${conviction}%`, height: '100%', background: accent, borderRadius: '4px', transition: 'width 0.4s' }} />
                    </div>
                  </div>
                )}

                {/* Risk stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px' }}>
                  <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-muted" style={{ fontSize: '0.65rem', marginBottom: '4px' }}>PERF ({range.toUpperCase()})</p>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: perfVal >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {(stats || profile) ? `${perfVal >= 0 ? '+' : ''}${perfVal.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-muted" style={{ fontSize: '0.65rem', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>MAX DD <InfoTooltip term="Max Drawdown" /></p>
                    <span className="mono" style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-red)' }}>
                      {(stats || profile) ? `-${ddVal.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p className="text-muted" style={{ fontSize: '0.65rem', marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>ANN. VOL <InfoTooltip term="Volatility" /></p>
                    <span className="mono" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {(stats || profile) ? `${volVal.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Fundamentals (real data only — never fabricated) */}
                {fundScore.available && (() => {
                  const fd = parseFundamentals(h.ticker, fundamentals[h.ticker]);
                  const valColor = fundScore.valuation === 'UNDERVALUED' ? 'var(--color-green)' : fundScore.valuation === 'EXPENSIVE' ? 'var(--color-red)' : 'var(--color-yellow)';
                  const cells = [
                    { label: 'P/E', val: fd.pe !== null ? fd.pe.toFixed(1) : '—' },
                    { label: 'ROE', val: fd.roe !== null ? `${fd.roe.toFixed(0)}%` : '—' },
                    { label: 'D/E', val: fd.debtEquity !== null ? fd.debtEquity.toFixed(2) : '—' },
                    { label: lang === 'AR' ? 'التوزيعات' : 'Div', val: fd.dividendYield !== null ? `${fd.dividendYield.toFixed(1)}%` : '—' },
                  ];
                  return (
                    <div style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '12px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>{lang === 'AR' ? 'الأساسيات' : 'FUNDAMENTALS'}</span>
                        {fundScore.valuation !== 'UNKNOWN' && (
                          <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: valColor }}>
                            {lang === 'AR' ? fundScore.valuation_ar : fundScore.valuation}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px' }}>
                        {cells.map(c => (
                          <div key={c.label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{c.label}</div>
                            <div className="mono" style={{ fontSize: '0.8rem', fontWeight: 700 }}>{c.val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Context strip: trend strength · relative strength · timeframe */}
                {localRec && profile && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <span style={{ fontSize: '0.58rem', padding: '3px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}>
                      {lang === 'AR' ? 'قوة الاتجاه' : 'Trend'}: <b style={{ color: localRec.trendStrength === 'TRENDING' ? 'var(--color-green)' : localRec.trendStrength === 'CHOPPY' ? 'var(--color-red)' : 'var(--text-secondary)' }}>ADX {profile.adx.toFixed(0)}</b>
                    </span>
                    {benchClose.length > 2 && (
                      <span style={{ fontSize: '0.58rem', padding: '3px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}>
                        {lang === 'AR' ? 'مقابل المؤشر' : 'vs Index'}: <b style={{ color: profile.relStrengthPct >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{profile.relStrengthPct >= 0 ? '+' : ''}{profile.relStrengthPct.toFixed(0)}%</b>
                      </span>
                    )}
                    {localRec.timeframeAgreement !== 'UNKNOWN' && (
                      <span style={{ fontSize: '0.58rem', padding: '3px 8px', borderRadius: '8px',
                        background: localRec.timeframeAgreement === 'ALIGNED' ? 'rgba(16,185,129,0.12)' : localRec.timeframeAgreement === 'CONFLICT' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
                        color: localRec.timeframeAgreement === 'ALIGNED' ? 'var(--color-green)' : localRec.timeframeAgreement === 'CONFLICT' ? 'var(--color-red)' : 'var(--text-secondary)' }}>
                        {lang === 'AR' ? 'الأطر الزمنية' : 'D+W'}: {localRec.timeframeAgreement === 'ALIGNED' ? (lang === 'AR' ? 'متفقة' : 'aligned') : localRec.timeframeAgreement === 'CONFLICT' ? (lang === 'AR' ? 'متعارضة' : 'conflict') : '—'}
                      </span>
                    )}
                    {backtest?.reliable && (
                      <span title={lang === 'AR' ? `${backtest.samples} حالة تاريخية` : `${backtest.samples} historical setups`} style={{ fontSize: '0.58rem', padding: '3px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}>
                        {lang === 'AR' ? 'الموثوقية التاريخية' : 'Backtest'}: <b style={{ color: backtest.winRate >= 55 ? 'var(--color-green)' : backtest.winRate >= 45 ? 'var(--color-yellow)' : 'var(--color-red)' }}>{backtest.winRate}%</b>
                      </span>
                    )}
                  </div>
                )}

                {/* Trade plan */}
                {localRec && (
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>{lang === 'AR' ? 'خطة التداول' : 'TRADE PLAN'}</span>
                      <span style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: riskColors[localRec.riskLevel] }}>
                        {lang === 'AR' ? `مخاطر ${localRec.riskLevel_ar}` : `${localRec.riskLevel} RISK`}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.72rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="text-muted">{lang === 'AR' ? 'منطقة الدخول' : 'Entry'}</span>
                        <span className="mono" style={{ fontWeight: 600 }}>{localRec.entryZone.low}–{localRec.entryZone.high}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="text-muted">{lang === 'AR' ? 'وقف الخسارة' : 'Stop'}</span>
                        <span className="mono" style={{ fontWeight: 600, color: 'var(--color-red)' }}>{localRec.stopLoss}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="text-muted">{lang === 'AR' ? 'العائد/المخاطرة' : 'R:R'}</span>
                        <span className="mono" style={{ fontWeight: 600, color: localRec.riskReward >= 1.5 ? 'var(--color-green)' : 'var(--color-yellow)' }}>{localRec.riskReward}:1</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span className="text-muted">{lang === 'AR' ? 'الصعود' : 'Upside'}</span>
                        <span className="mono" style={{ fontWeight: 600, color: localRec.upsidePct >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{localRec.upsidePct >= 0 ? '+' : ''}{localRec.upsidePct}%</span>
                      </div>
                    </div>
                    {/* Bear / Base / Bull targets */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', gap: '6px' }}>
                      {[
                        { k: lang === 'AR' ? 'متشائم' : 'Bear', v: localRec.targets.bear, c: 'var(--color-red)' },
                        { k: lang === 'AR' ? 'أساسي' : 'Base', v: localRec.targets.base, c: 'var(--color-blue)' },
                        { k: lang === 'AR' ? 'متفائل' : 'Bull', v: localRec.targets.bull, c: 'var(--color-green)' },
                      ].map(t => (
                        <div key={t.k} style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
                          <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{t.k}</div>
                          <div className="mono" style={{ fontSize: '0.78rem', fontWeight: 700, color: t.c }}>{t.v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Position sizing + probability cone */}
                {localRec && (localRec.positionSizing || localRec.probabilityCone) && (
                  <div style={{ display: 'grid', gridTemplateColumns: localRec.positionSizing && localRec.probabilityCone ? '1fr 1fr' : '1fr', gap: '10px' }}>
                    {localRec.positionSizing && localRec.positionSizing.shares > 0 && (
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px' }}>
                        <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{lang === 'AR' ? `حجم المركز (مخاطرة ${localRec.positionSizing.capitalAtRiskPct}%)` : `SIZE (risk ${localRec.positionSizing.capitalAtRiskPct}%)`}</div>
                        <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-blue)' }}>{localRec.positionSizing.shares.toLocaleString()} <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{lang === 'AR' ? 'سهم' : 'sh'}</span></div>
                        <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{lang === 'AR' ? 'أقصى خسارة' : 'max loss'} ≈ EGP {localRec.positionSizing.riskAmount.toLocaleString()}</div>
                      </div>
                    )}
                    {localRec.probabilityCone && (
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px' }}>
                        <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{lang === 'AR' ? 'نطاق 68% خلال 3 أشهر' : '68% range · 3 mo'}</div>
                        <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                          <span style={{ color: 'var(--color-red)' }}>{localRec.probabilityCone.lo68}</span>
                          <span style={{ color: 'var(--text-muted)' }}> — </span>
                          <span style={{ color: 'var(--color-green)' }}>{localRec.probabilityCone.hi68}</span>
                        </div>
                        <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{lang === 'AR' ? 'إحصائياً من التذبذب' : 'statistical, from volatility'}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Factor breakdown */}
                {localRec?.factors && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>{lang === 'AR' ? 'تحليل العوامل' : 'FACTOR BREAKDOWN'}</span>
                    {localRec.factors.map(f => {
                      const pos = f.score >= 0;
                      const mag = Math.min(50, Math.abs(f.score) / 2);
                      return (
                        <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.68rem' }}>
                          <span style={{ width: '38%', color: 'var(--text-secondary)' }}>{lang === 'AR' ? f.label_ar : f.label}</span>
                          <div style={{ flex: 1, position: 'relative', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.15)' }} />
                            <div style={{ position: 'absolute', top: 0, bottom: 0, borderRadius: '4px',
                              left: pos ? '50%' : `${50 - mag}%`, width: `${mag}%`,
                              background: pos ? 'var(--color-green)' : 'var(--color-red)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Key signals */}
                {signalsList.length > 0 && (
                  <div style={{ direction: lang === 'AR' ? 'rtl' : 'ltr' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>{lang === 'AR' ? 'الإشارات الرئيسية' : 'KEY SIGNALS'}</span>
                    <ul style={{ margin: '6px 0 0', paddingInlineStart: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {signalsList.slice(0, 4).map((s, i) => (
                        <li key={i} style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* AI narrative (only when generated) */}
                {aiNarrative && (
                  <div style={{
                    fontSize: '0.82rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.6',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    direction: lang === 'AR' ? 'rtl' : 'ltr',
                    textAlign: lang === 'AR' ? 'right' : 'left'
                  }}>
                    {aiNarrative}
                  </div>
                )}

                {/* Invalidation — what would prove this wrong */}
                {localRec && (
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', lineHeight: 1.45, fontStyle: 'italic', direction: lang === 'AR' ? 'rtl' : 'ltr' }}>
                    ⚠ {lang === 'AR' ? localRec.invalidation_ar : localRec.invalidation}
                  </div>
                )}

                {/* Sentiment + composite footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', direction: lang === 'AR' ? 'rtl' : 'ltr' }}>
                  <span style={{ color: accent, fontWeight: 600 }}>{lang === 'AR' ? sentValAr : sentVal}</span>
                  {localRec
                    ? <span className="text-muted">{lang === 'AR' ? 'النتيجة المركبة' : 'Composite'}: <span className="mono" style={{ color: accent, fontWeight: 700 }}>{localRec.compositeScore > 0 ? '+' : ''}{localRec.compositeScore}</span> · <span style={{ fontSize: '0.58rem' }}>{localRec.asOf}</span></span>
                    : <span className="text-blue" style={{ fontWeight: 600 }}>{targetPriceVal ? `EGP ${targetPriceVal}` : 'N/A'}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


function PerformanceDashboard({ transactions, holdings, analyticsData, walletBalance, marketData }: { transactions: Transaction[], holdings: Holding[], analyticsData: any, walletBalance: number, marketData: any }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('6m');
  const [compareTickers, setCompareTickers] = useState<string[]>(() => {
    const saved = localStorage.getItem('boltscan_compare_tickers');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [widgetSymbol, setWidgetSymbol] = useState('EGX:EGX30');

  useEffect(() => {
    const calculateHistory = async () => {
      setLoading(true);
      try {
        const uniqueTickers = [...new Set(transactions.filter(t => t.ticker && ['Buy', 'Sell'].includes(t.type)).map(t => t.ticker))];
        const indexTicker = '^EGX30';
        const allCompareTickers = [...new Set([...compareTickers, indexTicker])];
        
        const histories: Record<string, any[]> = {};
        await Promise.all([...new Set([...uniqueTickers, ...allCompareTickers])].map(async ticker => {
          try {
            const res = await fetch(`/api/history?symbol=${encodeURIComponent(ticker!)}&range=${range}`);
            const json = await res.json();
            if (Array.isArray(json)) histories[ticker!] = json;
          } catch (e) { console.error(e); }
        }));

        const indexHistory = histories[indexTicker];
        if (!indexHistory || indexHistory.length === 0) throw new Error("Index data unavailable");

        const firstTxDate = transactions.length > 0 ? [...transactions].sort((a,b) => a.date.localeCompare(b.date))[0].date : null;
        const firstIndexPoint = firstTxDate ? (indexHistory.find(p => p.date.split('T')[0] >= firstTxDate) || indexHistory[0]) : indexHistory[0];
        const startIndexPrice = firstIndexPoint ? firstIndexPoint.close : 1;

        const perfPoints = indexHistory.map(indexPoint => {
          const date = indexPoint.date.split('T')[0];
          const hasStarted = firstTxDate && date >= firstTxDate;

          let totalCostAtDate = 0;
          let totalMarketValAtDate = 0;
          let totalRealizedAndDivsAtDate = 0;
          let totalInvestedCapAtDate = 0;

          if (hasStarted) {
            // Compute cumulative invested capital deployed up to date
            transactions
              .filter(t => t.date <= date && (t.type === 'Buy' || t.type === 'Deposit'))
              .forEach(t => {
                if (t.type === 'Buy') totalInvestedCapAtDate += (t.quantity! * t.price!) + (t.fees || 0);
                else if (t.type === 'Deposit') totalInvestedCapAtDate += Math.abs(t.price || 0);
              });

            uniqueTickers.forEach(ticker => {
              const hist = histories[ticker!];
              if (!hist) return;
              const point = hist.find(p => p.date.split('T')[0] === date) || [...hist].reverse().find(p => p.date.split('T')[0] < date);
              if (!point) return;

              let shares = 0;
              let cost = 0;

              transactions
                .filter(t => t.ticker === ticker && t.date <= date)
                .sort((a, b) => a.date.localeCompare(b.date))
                .forEach(tx => {
                  if (tx.type === 'Buy') {
                    shares += tx.quantity!;
                    cost += (tx.quantity! * tx.price) + (tx.fees || 0);
                  } else if (tx.type === 'Sell') {
                    const avg = shares > 0 ? cost / shares : 0;
                    const costSold = avg * tx.quantity!;
                    const net = (tx.quantity! * tx.price) - (tx.fees || 0);
                    totalRealizedAndDivsAtDate += (net - costSold);
                    shares -= tx.quantity!;
                    cost -= costSold;
                  } else if (tx.type === 'Dividend') {
                    totalRealizedAndDivsAtDate += (tx.price || 0) - (tx.fees || 0);
                  }
                });

              if (shares > 0) {
                totalCostAtDate += cost;
                totalMarketValAtDate += (shares * point.close);
              }
            });
          }

          const baseCapAtDate = totalInvestedCapAtDate > 0
            ? totalInvestedCapAtDate
            : (totalCostAtDate > 0 ? totalCostAtDate : 1);

          const returnPct = baseCapAtDate > 0 
            ? ((totalMarketValAtDate - totalCostAtDate + totalRealizedAndDivsAtDate) / baseCapAtDate) * 100 
            : 0;

          const portfolioNormalized = hasStarted ? (100 + returnPct) : 100;
          const marketNormalized = (indexPoint.close / startIndexPrice) * 100;

          const comparisons: any = {};
          allCompareTickers.forEach(t => {
            const hist = histories[t];
            const startP = firstTxDate ? (hist?.find(x => x.date.split('T')[0] >= firstTxDate) || hist?.[0]) : hist?.[0];
            const startVal = startP?.close || 1;
            const p = hist?.find(x => x.date.split('T')[0] === date) || [...(hist || [])].reverse().find(x => x.date.split('T')[0] < date);
            comparisons[t] = ((p?.close || 1) / startVal) * 100;
          });

          return { 
            date, 
            displayDate: new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), 
            totalValue: totalMarketValAtDate,
            portfolio: portfolioNormalized,
            market: marketNormalized,
            hasStarted,
            ...comparisons
          };
        });

        setData(perfPoints);
      } catch (e: any) { console.error(e.message); }
      finally { setLoading(false); }
    };

    calculateHistory();
  }, [transactions, compareTickers, range]);

  if (loading) return (
    <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
      <RefreshCw size={48} className="spinning text-blue" style={{ marginBottom: '1.5rem', opacity: 0.5 }} />
      <h3>Calculating Health Vectors...</h3>
    </div>
  );

  const lastPoint = data[data.length - 1];
  const portPerf = lastPoint ? lastPoint.portfolio - 100 : 0;
  const indexPerf = lastPoint ? lastPoint.market - 100 : 0;
  const alpha = portPerf - indexPerf;

  const uniqueSectors = [...new Set(holdings.map(h => h.sector))].length;
  // Diversification blends sector spread with single-name concentration (HHI penalty).
  const posValues = holdings.map(h => h.shares * h.livePrice);
  const eqTotal = posValues.reduce((a, b) => a + b, 0) || 1;
  const hhi = posValues.reduce((a, v) => a + Math.pow(v / eqTotal, 2), 0); // 0..1, lower = more diversified
  const sectorSpread = Math.min(100, (uniqueSectors / 5) * 100);
  const concentrationScore = Math.max(0, 100 - (hhi * 100)); // penalize concentration
  const divScore = Math.round(sectorSpread * 0.5 + concentrationScore * 0.5);
  // Alpha contributes continuously (capped), not as a binary flag.
  const alphaScore = Math.max(0, Math.min(100, 60 + alpha * 4));
  const healthScore = Math.round(divScore * 0.45 + alphaScore * 0.45 + 10);
  const grade = healthScore > 90 ? 'A+' : healthScore > 80 ? 'A' : healthScore > 70 ? 'B' : healthScore > 60 ? 'C' : 'D';


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', padding: '0 1.5rem 3rem' }}>
      
      {/* Allocation Snapshot (Market Sentinel removed — superseded by the Institutional
          Sentiment engine in Holding History and the Action Center in Wealth Center) */}
      <div>
          <div className="card" style={{ padding: '1.5rem', background: 'var(--bg-app)', border: '1px dashed var(--border-color)' }}>
            <h3 className="card-title" style={{ marginBottom: '1rem', fontSize: '1rem' }}>Allocation Snapshot</h3>
            {(() => {
              // Computed from real positions — no hardcoded advice.
              const pos = holdings.map((h: any) => ({ ticker: h.ticker, sector: h.sector, value: h.shares * h.livePrice }));
              const eq = pos.reduce((a, p) => a + p.value, 0) || 1;
              const top = [...pos].sort((a, b) => b.value - a.value)[0];
              const sectors = new Set(holdings.map((h: any) => h.sector));
              const cashPct = (walletBalance / (eq + walletBalance)) * 100;
              const topPct = top ? (top.value / eq) * 100 : 0;
              const concentrated = topPct > 25;
              return (
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  You hold <b>{holdings.length}</b> positions across <b>{sectors.size}</b> sectors.
                  Largest: <b>{top?.ticker}</b> at <b style={{ color: concentrated ? 'var(--color-yellow)' : 'var(--color-green)' }}>{topPct.toFixed(0)}%</b> of equity{concentrated ? ' — above the 25% single-name guideline; consider trimming.' : ' — within prudent limits.'}{' '}
                  Cash buffer is <b>{cashPct.toFixed(0)}%</b>. See the <b>Wealth Center</b> tab for risk, true returns and ranked actions.
                </p>
              );
            })()}
          </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '1.5rem' }}>
        <div className="card" style={{ padding: '1.5rem', borderLeft: '6px solid var(--color-blue)', display: 'flex', alignItems: 'center', gap: '2rem' }}>
           <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '50%', border: '6px solid rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', inset: '-6px', borderRadius: '50%', border: '6px solid var(--color-blue)', borderBottomColor: 'transparent' }}></div>
              <span style={{ fontSize: '1.5rem', fontWeight: 900 }}>{grade}</span>
           </div>
           <div>
              <h3 style={{ margin: 0 }}>Portfolio Health Score</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>Overall rating based on diversification & alpha</p>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '12px' }}>
                 <span className="badge badge-blue">Diversification <InfoTooltip term="Diversification" />: {divScore.toFixed(0)}%</span>
                 <span className={`badge ${alpha >= 0 ? 'badge-green' : 'badge-yellow'}`}>Alpha <InfoTooltip term="Alpha" />: {alpha.toFixed(1)}%</span>
              </div>
           </div>
        </div>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
           <p className="text-muted small-caps" style={{ marginBottom: '8px' }}>Active Holdings</p>
           <h2 style={{ margin: 0 }}>{holdings.length} Stocks</h2>
           <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>Across {uniqueSectors} industrial sectors</p>
        </div>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
           <p className="text-muted small-caps" style={{ marginBottom: '8px' }}>Performance Note</p>
           <h3 style={{ margin: 0, color: alpha >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
             {alpha >= 0 ? 'Beating EGX30' : 'Trailing Market'}
           </h3>
           <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>Alpha: {alpha.toFixed(2)}% vs Benchmark</p>
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <h4 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PlusCircle size={18} className="text-blue" /> Comparison Benchmarks
        </h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '1.5rem' }}>
          {compareTickers.map(ticker => (
            <div key={ticker} className="badge badge-blue" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
              <span style={{ fontWeight: 700 }}>{ticker}</span>
              <button onClick={() => setCompareTickers(prev => prev.filter(t => t !== ticker))} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
            </div>
          ))}
          <div style={{ position: 'relative' }}>
            <input 
              type="text" 
              placeholder="Search symbol to add..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ width: '250px', padding: '6px 12px', fontSize: '0.85rem' }}
            />
            {searchQuery.length > 1 && (
              <div style={{ 
                position: 'absolute', 
                top: '100%', 
                left: 0, 
                right: 0, 
                background: '#1a1b1e', 
                border: '1px solid #333', 
                borderRadius: '8px', 
                marginTop: '4px', 
                zIndex: 100, 
                maxHeight: '200px', 
                overflowY: 'auto',
                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)'
              }}>
                {Object.keys(marketData)
                  .filter(ticker => ticker.toLowerCase().includes(searchQuery.toLowerCase()) && !compareTickers.includes(ticker))
                  .slice(0, 10)
                  .map(ticker => (
                    <div 
                      key={ticker} 
                      onClick={() => {
                        if (!compareTickers.includes(ticker)) {
                          const newCompare = [...compareTickers, ticker];
                          setCompareTickers(newCompare);
                          localStorage.setItem('boltscan_compare_tickers', JSON.stringify(newCompare));
                        }
                        setSearchQuery('');
                      }}
                      style={{ 
                        padding: '8px 12px', 
                        cursor: 'pointer', 
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      className="hover-bg"
                    >
                      <span style={{ fontWeight: 700 }}>{ticker}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{marketData[ticker]?.company || ''}</span>
                    </div>
                  ))
                }
                {Object.keys(marketData).filter(t => t.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                  <div style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    No matching symbols found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '0', height: '720px' }}>
        <div style={{ padding: '1.5rem 1.5rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={18} className="text-blue" /> Live Market Intelligence</h3>
           <select value={widgetSymbol} onChange={(e) => setWidgetSymbol(e.target.value)} className="input-field" style={{ width: 'auto' }}>
             <option value="EGX:EGX30">EGX30 Index</option>
             {holdings.map(h => <option key={h.ticker} value={`EGX:${h.ticker.split('.')[0]}`}>{h.ticker}</option>)}
           </select>
        </div>
        <TradingViewWidget symbol={widgetSymbol} />
      </div>

      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
           <h3 style={{ margin: 0 }}><TrendingUp size={18} className="text-blue" /> Alpha vs EGX30</h3>
           <div className="time-filters">
             {['3m', '6m', '1y', 'ytd', 'max'].map(r => <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{r.toUpperCase()}</button>)}
           </div>
        </div>
        <div style={{ height: '400px', width: '100%' }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="displayDate" />
              <YAxis tickFormatter={(v) => `${(v-100).toFixed(0)}%`} />
              <Tooltip formatter={(v: any) => [`${(Number(v)-100).toFixed(2)}%`]} />
              <Legend />
              <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke="var(--color-blue)" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="market" name="EGX30" stroke="#94a3b8" strokeDasharray="5 5" dot={false} />
              {compareTickers.map((t, i) => <Line key={t} type="monotone" dataKey={t} stroke={['#f59e0b','#ec4899','#8b5cf6'][i%3]} strokeWidth={2} dot={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk & Safety Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* Diversification Card */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h4 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} className="text-blue" /> Sector Diversification
          </h4>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
             <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Exposure Balance</p>
             <div style={{ height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{ width: `${divScore}%`, height: '100%', background: 'var(--color-blue)', borderRadius: '4px' }}></div>
             </div>
             <p style={{ fontSize: '0.75rem', margin: '8px 0 0' }}>
               Current Score: <span style={{ fontWeight: 700 }}>{divScore.toFixed(0)}/100</span>
             </p>
          </div>
        </div>

        {/* Technical Safety Watchlist */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h4 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={18} className="text-red" /> Safety Watchlist
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
             {holdings.slice(0, 2).map(h => {
                const analysis = analyticsData[h.ticker];
                const sma50 = analysis?.sma50 ? parseFloat(analysis.sma50) : null;
                const stopPrice = sma50 ? sma50 * 0.95 : null;
                const isSafe = stopPrice ? h.livePrice > stopPrice : true;
                return (
                   <div key={h.ticker} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: `3px solid ${isSafe ? 'var(--color-green)' : 'var(--color-red)'}` }}>
                      <span style={{ fontWeight: 700 }}>{h.ticker}</span>
                      <span style={{ fontSize: '0.8rem' }}>{isSafe ? 'SAFE' : 'CRITICAL'}</span>
                   </div>
                );
             })}
          </div>
        </div>
      </div>

    </div>
  );
}

function MarketIntelligence({ watchlist, setWatchlist, marketData, analyticsData, setAnalysisStock, shariaTickers, onSelectStock }: any) {
  const [newTicker, setNewTicker] = useState('');
  const [showShariaOnly, setShowShariaOnly] = useState(false);

  // Sector Heatmap Calculation
  const sectors: Record<string, { change: number; count: number }> = {};
  Object.entries(marketData).forEach(([, data]: any) => {
    if (data.sector) {
      if (!sectors[data.sector]) sectors[data.sector] = { change: 0, count: 0 };
      sectors[data.sector].change += data.changePercent || 0;
      sectors[data.sector].count += 1;
    }
  });
  const sectorPerformance = Object.entries(sectors)
    .map(([name, data]) => ({ name, avgChange: data.change / data.count }))
    .sort((a, b) => b.avgChange - a.avgChange);

  const addToWatchlist = () => {
    if (newTicker && !watchlist.includes(newTicker.toUpperCase())) {
      setWatchlist([...watchlist, newTicker.toUpperCase()]);
      setNewTicker('');
    }
  };

  const removeFromWatchlist = (t: string) => {
    setWatchlist(watchlist.filter((x: string) => x !== t));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Sector Heatmap */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} className="text-blue" /> Sector Heatmap
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
          {sectorPerformance.map(s => (
            <div key={s.name} style={{ 
              padding: '1rem', 
              borderRadius: '12px', 
              background: s.avgChange >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${s.avgChange >= 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 4px' }}>{s.name}</p>
              <p style={{ fontSize: '1rem', fontWeight: 800, color: s.avgChange >= 0 ? 'var(--color-green)' : 'var(--color-red)', margin: 0 }}>
                {s.avgChange >= 0 ? '+' : ''}{s.avgChange.toFixed(2)}%
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Watchlist */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Search size={18} className="text-blue" /> AI Market Watchlist
          </h3>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
             <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
               <input type="checkbox" checked={showShariaOnly} onChange={e => setShowShariaOnly(e.target.checked)} />
               <span>AAOIFI Compliant Only</span>
             </label>
             <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                <input 
                  className="input-field" 
                  style={{ width: '150px', padding: '8px' }} 
                  placeholder="Search Ticker..." 
                  value={newTicker} 
                  onChange={e => setNewTicker(e.target.value)} 
                />
                <button className="btn-primary" style={{ padding: '8px 12px' }} onClick={addToWatchlist}><Plus size={16} /></button>
                
                {newTicker.length > 1 && (
                  <div style={{ 
                    position: 'absolute', 
                    top: '100%', 
                    left: 0, 
                    right: 0, 
                    background: '#1a1b1e', 
                    border: '1px solid #333', 
                    borderRadius: '8px', 
                    marginTop: '4px', 
                    zIndex: 100, 
                    maxHeight: '200px', 
                    overflowY: 'auto',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)'
                  }}>
                    {Object.keys(marketData)
                      .filter(ticker => ticker.toLowerCase().includes(newTicker.toLowerCase()) && !watchlist.includes(ticker))
                      .slice(0, 8)
                      .map(ticker => (
                        <div 
                          key={ticker} 
                          onClick={() => {
                            if (!watchlist.includes(ticker)) {
                              setWatchlist([...watchlist, ticker]);
                            }
                            setNewTicker('');
                          }}
                          style={{ 
                            padding: '8px 12px', 
                            cursor: 'pointer', 
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          className="hover-bg"
                        >
                          <span style={{ fontWeight: 700 }}>{ticker}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{marketData[ticker]?.company || ''}</span>
                        </div>
                      ))
                    }
                  </div>
                )}
             </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Price</th>
                <th style={{ textAlign: 'right' }}>Change</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>AI Sentiment</th>
                <th style={{ textAlign: 'center' }}>Recommendation</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {watchlist.filter((t:string) => !showShariaOnly || shariaTickers.includes(t)).map((t: string) => {
                const data = marketData[t];
                const ai = analyticsData[t];
                const isSharia = shariaTickers.includes(t);
                return (
                  <tr 
                    key={t} 
                    className="clickable-row" 
                    onClick={() => onSelectStock && onSelectStock(t)}
                    title="Click to view stock history & details"
                  >
                    <td style={{ fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {t}
                        {isSharia && <span title="AAOIFI Compliant" style={{ color: 'var(--color-green)', display: 'flex' }}><ShieldCheck size={14} /></span>}
                      </div>
                    </td>
                    <td className="mono">EGP {data?.price?.toFixed(2) || '-'}</td>
                    <td className="mono" style={{ textAlign: 'right', color: (data?.changePercent || 0) >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {(data?.changePercent || 0) >= 0 ? '+' : ''}{(data?.changePercent || 0).toFixed(2)}%
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isSharia ? <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>HALAL</span> : <span className="badge badge-yellow" style={{ fontSize: '0.65rem' }}>NON-COMPLIANT</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${ai?.sentiment?.includes('BULL') ? 'badge-green' : ai?.sentiment?.includes('BEAR') ? 'badge-red' : 'badge-yellow'}`}>
                        {ai?.sentiment || 'Pending'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${ai?.recommendation?.includes('BUY') ? 'badge-blue' : ai?.recommendation?.includes('SELL') ? 'badge-red' : 'badge-purple'}`}>
                        {ai?.recommendation || 'No Analysis'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setAnalysisStock({ ticker: t, company: data?.name || t, livePrice: data?.price || 0, sector: data?.sector || 'Unknown' }); }} title="Analyze"><Brain size={16} className="text-blue" /></button>
                      <button className="icon-btn" onClick={(e) => { e.stopPropagation(); removeFromWatchlist(t); }} title="Remove"><Trash2 size={16} className="text-red" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {/* Discovery: Sharia Compliant Stocks */}
      <div className="card" style={{ padding: '1.5rem', background: 'rgba(34,197,94,0.03)', border: '1px solid rgba(34,197,94,0.1)' }}>
        <h3 style={{ margin: '0 0 1rem', color: 'var(--color-green)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} /> Shariah Compliant Discovery (AAOIFI)
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Based on the EGX33 Shariah Index standards. These companies meet strict qualitative and financial criteria regarding core activities and debt ratios.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {shariaTickers.map((t: string) => (
            <button 
              key={t} 
              className="btn-secondary" 
              style={{ fontSize: '0.75rem', padding: '6px 12px', borderColor: 'rgba(34,197,94,0.2)' }}
              onClick={() => {
                if (!watchlist.includes(t)) setWatchlist([...watchlist, t]);
              }}
            >
              + {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StrategySimulator({ holdings, analyticsData, totalMarketValue }: { holdings: Holding[], analyticsData: any, totalMarketValue: number }) {
  const [selectedTicker, setSelectedTicker] = useState(holdings[0]?.ticker || '');
  const [simQty, setSimQty] = useState(0);
  const [simPrice, setSimPrice] = useState(0);

  const h = holdings.find(x => x.ticker === selectedTicker);
  const ai = analyticsData[selectedTicker];
  
  // Calculations
  const currentShares = h?.shares || 0;
  const currentAvg = h?.avgCost || 0;
  const currentVal = currentShares * (h?.livePrice || 0);
  const currentCost = h?.totalCost || 0;
  
  const purchaseCost = simQty * simPrice;
  const newShares = currentShares + simQty;
  const newTotalCost = currentCost + purchaseCost;
  const newAvg = newShares > 0 ? newTotalCost / newShares : 0;
  
  const avgImprovement = currentAvg > 0 ? ((newAvg - currentAvg) / currentAvg) * 100 : 0;
  const newTotalValue = newShares * (h?.livePrice || 0);
  
  // Weight Analysis
  const currentWeight = totalMarketValue > 0 ? (currentVal / totalMarketValue) * 100 : 0;
  const newWeight = (totalMarketValue + purchaseCost) > 0 ? (newTotalValue / (totalMarketValue + purchaseCost)) * 100 : 0;

  // Break-even
  const breakEvenDistance = h?.livePrice ? ((newAvg - h.livePrice) / h.livePrice) * 100 : 0;

  // AI Target ROI
  const targetPrice = ai?.targetPrice || 0;
  const projectedROI = targetPrice > 0 ? ((targetPrice - newAvg) / newAvg) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div className="card" style={{ padding: '2rem' }}>
        <h3 style={{ margin: '0 0 2rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Sparkles size={20} className="text-yellow" /> Institutional Strategy Lab
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
          
          {/* Inputs Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px' }}>
               <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem' }}>SELECT ACTIVE HOLDING</label>
               <select className="input-field" value={selectedTicker} onChange={e => setSelectedTicker(e.target.value)}>
                 {holdings.map(hx => <option key={hx.ticker} value={hx.ticker}>{hx.ticker} - {hx.company}</option>)}
               </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
               <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px' }}>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem' }}>QUANTITY</label>
                  <input type="number" className="input-field" value={simQty} onChange={e => setSimQty(Number(e.target.value))} />
               </div>
               <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px' }}>
                  <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem' }}>PRICE (EGP)</label>
                  <input type="number" className="input-field" value={simPrice} onChange={e => setSimPrice(Number(e.target.value))} />
               </div>
            </div>
          </div>

          {/* Projection Engine */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <div className="card" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                   <span className="text-muted">Weight Impact</span>
                   <span style={{ fontWeight: 700 }}>{currentWeight.toFixed(1)}% → <span className="text-blue">{newWeight.toFixed(1)}%</span></span>
                </div>
                <div style={{ height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
                   <div style={{ width: `${newWeight}%`, height: '100%', background: newWeight > 25 ? 'var(--color-red)' : 'var(--color-blue)' }}></div>
                </div>
             </div>

             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                   <p className="text-muted" style={{ fontSize: '0.7rem', margin: '0 0 5px' }}>Avg Cost Change</p>
                   <h3 style={{ margin: 0, color: avgImprovement <= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {avgImprovement.toFixed(2)}%
                   </h3>
                </div>
                <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                   <p className="text-muted" style={{ fontSize: '0.7rem', margin: '0 0 5px' }}>Break-Even Distance</p>
                   <h3 style={{ margin: 0 }}>
                      {breakEvenDistance > 0 ? '+' : ''}{breakEvenDistance.toFixed(2)}%
                   </h3>
                </div>
             </div>

             {targetPrice > 0 && (
                <div className="card" style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.1)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                         <p className="text-muted" style={{ fontSize: '0.7rem', margin: 0 }}>AI TARGET PROJECTED ROI</p>
                         <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Based on EGP {targetPrice} target</p>
                      </div>
                      <h2 className="text-green" style={{ margin: 0 }}>+{projectedROI.toFixed(1)}%</h2>
                   </div>
                </div>
             )}
          </div>

        </div>

        <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: '4px solid var(--color-blue)' }}>
          <p style={{ fontSize: '0.85rem', margin: 0, color: 'var(--text-secondary)' }}>
            <Info size={14} style={{ marginRight: '8px' }} />
            <b>Institutional Note:</b> {newWeight > 20 
               ? `This purchase will make ${selectedTicker} more than 20% of your portfolio. This exceeds standard institutional risk limits for a single position.` 
               : `This trade maintains a healthy allocation profile. Your new break-even point is EGP ${newAvg.toFixed(2)}.`}
          </p>
        </div>
      </div>
    </div>
  );
}
export default App;
