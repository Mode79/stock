import { useState, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { 
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertTriangle, 
  Wallet, DollarSign, Activity, CheckCircle2, Clock, Plus, Trash2, X, Search, TrendingUp,
  BarChart2, Sparkles, Brain, Info, Target, ShieldAlert, Eye, Settings as SettingsIcon
} from 'lucide-react';
import { AreaChart, Area, LineChart, Line } from 'recharts';
import './index.css';

// --- TYPES ---
type TransactionType = 'Buy' | 'Sell' | 'Deposit' | 'Withdraw' | 'Dividend';

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

const getLogoUrl = (logoid: string | null | undefined) => {
  return logoid ? `https://s3-symbol-logo.tradingview.com/${logoid}.svg` : null;
};

// Initial state
const SEED_TRANSACTIONS: Transaction[] = [
  { id: 'dep1', date: '2026-04-01', type: 'Deposit', price: 150000, broker: 'System', fees: 0 },
  { id: 's1', date: '2026-04-28', type: 'Buy', ticker: 'MICH', quantity: 288, price: 35.48, broker: 'Thndr', fees: 17.77 },
  { id: 's2', date: '2026-04-28', type: 'Buy', ticker: 'ORWE', quantity: 448, price: 22.90, broker: 'Thndr', fees: 16.81 },
  { id: 's3', date: '2026-04-28', type: 'Buy', ticker: 'SUGR', quantity: 210, price: 49.49, broker: 'Thndr', fees: 15.99 },
  { id: 's4', date: '2026-04-28', type: 'Buy', ticker: 'MPCI', quantity: 58, price: 172.99, broker: 'Thndr', fees: 15.53 },
  { id: 's5', date: '2026-04-28', type: 'Buy', ticker: 'OLFI', quantity: 458, price: 22.28, broker: 'Thndr', fees: 15.75 },
  { id: 's6', date: '2026-04-28', type: 'Buy', ticker: 'AMOC', quantity: 1261, price: 8.40, broker: 'Thndr', fees: 16.24 },
  { id: 's7', date: '2026-04-28', type: 'Buy', ticker: 'SWDY', quantity: 121, price: 87.00, broker: 'Thndr', fees: 16.16 },
  { id: 's8', date: '2026-05-03', type: 'Buy', ticker: 'OLFI', quantity: 362, price: 22.15, broker: 'Telda', fees: 4.00 },
  { id: 's9', date: '2026-05-03', type: 'Buy', ticker: 'MPCI', quantity: 46, price: 172.41, broker: 'Telda', fees: 2.98 },
  { id: 's10', date: '2026-05-03', type: 'Buy', ticker: 'MICH', quantity: 228, price: 35.80, broker: 'Telda', fees: 3.05 },
  { id: 's11', date: '2026-05-03', type: 'Buy', ticker: 'SUGR', quantity: 163, price: 48.90, broker: 'Telda', fees: 3.00 },
  { id: 's12', date: '2026-05-03', type: 'Buy', ticker: 'ORWE', quantity: 400, price: 23.10, broker: 'Telda', fees: 3.30 },
  { id: 's13', date: '2026-05-03', type: 'Buy', ticker: 'SWDY', quantity: 98, price: 87.50, broker: 'Telda', fees: 4.15 },
  { id: 's14', date: '2026-05-03', type: 'Buy', ticker: 'AMOC', quantity: 1155, price: 8.66, broker: 'Telda', fees: 5.50 },
];

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [marketData, setMarketData] = useState<Record<string, any>>({});
  const [analyticsData, setAnalyticsData] = useState<Record<string, any>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  const [analyzingTicker, setAnalyzingTicker] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [staleData, setStaleData] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'history'>('portfolio');
  const [historyStock, setHistoryStock] = useState<string | null>(null);
  const [analysisStock, setAnalysisStock] = useState<Holding | null>(null);
  const [priceHistoryStock, setPriceHistoryStock] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [historySort, setHistorySort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [aiSettings, setAiSettings] = useState({
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    geminiKey: '',
    openaiKey: '',
    enableLogging: true,
  });
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

  const calculatePortfolio = () => {
    let walletBalance = 0;
    let totalDeposited = 0;
    let realizedPnL = 0;
    const holdingsMap: Record<string, { shares: number; totalCost: number }> = {};

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
          break;
        case 'Buy':
          if (tx.ticker && tx.quantity) {
            const cost = (tx.quantity * tx.price) + (tx.fees || 0);
            walletBalance -= cost;
            if (!holdingsMap[tx.ticker]) holdingsMap[tx.ticker] = { shares: 0, totalCost: 0 };
            holdingsMap[tx.ticker].shares += tx.quantity;
            holdingsMap[tx.ticker].totalCost += cost;
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

    return { holdings, walletBalance, totalDeposited, realizedPnL };
  };

  const { holdings, walletBalance, totalDeposited, realizedPnL } = calculatePortfolio();

  const fetchLivePrices = async () => {
    try {
      setIsUpdating(true);
      const tickers = Array.from(new Set(transactions.filter(t => t.ticker).map(t => `${t.ticker}.CA`)));
      if (tickers.length === 0) return;
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers })
      });
      const data = await res.json();
      setMarketData(data);
      setLastUpdated(new Date());
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
    setAnalyzingTicker('All Stocks');
    
    try {
      const results = await Promise.all(holdings.map(async h => {
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

      batchData.forEach(s => {
        const ticker = s.ticker.toUpperCase();
        const cleanTicker = ticker.split('.')[0];
        const aiKey = Object.keys(aiResultsProcessed).find(k => {
          const cleanK = k.toUpperCase().split('.')[0].replace('EGX:', '').trim();
          return cleanK === cleanTicker || ticker === k.toUpperCase();
        });

        const result = aiKey ? aiResultsProcessed[aiKey] : null;
        if (result) {
          finalAnalytics[s.ticker] = {
            ...analyticsData[s.ticker],
            sentiment: result.sentiment || result.Sentiment || 'NEUTRAL',
            recommendation: result.recommendation || result.Recommendation || 'HOLD',
            targetPrice: result.targetPrice || result.TargetPrice || s.stats.currentPrice * 1.1,
            rsi: s.stats.rsi,
            lastUpdate: new Date().toISOString()
          };
        }
      });

      saveAnalytics(finalAnalytics);
    } catch (e: any) {
      alert(`AI Intelligence Error: ${e.message || 'Operation failed'}`);
    } finally {
      setAnalyzingTicker(null);
      setIsAnalyzingAll(false);
    }
  };

  useEffect(() => {
    if (holdings.length > 0 && Object.keys(analyticsData).length === 0) {
      updateAllAnalytics();
    }
  }, [holdings.length]);

  useEffect(() => {
    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 60000);
    return () => clearInterval(interval);
  }, []);

  const totalMarketValue = holdings.reduce((sum, h) => sum + (h.shares * h.livePrice), 0);
  const totalInvested = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalPnL = totalMarketValue - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Activity className="text-blue" size={24} />
          <h2>Thunder Pro <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>EGX LIVE</span></h2>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="icon-btn" title="Settings" onClick={() => setIsSettingsOpen(true)}>
            <SettingsIcon size={20} />
          </button>
          <button className="btn-primary" onClick={fetchLivePrices} disabled={isUpdating}>
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
      </div>

      <main className="main-content">
        {activeTab === 'portfolio' ? (
          <>
            <div className="grid-cards">
              <div className="card" style={{ borderLeft: '4px solid var(--color-blue)' }}>
                <div className="card-header"><span className="card-title text-blue">Equity</span><Wallet size={20} className="text-blue" /></div>
                <h2 className="mono" style={{ fontSize: '2rem' }}>EGP {totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Basis EGP {totalInvested.toLocaleString()}</p>
              </div>
              <div className="card" style={{ borderLeft: `4px solid ${totalPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)'}` }}>
                <div className="card-header"><span className="card-title" style={{ color: totalPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>Unrealized P&L</span>{totalPnL >= 0 ? <ArrowUpRight size={20} className="text-green" /> : <ArrowDownRight size={20} className="text-red" />}</div>
                <h2 className="mono" style={{ fontSize: '2rem', color: totalPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{totalPnLPercent.toFixed(2)}% Performance</p>
              </div>
              <div className="card" style={{ borderLeft: '4px solid var(--color-yellow)' }}>
                <div className="card-header"><span className="card-title text-yellow">Wallet</span><DollarSign size={20} className="text-yellow" /></div>
                <h2 className="mono" style={{ fontSize: '2rem' }}>EGP {walletBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Realized: EGP {realizedPnL.toLocaleString()}</p>
              </div>
            </div>

            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="card-header" style={{ padding: '1.5rem' }}>
                <h3 className="card-title">Active Holdings</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => exportToCSV(holdings, 'portfolio_holdings')}>
                    Export CSV
                  </button>
                  {staleData && <div className="badge badge-yellow" style={{ fontSize: '0.7rem' }}><AlertTriangle size={12} /> Prices Stale</div>}
                  <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setIsModalOpen(true)}>
                    <Plus size={16} /> <span>Add</span>
                  </button>
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
                    <th style={{ textAlign: 'right' }}>Avg Value</th>
                    <th onClick={() => requestSort('livePrice')} style={{ cursor: 'pointer', textAlign: 'right' }}>Live Price <SortIndicator column="livePrice" /></th>
                    <th style={{ textAlign: 'right' }}>Live Value</th>
                    <th style={{ textAlign: 'right' }}>P&L (EGP)</th>
                    <th style={{ textAlign: 'center' }}>Sentiment</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedHoldings(holdings).map(h => {
                    const value = h.shares * h.livePrice;
                    const pnl = value - h.totalCost;
                    return (
                      <tr key={h.ticker}>
                        <td style={{ fontWeight: 700 }}>{h.ticker}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{h.company}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{h.shares}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{h.avgCost.toFixed(2)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{h.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{h.livePrice.toFixed(2)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="mono" style={{ textAlign: 'right', color: pnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{pnl >= 0 ? '+' : ''}{pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${analyticsData[h.ticker]?.sentiment?.includes('BULL') ? 'badge-green' : analyticsData[h.ticker]?.sentiment?.includes('BEAR') ? 'badge-red' : 'badge-yellow'}`}>
                            {analyticsData[h.ticker]?.sentiment || '-'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button className="icon-btn" onClick={() => setAnalysisStock(h)} title="View AI Intelligence"><Eye size={16} className="text-blue" /></button>
                          <button className="icon-btn" onClick={() => setPriceHistoryStock(h.ticker)} title="Price Performance"><TrendingUp size={16} className="text-green" /></button>
                          <button className="icon-btn" onClick={() => setHistoryStock(h.ticker)} title="Transaction History"><Clock size={16} className="text-blue" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
        ) : (
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header" style={{ padding: '1.5rem' }}>
              <h3 className="card-title">Transaction History</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => exportToCSV(transactions, 'transaction_history')}>
                  Export CSV
                </button>
                <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setIsModalOpen(true)}>
                  <Plus size={16} /> <span>Add New</span>
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => setHistorySort({ key: 'date', direction: historySort.direction === 'asc' ? 'desc' : 'asc' })} style={{ cursor: 'pointer' }}>
                      Date {historySort.key === 'date' ? (historySort.direction === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th onClick={() => setHistorySort({ key: 'ticker', direction: historySort.direction === 'asc' ? 'desc' : 'asc' })} style={{ cursor: 'pointer' }}>
                      Symbol {historySort.key === 'ticker' ? (historySort.direction === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    <th>Type</th>
                    <th>Broker</th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'right' }}>Fees</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...transactions].sort((a: any, b: any) => {
                    const dir = historySort.direction === 'asc' ? 1 : -1;
                    if (a[historySort.key] < b[historySort.key]) return -1 * dir;
                    if (a[historySort.key] > b[historySort.key]) return 1 * dir;
                    return 0;
                  }).map(tx => (
                    <tr key={tx.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{tx.date}</td>
                      <td style={{ fontWeight: 700 }}>{tx.ticker || '-'}</td>
                      <td>
                        <span className={`badge ${
                          tx.type === 'Buy' ? 'badge-blue' : 
                          tx.type === 'Sell' ? 'badge-red' : 
                          tx.type === 'Deposit' ? 'badge-green' : 
                          tx.type === 'Withdraw' ? 'badge-yellow' : 'badge-purple'
                        }`}>{tx.type}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{tx.broker || 'Thndr'}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{tx.quantity || '-'}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{tx.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{tx.fees || 0}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                        {(tx.type === 'Buy' ? (tx.quantity! * tx.price + tx.fees) : tx.type === 'Sell' ? (tx.quantity! * tx.price - tx.fees) : tx.price).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="icon-btn" onClick={() => deleteTransaction(tx.id)} title="Delete"><Trash2 size={16} className="text-red" /></button>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>No transactions found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <button 
        className="fab"
        onClick={() => setIsModalOpen(true)}
        style={{ position: 'fixed', bottom: '2rem', right: '2rem', width: '56px', height: '56px', borderRadius: '28px', background: 'var(--color-blue)', color: 'white', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Plus size={24} />
      </button>

      {/* --- MODALS --- */}
      
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

      {isModalOpen && (
        <TransactionForm 
          onClose={() => setIsModalOpen(false)} 
          onSave={async (tx) => {
            const id = Date.now().toString();
            await saveTransaction({ ...tx, id });
            setIsModalOpen(false);
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
          ticker={priceHistoryStock} 
          onClose={() => setPriceHistoryStock(null)} 
        />
      )}

    </div>
  );
}

// --- SUB-COMPONENTS ---

function TransactionForm({ onClose, onSave }: { onClose: () => void; onSave: (tx: any) => void }) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Buy' as TransactionType,
    ticker: '',
    quantity: 0,
    price: 0,
    broker: 'Thndr',
    fees: 0
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>New Transaction</h2>
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
              </select>
            </div>
            <div>
              <label className="text-muted" style={{ fontSize: '0.8rem' }}>Date</label>
              <input type="date" className="input-field" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            </div>
          </div>
          {['Buy', 'Sell'].includes(formData.type) && (
            <div className="grid-2" style={{ gap: '1rem' }}>
              <div>
                <label className="text-muted" style={{ fontSize: '0.8rem' }}>Ticker</label>
                <input type="text" className="input-field" placeholder="e.g. SWDY" value={formData.ticker} onChange={e => setFormData({...formData, ticker: e.target.value.toUpperCase()})} />
              </div>
              <div>
                <label className="text-muted" style={{ fontSize: '0.8rem' }}>Quantity</label>
                <input type="number" className="input-field" value={formData.quantity} onChange={e => setFormData({...formData, quantity: Number(e.target.value)})} />
              </div>
            </div>
          )}
          <div>
            <label className="text-muted" style={{ fontSize: '0.8rem' }}>{['Deposit', 'Withdraw', 'Dividend'].includes(formData.type) ? 'Amount (EGP)' : 'Price per Share (EGP)'}</label>
            <input type="number" className="input-field" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
          </div>
          <div className="grid-2" style={{ gap: '1rem' }}>
            <div className="form-group">
              <label>Broker Name</label>
              <input 
                type="text" 
                className="input-field" 
                value={formData.broker} 
                onChange={e => setFormData({ ...formData, broker: e.target.value })} 
                placeholder="e.g. Thndr, Hermes"
              />
            </div>
            <div className="form-group">
              <label>Fees (EGP)</label>
              <input 
                type="number" 
                className="input-field" 
                value={formData.fees} 
                onChange={e => setFormData({ ...formData, fees: Number(e.target.value) })} 
              />
            </div>
          </div>
          <button className="btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => onSave(formData)}>
            Save Transaction
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
                      tx.type === 'Withdraw' ? 'badge-yellow' : 'badge-purple'
                    }`}>{tx.type}</span>
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{tx.broker || 'Thndr'}</td>
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
      <div className="modal-content" style={{ maxWidth: '1100px', width: '95%', direction: t.dir, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
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


function PriceHistoryModal({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [range, setRange] = useState('1m');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/history?symbol=${ticker}&range=${range}`);
        const result = await res.json();
        if (Array.isArray(result)) {
          setData(result.map(d => ({
            ...d,
            date: new Date(d.date).toLocaleDateString(undefined, {
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
  }, [ticker, range]);

  const ranges = [
    { label: '1D', value: '1d' },
    { label: '1W', value: '1w' },
    { label: '1M', value: '1m' },
    { label: '6M', value: '6m' },
    { label: '1Y', value: '1y' },
    { label: 'MAX', value: 'max' },
  ];

  const currentPrice = data.length > 0 ? data[data.length - 1].close : 0;
  const startPrice = data.length > 0 ? data[0].close : 0;
  const change = currentPrice - startPrice;
  const changePct = (change / startPrice) * 100;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '900px', width: '90%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '10px', borderRadius: '12px' }}>
              <TrendingUp className="text-green" size={24} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{ticker} Price Performance</h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>EGP {currentPrice.toFixed(2)}</span>
                <span className={change >= 0 ? 'text-green' : 'text-red'} style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {Math.abs(changePct).toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={24} /></button>
        </div>

        <div style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem', background: 'var(--bg-card)', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
            {ranges.map(r => (
              <button 
                key={r.value}
                onClick={() => setRange(r.value)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: range === r.value ? 'var(--color-blue)' : 'transparent',
                  color: range === r.value ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div style={{ height: '400px', width: '100%', position: 'relative' }}>
            {loading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,11,14,0.5)', zIndex: 5, borderRadius: '12px' }}>
                <RefreshCw className="spinning text-blue" size={32} />
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={change >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={change >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis 
                  dataKey="date" 
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
                />
                <Tooltip 
                  contentStyle={{ background: '#1a1b1e', border: '1px solid #333', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff', fontSize: '0.9rem' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="close" 
                  stroke={change >= 0 ? '#22c55e' : '#ef4444'} 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorPrice)" 
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
