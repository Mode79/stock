import React, { useState, useEffect, useRef } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine
} from 'recharts';
import { 
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertTriangle, 
  Wallet, DollarSign, Activity, CheckCircle2, Clock, Plus, PlusCircle, Trash2, X, Search, TrendingUp,
  BarChart2, Sparkles, Brain, Info, Target, ShieldAlert, Eye, Settings as SettingsIcon, ShieldCheck, BookOpen
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
            <h2 className="text-blue">Getting Started</h2>
            <p>Welcome to Thunder Pro. This platform is designed to help you make data-driven investment decisions. Here is how to read your portfolio:</p>
            <div style={{ marginTop: '2rem' }}>
              <h4 className="text-yellow">Portfolio vs Market</h4>
              <p>In the <strong>Performance</strong> tab, we normalize your portfolio to a base of 100. This allows you to see if you are "beating the market" (EGX 30). If your blue line is above the purple line, you have <strong>Alpha</strong> (positive excess return).</p>
              
              <h4 className="text-green" style={{ marginTop: '1.5rem' }}>Realized vs Unrealized P&L</h4>
              <p><strong>Realized:</strong> Profit or loss from stocks you have already sold. This is "cash in hand".</p>
              <p><strong>Unrealized:</strong> Current value of your holdings compared to what you paid. This changes every minute with the market.</p>
            </div>
          </div>
        )}

        {activeSection === 'technical' && (
          <div className="fade-in">
            <h2 className="text-blue">Technical Indicators</h2>
            <div style={{ display: 'grid', gap: '2rem', marginTop: '2rem' }}>
              <div>
                <h4 className="text-green">RSI (Relative Strength Index)</h4>
                <p>Measures the speed and change of price movements. It ranges from 0 to 100.</p>
                <ul>
                  <li><strong>Overbought (&gt; 70):</strong> The stock might be expensive and due for a correction (Consider Selling).</li>
                  <li><strong>Oversold (&lt; 30):</strong> The stock might be undervalued and due for a bounce (Consider Buying).</li>
                </ul>
              </div>
              <div>
                <h4 className="text-yellow">SMA (Simple Moving Average)</h4>
                <p>The average price over a specific period (e.g., 20 or 50 days). It "smooths" out price noise to show the true trend.</p>
                <p>If the current price is <strong>above</strong> the SMA, the trend is generally bullish.</p>
              </div>
              <div>
                <h4 className="text-red">Support &amp; Resistance</h4>
                <p><strong>Support:</strong> The "floor" where price usually stops falling. Buying happens here.</p>
                <p><strong>Resistance:</strong> The "ceiling" where price usually stops rising. Selling happens here.</p>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'risk' && (
          <div className="fade-in">
            <h2 className="text-blue">Understanding Risk</h2>
            <div style={{ marginTop: '2rem' }}>
              <h4 className="text-red">Maximum Drawdown (Max DD)</h4>
              <p>The largest drop from a peak to a trough. It tells you the "worst-case scenario" loss you would have experienced if you bought at the absolute top and sold at the absolute bottom.</p>
              
              <h4 className="text-yellow" style={{ marginTop: '1.5rem' }}>Volatility (Annualized)</h4>
              <p>A measure of how much a stock's price swings. High volatility means high risk but potential for high reward. Low volatility stocks (like utility companies) are generally safer but slower.</p>
            </div>
          </div>
        )}

        {activeSection === 'judgement' && (
          <div className="fade-in">
            <h2 className="text-blue">How to Judge: Buy or Sell?</h2>
            <p>Using the AI Intelligence and Technicals together is the key to professional trading.</p>
            
            <div style={{ marginTop: '2rem', background: 'rgba(16, 185, 129, 0.1)', padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid var(--color-green)' }}>
              <h4 className="text-green">When to BUY (Bullish Signal)</h4>
              <ul>
                <li>AI Sentiment is <strong>Bullish</strong> or <strong>Strong Buy</strong>.</li>
                <li>RSI is low (near or below 30).</li>
                <li>Price is near a <strong>Support</strong> level.</li>
                <li>Price is starting to trend above the <strong>SMA</strong>.</li>
              </ul>
            </div>

            <div style={{ marginTop: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid var(--color-red)' }}>
              <h4 className="text-red">When to SELL (Bearish Signal)</h4>
              <ul>
                <li>AI Sentiment is <strong>Bearish</strong> or <strong>Sell</strong>.</li>
                <li>RSI is high (above 70).</li>
                <li>Price is struggling at a <strong>Resistance</strong> level.</li>
                <li>Price breaks <strong>below</strong> the SMA trend line.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [marketData, setMarketData] = useState<Record<string, any>>({});
  const [analyticsData, setAnalyticsData] = useState<Record<string, any>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
  const [analyzingTicker, setAnalyzingTicker] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>(['COMI', 'EKHO', 'TMGH', 'ABUK']);
  const [staleData, setStaleData] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'history' | 'risk' | 'performance' | 'market' | 'simulator' | 'holdingHistory' | 'learning'>('portfolio');
  const [historyStock, setHistoryStock] = useState<string | null>(null);
  const [analysisStock, setAnalysisStock] = useState<Holding | null>(null);
  const [priceHistoryStock, setPriceHistoryStock] = useState<Holding | null>(null);
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
      const tickers = Array.from(new Set([
        ...(transactions || []).filter(t => t.ticker).map(t => `${t.ticker!.trim().toUpperCase()}.CA`),
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
            rsi: s.stats?.rsi || '50.0',
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
  }, [transactions, watchlist]); // Reset interval when data changes to ensure latest state is captured

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
        <button 
          onClick={() => setActiveTab('risk')}
          style={{ 
            padding: '1rem 0.5rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'risk' ? '2px solid var(--color-blue)' : '2px solid transparent',
            color: activeTab === 'risk' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <ShieldAlert size={16} /> Risk Analysis
        </button>
        <button 
          onClick={() => setActiveTab('performance')}
          style={{ 
            padding: '1rem 0.5rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'performance' ? '2px solid var(--color-blue)' : '2px solid transparent',
            color: activeTab === 'performance' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <TrendingUp size={16} /> Performance Analysis
        </button>
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
          onClick={() => setActiveTab('learning')}
          style={{ 
            padding: '1rem 0.5rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'learning' ? '2px solid var(--color-blue)' : '2px solid transparent',
            color: activeTab === 'learning' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <BookOpen size={16} /> Learning Center
        </button>
      </div>

      <main className="main-content">
        {activeTab === 'market' && <MarketIntelligence watchlist={watchlist} setWatchlist={setWatchlist} marketData={marketData} analyticsData={analyticsData} setAnalysisStock={setAnalysisStock} shariaTickers={SHARIA_TICKERS} />}
        {activeTab === 'simulator' && <StrategySimulator holdings={holdings} />}
        {activeTab === 'performance' && <PerformanceDashboard transactions={transactions} />}
        {activeTab === 'risk' && <RiskDashboard holdings={holdings} />}
        {activeTab === 'holdingHistory' && <HoldingHistory holdings={holdings} analyticsData={analyticsData} />}
        {activeTab === 'learning' && <LearningCenter />}

        {activeTab === 'portfolio' && (
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
                    <th style={{ textAlign: 'right' }}>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedHoldings(holdings).map(h => {
                    const value = h.shares * h.livePrice;
                    const pnl = value - h.totalCost;
                    const pnlPct = h.totalCost > 0 ? (pnl / h.totalCost) * 100 : 0;
                    return (
                      <tr key={h.ticker}>
                        <td style={{ fontWeight: 700 }}>{h.ticker}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{h.company}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{h.shares}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{h.avgCost.toFixed(2)}</td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{h.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{h.livePrice.toFixed(2)}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="mono" style={{ textAlign: 'right', color: pnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                          <div>{pnl >= 0 ? '+' : ''}{pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <UnrealizedPnLHistory transactions={transactions} />
          </>
        )}

        {activeTab === 'history' && (
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
          stock={priceHistoryStock} 
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

function UnrealizedPnLHistory({ transactions }: { transactions: Transaction[] }) {
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
        const firstTxDate = transactions.sort((a,b) => a.date.localeCompare(b.date))[0].date;
        
        const points = allDates.filter(d => d >= firstTxDate).map(date => {
          let totalPnL = 0;
          
          targetTickers.forEach(ticker => {
            const history = histories[ticker];
            if (!history) return;

            const pricePoint = history.find(p => p.date.split('T')[0] === date) || [...history].reverse().find(p => p.date.split('T')[0] < date);
            if (!pricePoint) return;

            // Calculate holdings up to this date
            let shares = 0;
            let totalCost = 0;
            transactions.filter(t => t.ticker === ticker && t.date <= date).sort((a,b) => a.date.localeCompare(b.date)).forEach(tx => {
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

            if (shares > 0) {
              const currentValue = shares * pricePoint.close;
              totalPnL += (currentValue - totalCost);
            }
          });

          return {
            date,
            displayDate: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }),
            pnl: totalPnL
          };
        });

        setData(points);
      } catch (e) {
        console.error('PnL History Error:', e);
      } finally {
        setLoading(false);
      }
    };

    calculateHistory();
  }, [transactions, selectedTicker, range]);

  return (
    <div className="card" style={{ marginTop: '2rem', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} className="text-green" /> Unrealized P&L Trend
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Historical profit/loss evolution since first purchase
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
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
                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-green)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-green)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="pnlGradientRed" x1="0" y1="0" x2="0" y2="1">
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
                formatter={(val: number) => [`EGP ${val.toLocaleString()}`, 'Unrealized P&L']}
              />
              <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="3 3" />
              <Area 
                type="monotone" 
                dataKey="pnl" 
                stroke={data.length > 0 && data[data.length - 1]?.pnl >= 0 ? 'var(--color-green)' : 'var(--color-red)'} 
                strokeWidth={3}
                dot={data.length < 10 ? { r: 4, strokeWidth: 2, fill: 'var(--bg-card)' } : false}
                activeDot={{ r: 6, strokeWidth: 0 }}
                fillOpacity={1} 
                fill={`url(#${data.length > 0 && data[data.length - 1]?.pnl >= 0 ? 'pnlGradient' : 'pnlGradientRed'})`}
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
function HoldingHistory({ holdings, analyticsData }: { holdings: Holding[], analyticsData: Record<string, any> }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState('6m');
  const [visibleTickers, setVisibleTickers] = useState<string[]>([]);
  const [showTrend, setShowTrend] = useState(false);
  const [tickerHistories, setTickerHistories] = useState<Record<string, any[]>>({});
  const [lang, setLang] = useState<'EN' | 'AR'>('EN');

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

                // SMA-20 Trend
                if (pIndex >= 20) {
                   const slice = h.slice(pIndex - 20, pIndex);
                   const sma = slice.reduce((a, b) => a + b.close, 0) / 20;
                   point[`${ticker}_trend`] = (sma / startPrice) * 100;
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
  }, [visibleTickers, range]);

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
            <Sparkles size={14} /> {showTrend ? 'Hide Trends' : 'Show Trends'}
          </button>
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
              contentStyle={{ background: '#1a1b1e', border: '1px solid #333', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
              itemStyle={{ fontSize: '12px' }}
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
              </React.Fragment>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Intelligence & Analysis Grid */}
      <div style={{ marginTop: '3rem' }}>
        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={22} className="text-blue" /> Institutional Sentiment & Analysis
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {holdings.filter(h => visibleTickers.includes(h.ticker)).map(h => {
            const analysis = analyticsData[h.ticker];
            const isBullish = analysis?.sentiment?.toUpperCase().includes('BULL');
            const isBearish = analysis?.sentiment?.toUpperCase().includes('BEAR');
            
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

            return (
              <div key={h.ticker} className="card" style={{ 
                padding: '1.5rem', 
                borderTop: `4px solid ${isBullish ? 'var(--color-green)' : isBearish ? 'var(--color-red)' : 'var(--color-yellow)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                position: 'relative',
                transition: 'transform 0.2s',
                cursor: 'default'
              }}>
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
                  <div className={`badge ${isBullish ? 'badge-green' : isBearish ? 'badge-red' : 'badge-yellow'}`} style={{ padding: '4px 10px', fontSize: '0.7rem' }}>
                    {lang === 'AR' ? (analysis?.recommendation_ar || 'غير متاح') : (analysis?.recommendation || 'NO DATA')}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px' }}>
                  <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-muted" style={{ fontSize: '0.65rem', marginBottom: '4px' }}>PERF ({range.toUpperCase()})</p>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: (stats?.perf || 0) >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {stats ? `${stats.perf >= 0 ? '+' : ''}${stats.perf.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-muted" style={{ fontSize: '0.65rem', marginBottom: '4px' }}>MAX DD</p>
                    <span className="mono" style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-red)' }}>
                      {stats ? `-${stats.maxDD.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p className="text-muted" style={{ fontSize: '0.65rem', marginBottom: '4px' }}>ANN. VOL</p>
                    <span className="mono" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {stats ? `${stats.vol.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '0 4px' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', direction: lang === 'AR' ? 'rtl' : 'ltr' }}>
                      <span className="text-muted">{lang === 'AR' ? 'التوجه:' : 'Sentiment:'}</span>
                      <span style={{ color: isBullish ? 'var(--color-green)' : isBearish ? 'var(--color-red)' : 'var(--color-yellow)', fontWeight: 600 }}>
                        {lang === 'AR' ? (analysis?.sentiment_ar || analysis?.sentiment || 'محايد') : (analysis?.sentiment || 'Neutral')}
                      </span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', direction: lang === 'AR' ? 'rtl' : 'ltr' }}>
                      <span className="text-muted">{lang === 'AR' ? 'المستهدف:' : 'Target:'}</span>
                      <span className="text-blue" style={{ fontWeight: 600 }}>{analysis?.targetPrice ? `EGP ${analysis.targetPrice}` : 'N/A'}</span>
                   </div>
                </div>

                <div style={{ 
                  fontSize: '0.85rem', 
                  color: 'var(--text-secondary)', 
                  lineHeight: '1.6', 
                  minHeight: '60px',
                  direction: lang === 'AR' ? 'rtl' : 'ltr',
                  textAlign: lang === 'AR' ? 'right' : 'left'
                }}>
                  {lang === 'AR' 
                    ? (analysis?.narrative_ar || 'تحليل البيانات معلق. قم بتشغيل التحليل الشامل من لوحة التحكم الرئيسية لتوليد رؤى لهذا الأصل.') 
                    : (analysis?.narrative || 'Intelligence data pending. Run global analysis from the main dashboard to generate insights for this asset.')}
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {(analysis?.key_metrics || []).slice(0, 3).map((m: string) => (
                    <span key={m} style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>{m}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


function PerformanceDashboard({ transactions }: { transactions: Transaction[] }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState('6m');
  const [compareTickers, setCompareTickers] = useState<string[]>(() => {
    const saved = localStorage.getItem('boltscan_compare_tickers');
    return saved ? JSON.parse(saved) : [];
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [widgetSymbol, setWidgetSymbol] = useState('EGX:EGX30');

  useEffect(() => {
    localStorage.setItem('boltscan_compare_tickers', JSON.stringify(compareTickers));
  }, [compareTickers]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        const json = await res.json();
        setSearchResults(json);
      } catch (e) {
        console.error('Search failed', e);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const calculatePerformance = async () => {
      setLoading(true);
      try {
        const uniqueTickers = [...new Set(transactions.filter(t => t.ticker && ['Buy', 'Sell'].includes(t.type)).map(t => t.ticker))];
        const indexTicker = '^EGX30';
        const allCompareTickers = [...new Set([...compareTickers, indexTicker])];
        
        console.log('[Performance] Starting calculation for:', uniqueTickers);

        // Fetch histories
        const histories: Record<string, any[]> = {};
        await Promise.all([...new Set([...uniqueTickers, ...allCompareTickers])].map(async ticker => {
          try {
            const res = await fetch(`/api/history?symbol=${encodeURIComponent(ticker!)}&range=${range}`);
            const json = await res.json();
            if (Array.isArray(json)) {
              histories[ticker!] = json;
            } else {
              console.warn(`[Performance] No history for ${ticker}`);
              histories[ticker!] = [];
            }
          } catch (e) {
            console.error(`[Performance] Failed to fetch history for ${ticker}`, e);
            histories[ticker!] = [];
          }
        }));

        const indexHistory = histories[indexTicker];
        if (!Array.isArray(indexHistory) || indexHistory.length === 0) {
          throw new Error(`Market index data (${indexTicker}) is currently unavailable. Historical comparisons require index data.`);
        }

        // 1. Find the first transaction date
        const firstTxDate = transactions.length > 0 ? [...transactions].sort((a,b) => a.date.localeCompare(b.date))[0].date : null;

        // 2. Align dates and calculate
        const perfPoints = indexHistory.map(indexPoint => {
          const date = indexPoint.date.split('T')[0];
          
          // Only calculate portfolio value if we are on or after the first transaction
          const hasStarted = firstTxDate && date >= firstTxDate;

          let portfolioValue = 0;
          let cashValue = 0;

          if (hasStarted) {
            // Current holdings on this date
            const txOnDate = transactions.filter(t => t.date <= date && t.ticker);
            const currentHoldings: Record<string, number> = {};
            txOnDate.forEach(t => {
              if (t.type === 'Buy') currentHoldings[t.ticker!] = (currentHoldings[t.ticker!] || 0) + (t.quantity || 0);
              if (t.type === 'Sell') currentHoldings[t.ticker!] = (currentHoldings[t.ticker!] || 0) - (t.quantity || 0);
            });

            transactions.filter(t => t.date <= date).forEach(t => {
              if (t.type === 'Deposit') cashValue += (t.price || 0);
              if (t.type === 'Withdraw') cashValue -= (t.price || 0);
              if (t.type === 'Buy') cashValue -= ((t.quantity || 0) * (t.price || 0)) + (t.fees || 0);
              if (t.type === 'Sell') cashValue += ((t.quantity || 0) * (t.price || 0)) - (t.fees || 0);
              if (t.type === 'Dividend') cashValue += (t.price || 0);
            });

            Object.entries(currentHoldings).forEach(([ticker, qty]) => {
              const h = histories[ticker];
              if (h && qty > 0) {
                const pricePoint = h.find(p => p.date.split('T')[0] === date) || [...h].reverse().find(p => p.date.split('T')[0] < date);
                if (pricePoint) portfolioValue += qty * pricePoint.close;
              }
            });
          }

          return {
            date,
            displayDate: new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            totalValue: hasStarted ? (portfolioValue + cashValue) : null,
            indexValue: indexPoint.close,
            hasStarted,
            // Capture comparison values
            comparisons: allCompareTickers.reduce((acc, ticker) => {
              const h = histories[ticker];
              if (h) {
                const p = h.find(point => point.date.split('T')[0] === date) || [...h].reverse().find(point => point.date.split('T')[0] < date);
                if (p) acc[ticker] = p.close;
              }
              return acc;
            }, {} as Record<string, number>)
          };
        });

        // Normalize to 100 for comparison
        // Find the first date where there is an actual holding value (not just cash)
        const startPoint = perfPoints.find(p => p.hasStarted && p.totalValue && p.totalValue > 0) || perfPoints[0];

        if (startPoint) {
          const startPortVal = startPoint.totalValue || 1;
          const normalized = perfPoints.map(p => {
            const point: any = {
              ...p,
              portfolio: p.hasStarted ? (p.totalValue! / startPortVal) * 100 : null
            };
            
            // Normalize all comparison tickers
            allCompareTickers.forEach(ticker => {
              const startVal = startPoint.comparisons?.[ticker] || 1;
              const currentVal = p.comparisons?.[ticker];
              if (currentVal !== undefined) {
                point[ticker === indexTicker ? 'market' : ticker] = (currentVal / startVal) * 100;
              }
            });
            
            return point;
          });
          setData(normalized);
        } else {
          setData([]);
        }

      } catch (err: any) {
        console.error('[Performance] Calculation error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    calculatePerformance();
  }, [transactions, range, compareTickers]);

  if (loading) return (
    <div style={{ padding: '4rem', textAlign: 'center' }}>
      <RefreshCw className="spinning text-blue" size={48} style={{ marginBottom: '1rem' }} />
      <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Calculating Portfolio Alpha vs EGX30...</p>
    </div>
  );

  if (error) return (
    <div className="card" style={{ padding: '4rem', textAlign: 'center', borderColor: 'var(--color-red)' }}>
      <ShieldAlert size={48} className="text-red" style={{ marginBottom: '1.5rem' }} />
      <h3 style={{ marginBottom: '1rem' }}>Market Data Interrupted</h3>
      <p className="text-muted" style={{ maxWidth: '500px', margin: '0 auto 2rem' }}>{error}</p>
      <button className="btn-primary" onClick={() => window.location.reload()}>Retry Connection</button>
    </div>
  );

  if (data.length === 0 && !loading) return (
    <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
      <Activity size={48} className="text-blue" style={{ marginBottom: '1.5rem', opacity: 0.5 }} />
      <h3 style={{ marginBottom: '1rem' }}>No Performance Data</h3>
      <p className="text-muted" style={{ maxWidth: '500px', margin: '0 auto' }}>Add buy/sell transactions to see your portfolio performance relative to the EGX30 index over time.</p>
    </div>
  );

  const lastPoint = data[data.length - 1];
  const portPerf = lastPoint ? lastPoint.portfolio - 100 : 0;
  const indexPerf = lastPoint ? lastPoint.market - 100 : 0;
  const alpha = portPerf - indexPerf;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
      
      {/* Comparison Ticker Manager */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PlusCircle size={18} className="text-blue" /> Comparison Benchmarks
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Add stocks or indices to compare against your portfolio</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '1.5rem' }}>
          {compareTickers.map(ticker => (
            <div key={ticker} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 700 }}>{ticker}</span>
              <button onClick={() => setCompareTickers(prev => prev.filter(t => t !== ticker))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={14} />
              </button>
            </div>
          ))}
          <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Search symbol to add (e.g. COMI, HRHO)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px 10px 10px 40px', color: 'white', fontSize: '0.9rem' }}
              />
              {isSearching && <RefreshCw size={14} className="spinning" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-blue)' }} />}
            </div>
            
            {searchResults.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1b1e', border: '1px solid #333', borderRadius: '12px', marginTop: '8px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
                {searchResults.map(res => (
                  <button 
                    key={res.symbol}
                    onClick={() => {
                      if (!compareTickers.includes(res.symbol)) {
                        setCompareTickers(prev => [...prev, res.symbol]);
                      }
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    style={{ width: '100%', padding: '12px 15px', background: 'none', border: 'none', borderBottom: '1px solid #2a2b2e', color: 'white', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{res.symbol}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{res.name}</div>
                    </div>
                    <Plus size={16} className="text-blue" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        <div className="card" style={{ padding: '1.5rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '8px' }}>Your Return ({range.toUpperCase()})</p>
          <h2 style={{ color: portPerf >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{portPerf >= 0 ? '+' : ''}{portPerf.toFixed(2)}%</h2>
        </div>
        <div className="card" style={{ padding: '1.5rem' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '8px' }}>EGX30 Return</p>
          <h2 style={{ color: indexPerf >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{indexPerf >= 0 ? '+' : ''}{indexPerf.toFixed(2)}%</h2>
        </div>
        <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--color-blue)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '8px' }}>Alpha (Outperformance)</p>
          <h2 style={{ color: alpha >= 0 ? 'var(--color-blue)' : 'var(--color-yellow)' }}>{alpha >= 0 ? '+' : ''}{alpha.toFixed(2)}%</h2>
        </div>
      </div>

      {/* TradingView Live Market View */}
      <div className="card" style={{ padding: '0', height: '720px', marginBottom: '8rem', position: 'relative', zIndex: 10 }}>
        <div style={{ padding: '1.5rem 1.5rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} className="text-blue" /> Live Market Intelligence (TradingView)
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Real-time institutional data for selected benchmark</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>View:</span>
            <select 
              value={widgetSymbol} 
              onChange={(e) => setWidgetSymbol(e.target.value)}
              style={{ background: 'var(--bg-app)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <option value="EGX:EGX30">EGX30 Index</option>
              {compareTickers.map(t => (
                <option key={t} value={`EGX:${t.split('.')[0]}`}>{t} (Comparison)</option>
              ))}
              {transactions.filter(t => t.ticker).map(t => t.ticker).filter((v, i, a) => a.indexOf(v) === i).map(t => (
                <option key={t} value={`EGX:${t!.split('.')[0]}`}>{t} (My Holding)</option>
              ))}
            </select>
          </div>
        </div>
        <TradingViewWidget symbol={widgetSymbol} />
      </div>

      {/* Main Comparison Chart */}
      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} className="text-blue" /> Portfolio Alpha vs EGX30
          </h3>
          <div className="time-filters">
            {['3m', '6m', '1y', 'ytd', 'max'].map(r => (
              <button 
                key={r} 
                className={range === r ? 'active' : ''} 
                onClick={() => setRange(r)}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: '400px', width: '100%', minHeight: '400px', display: 'block', position: 'relative' }}>
          <ResponsiveContainer width="99%" height="99%" debounce={200}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickFormatter={(v) => `${(v - 100).toFixed(0)}%`} />
              <Tooltip 
                contentStyle={{ background: '#1a1b1e', border: '1px solid #333', borderRadius: '8px' }}
                itemStyle={{ fontSize: '12px' }}
                formatter={(value: any) => [`${(value - 100).toFixed(2)}%`]}
              />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
              <Line type="monotone" dataKey="portfolio" name="Your Portfolio" stroke="var(--color-blue)" strokeWidth={3} dot={false} animationDuration={1000} />
              <Line type="monotone" dataKey="market" name="EGX30 Index" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} animationDuration={1000} />
              {compareTickers.map((ticker, idx) => {
                const colors = ['#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#ef4444'];
                return (
                  <Line 
                    key={ticker}
                    type="monotone" 
                    dataKey={ticker} 
                    name={ticker} 
                    stroke={colors[idx % colors.length]} 
                    strokeWidth={2} 
                    dot={false} 
                    animationDuration={1000} 
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="card" style={{ padding: '1.5rem', background: alpha >= 0 ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)' }}>
        <h4 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={18} /> Market Performance Note
        </h4>
        <p style={{ fontSize: '0.9rem', margin: 0, lineHeight: 1.6 }}>
          {alpha >= 0 
            ? `Excellent work! Your portfolio is currently beating the EGX30 by ${alpha.toFixed(2)}%. This indicates your stock selection or timing is providing significant value over a passive index strategy.`
            : `Your portfolio is currently trailing the EGX30 index. This is common during market shifts. Review your "Risk Analysis" tab to see if your high-weight holdings have any technical sell signals.`}
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
            Benchmark Source: EGX30 (via institutional proxy COMI to ensure historical data integrity).
          </div>
        </p>
      </div>

    </div>
  );
}

function RiskDashboard({ holdings }: { holdings: Holding[] }) {
  if (holdings.length === 0) return null;

  const totalValue = holdings.reduce((sum, h) => sum + (h.shares * h.livePrice), 0);
  
  // Sector Analysis
  const sectors: Record<string, number> = {};
  holdings.forEach(h => {
    const val = h.shares * h.livePrice;
    sectors[h.sector] = (sectors[h.sector] || 0) + val;
  });
  const sortedSectors = Object.entries(sectors).sort((a, b) => b[1] - a[1]);
  const topSector = sortedSectors[0];
  const sectorConcentration = (topSector[1] / totalValue) * 100;

  // Concentration Analysis
  const sortedHoldings = [...holdings].sort((a, b) => (b.shares * b.livePrice) - (a.shares * a.livePrice));
  const top3Value = sortedHoldings.slice(0, 3).reduce((sum, h) => sum + (h.shares * h.livePrice), 0);
  const concentration3 = (top3Value / totalValue) * 100;

  // Stop-Loss Calculation (SMA50 - 5%)
  const stopLossWatchlist = holdings.map(h => {
    const sma50 = h.stats?.sma50 ? parseFloat(h.stats.sma50) : null;
    if (!sma50) return null;
    const stopPrice = sma50 * 0.95;
    const distance = ((h.livePrice - stopPrice) / stopPrice) * 100;
    return { ticker: h.ticker, stopPrice, distance, status: h.livePrice < stopPrice ? 'CRITICAL' : distance < 5 ? 'WARNING' : 'SAFE' };
  }).filter((x): x is any => x !== null && x.status !== 'SAFE');

  // Risk Level
  let riskLevel = 'LOW';
  let riskColor = 'var(--color-green)';
  if (concentration3 > 60 || holdings.length < 3) { riskLevel = 'HIGH'; riskColor = 'var(--color-red)'; }
  else if (concentration3 > 40 || holdings.length < 5) { riskLevel = 'MEDIUM'; riskColor = 'var(--color-yellow)'; }

  return (
    <div style={{ padding: '0 1.5rem', marginBottom: '2rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* Risk Level Card */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} className="text-blue" /> Portfolio Health
            </h3>
            <span style={{ 
              background: riskColor, 
              color: riskLevel === 'MEDIUM' ? 'black' : 'white', 
              padding: '4px 12px', 
              borderRadius: '20px', 
              fontSize: '0.7rem', 
              fontWeight: 800 
            }}>{riskLevel} RISK</span>
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px' }}>
             <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Diversification Score</p>
             <div style={{ height: '8px', background: '#333', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{ width: `${Math.max(10, 100 - sectorConcentration)}%`, height: '100%', background: 'var(--color-blue)', borderRadius: '4px' }}></div>
             </div>
             <p style={{ fontSize: '0.75rem', margin: 0 }}>
               Largest sector: <span style={{ fontWeight: 700 }}>{topSector[0]}</span> ({sectorConcentration.toFixed(1)}%)
             </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Top 3 Weight</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 700, color: concentration3 > 60 ? 'var(--color-red)' : 'white' }}>{concentration3.toFixed(1)}%</p>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Holdings</p>
              <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>{holdings.length}</p>
            </div>
          </div>
        </div>

        {/* Technical Safety Watchlist */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target size={18} className="text-red" /> Safety Watchlist
          </h3>
          
          {stopLossWatchlist.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
               <CheckCircle2 size={32} className="text-green" style={{ marginBottom: '1rem', opacity: 0.5 }} />
               <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>All positions are currently trading above critical safety levels.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stopLossWatchlist.map(s => (
                <div key={s.ticker} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', borderLeft: `4px solid ${s.status === 'CRITICAL' ? 'var(--color-red)' : 'var(--color-yellow)'}` }}>
                  <div>
                    <p style={{ fontWeight: 700, margin: 0 }}>{s.ticker}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Stop: EGP {s.stopPrice.toFixed(2)}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: s.status === 'CRITICAL' ? 'var(--color-red)' : 'var(--color-yellow)', margin: 0 }}>
                      {s.status}
                    </p>
                    <p style={{ fontSize: '0.7rem', margin: 0 }}>{s.distance.toFixed(1)}% to stop</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Investment Strategy Advice */}
        <div className="card" style={{ padding: '1.5rem', border: '1px dashed var(--border-color)', background: 'none' }}>
           <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--color-blue)' }}>Health Tips</h3>
           <ul style={{ paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
             {concentration3 > 50 && <li>Your portfolio is highly concentrated in few stocks. Consider rebalancing to reduce impact of a single stock crash.</li>}
             {holdings.length < 5 && <li>Portfolio has low diversification. Aim for 8-12 stocks across different sectors for optimal risk-reward.</li>}
             {sectorConcentration > 40 && <li>You have high exposure to the <b>{topSector[0]}</b> sector. Consider looking into other industries.</li>}
             {stopLossWatchlist.some(s => s.status === 'CRITICAL') && <li>One or more stocks have broken their 50-day moving average. Review these positions for potential exit.</li>}
             {riskLevel === 'LOW' && <li>Your portfolio structure is healthy and well-balanced. Keep up the disciplined diversification.</li>}
           </ul>
        </div>

      </div>
    </div>
  );
}
function MarketIntelligence({ watchlist, setWatchlist, marketData, analyticsData, setAnalysisStock, shariaTickers }: any) {
  const [newTicker, setNewTicker] = useState('');
  const [showShariaOnly, setShowShariaOnly] = useState(false);

  // Sector Heatmap Calculation
  const sectors: Record<string, { change: number; count: number }> = {};
  Object.entries(marketData).forEach(([ticker, data]: any) => {
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
             <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  className="input-field" 
                  style={{ width: '120px', padding: '8px' }} 
                  placeholder="Ticker..." 
                  value={newTicker} 
                  onChange={e => setNewTicker(e.target.value)} 
                />
                <button className="btn-primary" style={{ padding: '8px 12px' }} onClick={addToWatchlist}><Plus size={16} /></button>
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
                  <tr key={t}>
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
                      <button className="icon-btn" onClick={() => setAnalysisStock({ ticker: t, company: data?.name || t, livePrice: data?.price || 0, sector: data?.sector || 'Unknown' })} title="Analyze"><Brain size={16} className="text-blue" /></button>
                      <button className="icon-btn" onClick={() => removeFromWatchlist(t)} title="Remove"><Trash2 size={16} className="text-red" /></button>
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

function StrategySimulator({ holdings }: { holdings: Holding[] }) {
  const [selectedTicker, setSelectedTicker] = useState(holdings[0]?.ticker || '');
  const [simQty, setSimQty] = useState(0);
  const [simPrice, setSimPrice] = useState(0);

  const h = holdings.find(x => x.ticker === selectedTicker);
  
  // Calculations
  const currentShares = h?.shares || 0;
  const currentAvg = h?.avgCost || 0;
  const currentVal = currentShares * currentAvg;
  
  const newShares = currentShares + simQty;
  const newVal = currentVal + (simQty * simPrice);
  const newAvg = newShares > 0 ? newVal / newShares : 0;
  const avgImprovement = currentAvg > 0 ? ((newAvg - currentAvg) / currentAvg) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div className="card" style={{ padding: '2rem' }}>
        <h3 style={{ margin: '0 0 2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target size={18} className="text-blue" /> "What-If" Purchase Simulator
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
          
          {/* Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Select Holding</label>
              <select className="input-field" value={selectedTicker} onChange={e => setSelectedTicker(e.target.value)}>
                {holdings.map(hx => <option key={hx.ticker} value={hx.ticker}>{hx.ticker} - {hx.company}</option>)}
              </select>
            </div>
            <div>
              <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Simulated Quantity (Buy)</label>
              <input type="number" className="input-field" value={simQty} onChange={e => setSimQty(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-muted" style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem' }}>Simulated Price (EGP)</label>
              <input type="number" className="input-field" value={simPrice} onChange={e => setSimPrice(Number(e.target.value))} />
            </div>
          </div>

          {/* Results Comparison */}
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
              <span className="text-muted">Current Avg Cost</span>
              <span style={{ fontWeight: 700 }}>EGP {currentAvg.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
              <span className="text-muted">New Avg Cost</span>
              <span style={{ fontWeight: 700, color: 'var(--color-blue)' }}>EGP {newAvg.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
              <span className="text-muted">Avg Cost Change</span>
              <span style={{ fontWeight: 700, color: avgImprovement <= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                {avgImprovement <= 0 ? '' : '+'}{avgImprovement.toFixed(2)}%
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Total Exposure</span>
              <span style={{ fontWeight: 700 }}>EGP {newVal.toLocaleString()}</span>
            </div>
          </div>

        </div>

        <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(59,130,246,0.05)', borderRadius: '8px', borderLeft: '4px solid var(--color-blue)' }}>
          <p style={{ fontSize: '0.85rem', margin: 0, color: 'var(--text-secondary)' }}>
            <Info size={14} style={{ marginRight: '8px' }} />
            <b>Strategy Note:</b> {avgImprovement < 0 
              ? `Buying at EGP ${simPrice} would "Average Down" your position by ${Math.abs(avgImprovement).toFixed(2)}%. This lowers your break-even point.` 
              : `Buying at EGP ${simPrice} would "Average Up" your position by ${avgImprovement.toFixed(2)}%. Ensure the upside potential justifies the higher cost basis.`}
          </p>
        </div>
      </div>

    </div>
  );
}
export default App;
