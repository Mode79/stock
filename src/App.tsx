import { useState, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { 
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertTriangle, 
  Wallet, DollarSign, Activity, CheckCircle2, Clock
} from 'lucide-react';
import './index.css';

// Initial Holdings configuration
const INITIAL_HOLDINGS = [
  { ticker: 'SWDY', company: 'Elsewedy Electric', sector: 'Electrical', shares: 121, avgCost: 87.1336, totalCost: 10543.16, livePrice: 87.1336 },
  { ticker: 'AMOC', company: 'Alexandria Mineral Oils', sector: 'Energy/Oils', shares: 1261, avgCost: 8.4129, totalCost: 10608.64, livePrice: 8.4129 },
  { ticker: 'OLFI', company: 'Obour Land for Food', sector: 'Food', shares: 458, avgCost: 22.3144, totalCost: 10219.99, livePrice: 22.3144 },
  { ticker: 'MPCI', company: 'Memphis Pharmaceuticals', sector: 'Pharma', shares: 58, avgCost: 173.2578, totalCost: 10048.95, livePrice: 173.2578 },
  { ticker: 'MICH', company: 'Misr Chemical Industries', sector: 'Chemicals', shares: 288, avgCost: 35.5370, totalCost: 10234.65, livePrice: 35.5370 },
  { ticker: 'SUGR', company: 'Delta Sugar', sector: 'Food/Sugar', shares: 210, avgCost: 49.5661, totalCost: 10408.89, livePrice: 49.5661 },
  { ticker: 'ORWE', company: 'Oriental Weavers', sector: 'Textiles', shares: 448, avgCost: 22.9375, totalCost: 10276.01, livePrice: 22.9375 }
];

const INITIAL_PENDING = {
  ticker: '',
  shares: 0,
  limitPrice: 0,
  fees: 0,
  status: 'None',
  expiry: ''
};

const WALLET_BALANCE = 1593.39;
const TOTAL_DEPOSITED = 74000;
const TOTAL_FEES_PAID = 112.04;

function App() {
  const [holdings, setHoldings] = useState(INITIAL_HOLDINGS);
  const [pending, setPending] = useState(INITIAL_PENDING);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [staleData, setStaleData] = useState(false);

  const fetchLivePrices = async () => {
    try {
      setIsUpdating(true);
      setStaleData(false);
      
      const tickers = holdings.map(h => `${h.ticker}.CA`);
      if (pending.status === 'Pending') {
        tickers.push(`${pending.ticker}.CA`);
      }
      
      const res = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers })
      });
      
      if (!res.ok) throw new Error('Failed to fetch from proxy');
      
      const data = await res.json();
      
      setHoldings(prev => prev.map(h => {
        if (data[h.ticker] && data[h.ticker].price) {
          return { ...h, livePrice: data[h.ticker].price };
        }
        return h;
      }));
      
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      if (lastUpdated && (new Date().getTime() - lastUpdated.getTime() > 5 * 60 * 1000)) {
        setStaleData(true);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 60000);
    return () => clearInterval(interval);
  }, []);

  // Recalculations
  let totalInvested = 0;
  let totalMarketValue = 0;
  
  const enrichedHoldings = holdings.map(h => {
    const invested = h.totalCost;
    const marketValue = h.shares * h.livePrice;
    const unrealizedPnL = marketValue - invested;
    const pnlPercent = (unrealizedPnL / invested) * 100;
    
    totalInvested += invested;
    totalMarketValue += marketValue;
    
    return { ...h, invested, marketValue, unrealizedPnL, pnlPercent };
  });

  const totalPnL = totalMarketValue - totalInvested;
  const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  // Cash Logic
  const pendingFees = (pending.shares * pending.limitPrice) * 0.00182; // 0.182%
  const reservedCash = pending.status === 'Pending' ? (pending.shares * pending.limitPrice) + pendingFees : 0;
  const freeCash = WALLET_BALANCE - reservedCash;

  // Chart Data Preparation
  const COLORS = ['#58a6ff', '#3fb950', '#f85149', '#d29922', '#a371f7', '#ff7b72'];
  
  const allocationData = enrichedHoldings.map(h => ({
    name: h.ticker,
    value: h.marketValue
  }));

  const pnlData = enrichedHoldings.map(h => ({
    name: h.ticker,
    pnl: h.unrealizedPnL,
    fill: h.unrealizedPnL >= 0 ? '#3fb950' : '#f85149'
  }));

  const investedVsMarketData = enrichedHoldings.map(h => ({
    name: h.ticker,
    Invested: h.invested,
    Market: h.marketValue
  }));

  const handleFillPending = () => {
    if (pending.status === 'Filled') return;
    
    setHoldings(prev => [
      ...prev,
      {
        ticker: pending.ticker,
        company: 'Elsewedy Electric',
        sector: 'Electrical',
        shares: pending.shares,
        avgCost: pending.limitPrice,
        livePrice: pending.limitPrice // Will update on next fetch
      }
    ]);
    setPending(prev => ({ ...prev, status: 'Filled' }));
  };

  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Activity className="text-blue" size={24} />
          <h2>Thunder Tracker Pro</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {staleData && (
            <div className="badge badge-yellow">
              <AlertTriangle size={14} style={{ marginRight: '4px' }} />
              Stale Data
            </div>
          )}
          {lastUpdated && (
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button className="btn" onClick={fetchLivePrices} disabled={isUpdating}>
            <RefreshCw size={16} className={isUpdating ? 'spinning' : ''} />
            Live Sync
          </button>
        </div>
      </header>

      <main className="main-content">
        
        {/* ROW 1: Summary Cards */}
        <div className="grid-cards">
          <div className="card" style={{ borderLeft: '4px solid var(--color-blue)' }}>
            <div className="card-header">
              <span className="card-title text-blue">Portfolio Value</span>
              <Wallet size={20} className="text-blue" />
            </div>
            <h2 className="mono" style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
              EGP {totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Invested EGP {totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="card" style={{ borderLeft: `4px solid ${totalPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)'}` }}>
            <div className="card-header">
              <span className="card-title" style={{ color: totalPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>Unrealized P&L</span>
              {totalPnL >= 0 ? <ArrowUpRight size={20} className="text-green" /> : <ArrowDownRight size={20} className="text-red" />}
            </div>
            <h2 className="mono" style={{ fontSize: '2rem', marginBottom: '0.25rem', color: totalPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
              EGP {totalPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}% All-time return
            </p>
          </div>

          <div className="card" style={{ borderLeft: '4px solid var(--color-yellow)' }}>
            <div className="card-header">
              <span className="card-title text-yellow">Cash Position</span>
              <DollarSign size={20} className="text-yellow" />
            </div>
            <h2 className="mono" style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
              EGP {WALLET_BALANCE.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
              <span className="text-green">Free: EGP {freeCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span className="text-yellow">Reserved: EGP {reservedCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* ROW 2: Holdings Table */}
        <div className="card" style={{ padding: 0, overflowX: 'auto', flexShrink: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <tr>
                  <th>Ticker</th>
                  <th>Company</th>
                  <th>Sector</th>
                  <th style={{ textAlign: 'right' }}>Shares</th>
                  <th style={{ textAlign: 'right' }}>Avg Cost</th>
                  <th style={{ textAlign: 'right' }}>Live Price</th>
                  <th style={{ textAlign: 'right' }}>Invested</th>
                  <th style={{ textAlign: 'right' }}>Market Value</th>
                  <th style={{ textAlign: 'right' }}>P&L (EGP)</th>
                  <th style={{ textAlign: 'right' }}>P&L %</th>
                </tr>
              </thead>
              <tbody>
                {enrichedHoldings.map(h => (
                  <tr key={h.ticker}>
                    <td style={{ fontWeight: 600 }}>{h.ticker}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{h.company}</td>
                    <td><span className="badge" style={{ background: 'var(--border-color)' }}>{h.sector}</span></td>
                    <td className="mono" style={{ textAlign: 'right' }}>{h.shares}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{h.avgCost.toFixed(4)}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{h.livePrice.toFixed(3)}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{h.invested.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{h.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="mono" style={{ textAlign: 'right', color: h.unrealizedPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                      {h.unrealizedPnL >= 0 ? '+' : ''}{h.unrealizedPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`badge ${h.unrealizedPnL >= 0 ? 'badge-green' : 'badge-red'}`}>
                        {h.unrealizedPnL >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(h.pnlPercent).toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ROW 3: Charts */}
        <div className="grid-3">
          <div className="card">
            <h3 className="card-title">Portfolio Allocation</h3>
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={allocationData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} stroke="none">
                    {allocationData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => `EGP ${Number(val).toLocaleString(undefined, {maximumFractionDigits:0})}`} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="card">
            <h3 className="card-title">P&L by Stock</h3>
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pnlData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border-color)" />
                  <XAxis type="number" stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}`} />
                  <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={12} width={50} />
                  <Tooltip formatter={(val: any) => `EGP ${Number(val).toFixed(2)}`} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px' }} />
                  <Bar dataKey="pnl" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Invested vs Market Value</h3>
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={investedVsMarketData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `${val/1000}k`} />
                  <Tooltip formatter={(val: any) => `EGP ${Number(val).toLocaleString(undefined, {maximumFractionDigits:0})}`} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px' }} />
                  <Legend />
                  <Bar dataKey="Invested" fill="var(--text-muted)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Market" fill="var(--color-blue)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ROW 4: Pending Order + Cash Flow */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Pending Orders</h3>
            </div>
            {pending.status === 'Pending' ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(210, 153, 34, 0.05)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span className="badge badge-yellow"><Clock size={12} style={{ marginRight: '4px' }} /> Limit Buy</span>
                    <strong style={{ fontSize: '1.125rem' }}>{pending.ticker}</strong>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {pending.shares} shares @ EGP {pending.limitPrice.toFixed(2)}
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                    Expires: {pending.expiry} | Reserved: EGP {reservedCash.toFixed(2)}
                  </p>
                </div>
                <button className="btn" onClick={handleFillPending}>
                  <CheckCircle2 size={16} className="text-green" />
                  Mark Filled
                </button>
              </div>
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active pending orders.
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="card-title">Cash Flow Waterfall</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Deposited</span>
                <span className="mono">EGP {TOTAL_DEPOSITED.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Currently Invested</span>
                <span className="mono text-blue">- EGP {totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Total Fees Paid</span>
                <span className="mono text-red">- EGP {TOTAL_FEES_PAID.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                <span style={{ fontWeight: 600 }}>Wallet Balance</span>
                <span className="mono" style={{ fontWeight: 600 }}>= EGP {WALLET_BALANCE.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}

export default App;
