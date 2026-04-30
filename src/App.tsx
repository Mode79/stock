import { useState, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { 
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertTriangle, 
  Wallet, DollarSign, Activity, CheckCircle2, Clock, Plus, Trash2, X, Search, TrendingUp
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
}

interface Holding {
  ticker: string;
  company: string;
  sector: string;
  shares: number;
  avgCost: number;
  totalCost: number;
  livePrice: number;
}

// Initial state with your 7 stocks but formatted for the new system (fees merged into price)
const SEED_TRANSACTIONS: Transaction[] = [
  { id: '1', date: '2026-01-01', type: 'Deposit', price: 74000 },
  { id: '2', date: '2026-01-02', type: 'Buy', ticker: 'SWDY', quantity: 121, price: 87.1336 },
  { id: '3', date: '2026-01-02', type: 'Buy', ticker: 'AMOC', quantity: 1261, price: 8.4129 },
  { id: '4', date: '2026-01-03', type: 'Buy', ticker: 'OLFI', quantity: 458, price: 22.3144 },
  { id: '5', date: '2026-01-03', type: 'Buy', ticker: 'MPCI', quantity: 58, price: 173.2578 },
  { id: '6', date: '2026-01-04', type: 'Buy', ticker: 'MICH', quantity: 288, price: 35.5370 },
  { id: '7', date: '2026-01-04', type: 'Buy', ticker: 'SUGR', quantity: 210, price: 49.5661 },
  { id: '8', date: '2026-01-05', type: 'Buy', ticker: 'ORWE', quantity: 448, price: 22.9375 },
];

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('thndr_tx_v3');
    return saved ? JSON.parse(saved) : SEED_TRANSACTIONS;
  });
  
  const [marketData, setMarketData] = useState<Record<string, any>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [staleData, setStaleData] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [historyStock, setHistoryStock] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('thndr_tx_v3', JSON.stringify(transactions));
  }, [transactions]);

  const calculatePortfolio = () => {
    let walletBalance = 0;
    let totalDeposited = 0;
    let realizedPnL = 0;
    let dividendsCollected = 0;
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
          dividendsCollected += tx.price;
          break;
        case 'Buy':
          if (tx.ticker && tx.quantity) {
            const cost = tx.quantity * tx.price;
            walletBalance -= cost;
            if (!holdingsMap[tx.ticker]) holdingsMap[tx.ticker] = { shares: 0, totalCost: 0 };
            holdingsMap[tx.ticker].shares += tx.quantity;
            holdingsMap[tx.ticker].totalCost += cost;
          }
          break;
        case 'Sell':
          if (tx.ticker && tx.quantity) {
            const proceeds = tx.quantity * tx.price;
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
          livePrice: meta.price || (data.totalCost / data.shares)
        };
      });

    return { holdings, walletBalance, totalDeposited, realizedPnL, dividendsCollected };
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

  useEffect(() => {
    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 60000);
    return () => clearInterval(interval);
  }, [transactions.length]);

  const totalMarketValue = holdings.reduce((sum, h) => sum + (h.shares * h.livePrice), 0);
  const totalInvested = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalPnL = totalMarketValue - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  const allocationData = holdings.map(h => ({ name: h.ticker, value: h.shares * h.livePrice }));
  const pnlData = holdings.map(h => ({ name: h.ticker, pnl: (h.shares * h.livePrice) - h.totalCost }));

  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Activity className="text-blue" size={24} />
          <h2>Thunder Pro <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>EGX LIVE</span></h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn" onClick={() => setIsModalOpen(true)} style={{ background: 'var(--color-blue)', color: 'white', border: 'none' }}>
            <Plus size={16} /> New Transaction
          </button>
          <button className="btn" onClick={fetchLivePrices} disabled={isUpdating}>
            <RefreshCw size={16} className={isUpdating ? 'spinning' : ''} />
            Sync
          </button>
        </div>
      </header>

      <main className="main-content">
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

        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Company Name</th>
                <th style={{ textAlign: 'right' }}>Shares</th>
                <th style={{ textAlign: 'right' }}>Avg Cost</th>
                <th style={{ textAlign: 'right' }}>Live Price</th>
                <th style={{ textAlign: 'right' }}>Value</th>
                <th style={{ textAlign: 'right' }}>P&L (EGP)</th>
                <th style={{ textAlign: 'right' }}>Return</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map(h => {
                const value = h.shares * h.livePrice;
                const pnl = value - h.totalCost;
                const pnlPct = (pnl / h.totalCost) * 100;
                return (
                    <tr key={h.ticker} onClick={() => setHistoryStock(h.ticker)} style={{ cursor: 'pointer' }}>
                      <td style={{ fontWeight: 700 }}>{h.ticker}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{h.company}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{h.shares}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{h.avgCost.toFixed(4)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{h.livePrice.toFixed(2)}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="mono" style={{ textAlign: 'right', color: pnl >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{pnl >= 0 ? '+' : ''}{pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td style={{ textAlign: 'right' }}><span className={`badge ${pnl >= 0 ? 'badge-green' : 'badge-red'}`}>{pnlPct.toFixed(2)}%</span></td>
                    </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid-3">
          <div className="card">
            <h3 className="card-title">Asset Allocation</h3>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={allocationData} dataKey="value" innerRadius={45} outerRadius={60} stroke="none">{allocationData.map((_, i) => <Cell key={`cell-${i}`} fill={['#58a6ff', '#3fb950', '#f85149', '#d29922', '#a371f7'][i % 5]} />)}</Pie><Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }} /></PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <h3 className="card-title">Performance Chart</h3>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pnlData} layout="vertical" margin={{ left: 10 }}><XAxis type="number" hide /><YAxis dataKey="name" type="category" stroke="#8b949e" fontSize={10} width={40} /><Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }} /><Bar dataKey="pnl">{pnlData.map((e, i) => <Cell key={`c-${i}`} fill={e.pnl >= 0 ? '#3fb950' : '#f85149'} />)}</Bar></BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="card">
            <h3 className="card-title">Deposits & Cash</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.8rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Deposited</span><span className="mono">EGP {totalDeposited.toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Invested</span><span className="mono text-blue">EGP {totalInvested.toLocaleString()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #30363d', paddingTop: '0.5rem' }}><strong>Wallet</strong><strong className="mono">EGP {walletBalance.toLocaleString()}</strong></div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>Transaction History</h3>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Type</th><th>Ticker</th><th>Qty</th><th>Price</th><th>Action</th></tr></thead>
              <tbody>
                {[...transactions].reverse().map(tx => (
                  <tr key={tx.id}>
                    <td className="text-muted" style={{ fontSize: '0.75rem' }}>{tx.date}</td>
                    <td><span className={`badge ${tx.type === 'Buy' ? 'badge-red' : tx.type === 'Sell' ? 'badge-green' : 'badge-yellow'}`}>{tx.type}</span></td>
                    <td style={{ fontWeight: 600 }}>{tx.ticker || '-'}</td>
                    <td className="mono">{tx.quantity || '-'}</td>
                    <td className="mono">{tx.price.toLocaleString()}</td>
                    <td><button className="icon-btn" onClick={() => setTransactions(transactions.filter(t => t.id !== tx.id))}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="card-header"><h3 className="card-title">New Entry</h3><button className="icon-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button></div>
            <TransactionForm onAdd={(tx) => { setTransactions([...transactions, { ...tx, id: crypto.randomUUID() }]); setIsModalOpen(false); }} />
          </div>
        </div>
      )}

      {historyStock && (
        <HistoryModal 
          ticker={historyStock} 
          company={holdings.find(h => h.ticker === historyStock)?.company || historyStock}
          onClose={() => setHistoryStock(null)} 
        />
      )}
    </div>
  );
}

function HistoryModal({ ticker, company, onClose }: { ticker: string; company: string; onClose: () => void }) {
  const [range, setRange] = useState('1m');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const ranges = [
    { label: '1D', value: '1d' },
    { label: '1W', value: '1w' },
    { label: '1M', value: '1m' },
    { label: '3M', value: '3m' },
    { label: '6M', value: '6m' },
    { label: 'YTD', value: 'ytd' },
    { label: '1Y', value: '1y' },
    { label: '5Y', value: '5y' },
    { label: 'MAX', value: 'max' },
  ];

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/history?symbol=${ticker}&range=${range}`);
        const json = await res.json();
        if (Array.isArray(json)) {
          setData(json);
        } else {
          setData([]);
        }
      } catch (e) {
        console.error(e);
        setData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [ticker, range]);

  const latestPrice = data.length > 0 ? data[data.length - 1].close : 0;
  const firstPrice = data.length > 0 ? data[0].close : 0;
  const pnl = latestPrice - firstPrice;
  const pnlPct = firstPrice > 0 ? (pnl / firstPrice) * 100 : 0;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '800px', maxWidth: '95vw' }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">{ticker} - {company}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <span className="mono font-bold" style={{ fontSize: '1.25rem' }}>EGP {latestPrice.toFixed(2)}</span>
              <span className={`pnl-chip ${pnl >= 0 ? 'up' : 'down'}`} style={{ fontSize: '0.8rem' }}>
                {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnlPct.toFixed(2)}%)
              </span>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={24} /></button>
        </div>

        <div className="timeframe-selector" style={{ display: 'flex', gap: '0.5rem', margin: '1.5rem 0', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '8px' }}>
          {ranges.map(r => (
            <button 
              key={r.value} 
              className={`btn ${range === r.value ? 'active' : ''}`}
              style={{ flex: 1, fontSize: '0.75rem', padding: '6px', border: 'none', background: range === r.value ? 'var(--color-blue)' : 'transparent', color: range === r.value ? 'white' : 'var(--text-secondary)' }}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div style={{ height: '350px', width: '100%', position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,17,23,0.5)', zIndex: 5, borderRadius: '8px' }}>
              <RefreshCw className="spinning" size={32} />
            </div>
          )}
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={pnl >= 0 ? 'var(--color-green)' : 'var(--color-red)'} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={pnl >= 0 ? 'var(--color-green)' : 'var(--color-red)'} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="date" 
                hide={range === '1d' || range === '1w'} 
                tickFormatter={(val) => new Date(val).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                stroke="var(--text-muted)"
                fontSize={10}
              />
              <YAxis 
                domain={['auto', 'auto']} 
                orientation="right" 
                stroke="var(--text-muted)" 
                fontSize={10}
                tickFormatter={(val) => val.toFixed(1)}
              />
              <Tooltip 
                contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }}
                labelFormatter={(label) => new Date(label).toLocaleString()}
              />
              <Area 
                type="monotone" 
                dataKey="close" 
                stroke={pnl >= 0 ? 'var(--color-green)' : 'var(--color-red)'} 
                fillOpacity={1} 
                fill="url(#colorPrice)" 
                strokeWidth={2}
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function TransactionForm({ onAdd }: { onAdd: (tx: any) => void }) {
  const [type, setType] = useState<TransactionType>('Buy');
  const [ticker, setTicker] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (ticker.length > 0 && ['Buy', 'Sell'].includes(type)) {
      const delay = setTimeout(async () => {
        try {
          const res = await fetch(`/api/search?q=${ticker}`);
          const data = await res.json();
          setSuggestions(data);
          setShowSuggestions(true);
        } catch (e) {
          console.error(e);
        }
      }, 300);
      return () => clearTimeout(delay);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [ticker, type]);

  return (
    <form onSubmit={(e) => { 
      e.preventDefault(); 
      onAdd({ type, ticker: ticker.toUpperCase(), quantity: parseFloat(qty), price: parseFloat(price), date }); 
    }}>
      <div className="form-group">
        <label>Type</label>
        <select className="form-input" value={type} onChange={e => setType(e.target.value as TransactionType)}>
          <option value="Buy">Buy Stock</option>
          <option value="Sell">Sell Stock</option>
          <option value="Deposit">Deposit Cash</option>
          <option value="Withdraw">Withdraw Cash</option>
          <option value="Dividend">Dividend</option>
        </select>
      </div>

      {['Buy', 'Sell'].includes(type) && (
        <div className="form-group" style={{ position: 'relative' }}>
          <label>Stock Code (EGX)</label>
          <div style={{ position: 'relative' }}>
            <input 
              className="form-input" 
              style={{ paddingLeft: '2.5rem' }} 
              placeholder="e.g. SWDY" 
              value={ticker} 
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onFocus={() => ticker.length > 0 && setShowSuggestions(true)}
              autoComplete="off"
              required 
            />
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
          </div>
          
          {showSuggestions && suggestions.length > 0 && (
            <div className="suggestions-list">
              {suggestions.map(s => (
                <div key={s.symbol} className="suggestion-item" onClick={() => {
                  setTicker(s.symbol);
                  setShowSuggestions(false);
                }}>
                  <b>{s.symbol}</b>
                  <small>{s.name}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {['Buy', 'Sell'].includes(type) && <div className="form-group"><label>Quantity</label><input className="form-input" type="number" required value={qty} onChange={e => setQty(e.target.value)} /></div>}
        <div className="form-group"><label>{['Buy', 'Sell'].includes(type) ? 'Price (inc. Fees)' : 'Amount'}</label><input className="form-input" type="number" step="any" required value={price} onChange={e => setPrice(e.target.value)} /></div>
      </div>
      <div className="form-group"><label>Date</label><input className="form-input" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div>
      <button type="submit" className="btn-primary">Record Transaction</button>
    </form>
  );
}

export default App;
