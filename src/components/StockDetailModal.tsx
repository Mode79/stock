import React, { useState, useEffect } from 'react';
import { 
  X, TrendingUp, Coins, Plus, Trash2, 
  Brain, Activity, BarChart2, Layers, Search
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Transaction, Holding, PnlExtreme, ClosedPosition } from '../types';
import { COMPANY_META } from '../types';
import { capitalWeightedDays } from '../utils/portfolioMetrics';

interface StockDetailModalProps {
  ticker: string | null;
  transactions: Transaction[];
  holdings: Holding[];
  closedPositions: ClosedPosition[];
  dividendsByTicker: Record<string, number>;
  marketData: Record<string, any>;
  pnlExtremes: Record<string, PnlExtreme>;
  onClose: () => void;
  onDeleteTransaction: (id: string) => void;
  onAddTransactionForTicker: (ticker: string) => void;
  onOpenAIAnalysis?: (holding: Holding) => void;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({
  ticker,
  transactions,
  holdings,
  closedPositions,
  dividendsByTicker,
  marketData,
  pnlExtremes,
  onClose,
  onDeleteTransaction,
  onAddTransactionForTicker,
  onOpenAIAnalysis
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'buysell' | 'dividends' | 'all'>('overview');
  const [chartRange, setChartRange] = useState('1m');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!ticker) return null;

  const currentTicker = ticker.toUpperCase();
  const meta = marketData[currentTicker] || COMPANY_META[currentTicker] || {};
  const companyName = meta.name || meta.company || currentTicker;
  const sectorName = meta.sector || 'Equities';
  const livePrice = meta.price || holdings.find(h => h.ticker === currentTicker)?.livePrice || 0;

  // Filter transactions for this stock
  const stockTx = transactions.filter(t => t.ticker?.toUpperCase() === currentTicker);
  const sortedTx = [...stockTx].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const chronologicalTx = [...stockTx].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const buys = sortedTx.filter(t => t.type === 'Buy');
  const sells = sortedTx.filter(t => t.type === 'Sell');
  const dividends = sortedTx.filter(t => t.type === 'Dividend');

  // Active holding data
  const holding = holdings.find(h => h.ticker === currentTicker);
  const closedInfo = closedPositions.find(p => p.ticker === currentTicker);
  const extremes = pnlExtremes[currentTicker];

  // Aggregated Trading Metrics
  const totalBoughtShares = buys.reduce((s, b) => s + (b.quantity || 0), 0);
  const totalBuySpend = buys.reduce((s, b) => s + ((b.quantity || 0) * (b.price || 0) + (b.fees || 0)), 0);
  const avgBuyPrice = totalBoughtShares > 0 ? buys.reduce((s, b) => s + ((b.quantity || 0) * (b.price || 0)), 0) / totalBoughtShares : 0;

  const totalSoldShares = sells.reduce((s, s2) => s + (s2.quantity || 0), 0);
  const totalSellProceeds = sells.reduce((s, s2) => s + ((s2.quantity || 0) * (s2.price || 0) - (s2.fees || 0)), 0);
  const avgSellPrice = totalSoldShares > 0 ? sells.reduce((s, s2) => s + ((s2.quantity || 0) * (s2.price || 0)), 0) / totalSoldShares : 0;

  const totalDividends = dividendsByTicker[currentTicker] || dividends.reduce((s, d) => s + (d.price || 0) - (d.fees || 0), 0);
  const totalFeesPaid = stockTx.reduce((s, t) => s + (t.fees || 0), 0);

  // Position Status
  const currentShares = holding ? holding.shares : 0;
  const marketValue = holding ? holding.shares * holding.livePrice : 0;
  const costBasis = holding ? holding.totalCost : 0;
  const unrealizedPnL = holding ? marketValue - costBasis : 0;
  const unrealizedPnLPct = costBasis > 0 ? (unrealizedPnL / costBasis) * 100 : 0;

  const realizedPnL = closedInfo ? closedInfo.realizedPnL : 0;
  const combinedTotalReturn = unrealizedPnL + realizedPnL + totalDividends;
  const yieldOnCost = costBasis > 0 ? ((totalDividends / costBasis) * 100).toFixed(2) : '—';

  const firstBuyDate = chronologicalTx.find(t => t.type === 'Buy')?.date || '—';
  const totalTxCount = stockTx.length;

  // Capital-weighted holding period: weights each buy lot by the capital it deployed,
  // so money added late isn't credited with the full calendar holding period.
  const lastSellDate = sells.length > 0 ? [...sells].sort((a, b) => b.date.localeCompare(a.date))[0].date : null;
  const cwEndDate = currentShares > 0 ? new Date().toISOString().split('T')[0] : (lastSellDate || new Date().toISOString().split('T')[0]);
  const capWeightedDays = firstBuyDate !== '—'
    ? capitalWeightedDays(buys.map(b => ({ date: b.date, cost: (b.quantity || 0) * (b.price || 0) + (b.fees || 0) })), cwEndDate)
    : null;
  const calendarDays = firstBuyDate !== '—'
    ? Math.max(0, Math.round((new Date(cwEndDate + 'T00:00:00').getTime() - new Date(firstBuyDate + 'T00:00:00').getTime()) / 86400000))
    : null;

  // Re-entry detection: shares fell to ~0 (a closed cycle) and were then rebought.
  // When true, the current-cycle avg cost hides the lifetime cost across all cycles.
  let runningShares = 0, hitZeroAfterBuy = false, hadBuy = false;
  chronologicalTx.forEach(t => {
    if (t.type === 'Buy') { runningShares += (t.quantity || 0); hadBuy = true; }
    else if (t.type === 'Sell') { runningShares -= (t.quantity || 0); if (hadBuy && runningShares <= 0.0001) hitZeroAfterBuy = true; }
  });
  const isReentered = hitZeroAfterBuy && currentShares > 0;
  const lifetimeAvgCost = totalBoughtShares > 0 ? totalBuySpend / totalBoughtShares : 0;
  const currentCycleAvgCost = holding ? holding.avgCost : avgBuyPrice;

  // Fetch chart history when overview tab is selected
  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/history?symbol=${currentTicker}&range=${chartRange}`);
        const data = await res.json();
        if (isMounted && Array.isArray(data)) {
          setHistoryData(data.map((d: any) => ({
            ...d,
            displayDate: new Date(d.date).toLocaleDateString(undefined, {
              month: 'short',
              day: chartRange === '1d' ? undefined : 'numeric'
            })
          })));
        }
      } catch (err) {
        console.error('Failed to load chart history', err);
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    };
    fetchHistory();
    return () => { isMounted = false; };
  }, [currentTicker, chartRange]);

  // Filtered transactions for search
  const filteredAllTx = sortedTx.filter(t => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return t.date.toLowerCase().includes(term) ||
           t.type.toLowerCase().includes(term) ||
           (t.broker && t.broker.toLowerCase().includes(term)) ||
           (t.price && t.price.toString().includes(term));
  });

  const handleDelete = (id: string) => {
    onDeleteTransaction(id);
    setConfirmDeleteId(null);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content stock-detail-modal" 
        style={{ 
          maxWidth: '1000px', 
          width: '94vw', 
          maxHeight: '90vh',
          display: 'flex', 
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6), 0 0 100px rgba(59, 130, 246, 0.08)',
          background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)'
        }} 
        onClick={e => e.stopPropagation()}
      >
        {/* TOP HEADER BAR */}
        <div style={{ 
          padding: '1.5rem 1.75rem', 
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(255, 255, 255, 0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ 
              width: '56px', 
              height: '56px', 
              borderRadius: '14px', 
              background: '#ffffff', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              padding: '6px'
            }}>
              <img 
                src={`https://s3-symbol-logo.tradingview.com/${currentTicker.toLowerCase()}--big.svg`} 
                onError={(e: any) => e.target.src = 'https://s3-symbol-logo.tradingview.com/indices--big.svg'}
                alt={currentTicker}
                style={{ width: '100%', height: '100%', borderRadius: '8px' }} 
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>{currentTicker}</h2>
                <span className="badge badge-purple" style={{ fontSize: '0.75rem', fontWeight: 600 }}>{sectorName}</span>
                {currentShares > 0 ? (
                  <span className="badge badge-green" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Active Holding ({currentShares} shares)</span>
                ) : closedInfo ? (
                  <span className="badge badge-blue" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Closed Position</span>
                ) : (
                  <span className="badge badge-yellow" style={{ fontSize: '0.75rem', fontWeight: 600 }}>Watchlist Stock</span>
                )}
                {isReentered && (
                  <span className="badge badge-yellow" style={{ fontSize: '0.75rem', fontWeight: 600 }}
                        title="This ticker had a fully-closed cycle and was then rebought. Realized gains from prior cycles are not banked — they are back in the market as this position.">
                    ↻ Position re-entered
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500 }}>
                {companyName}
              </p>
            </div>
          </div>

          {/* Action Buttons & Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onOpenAIAnalysis && holding && (
              <button 
                className="btn-secondary" 
                style={{ padding: '8px 14px', fontSize: '0.82rem', borderColor: 'rgba(168, 85, 247, 0.4)', background: 'rgba(168, 85, 247, 0.1)', color: '#c084fc' }}
                onClick={() => onOpenAIAnalysis(holding)}
              >
                <Brain size={16} /> <span>AI Analysis</span>
              </button>
            )}

            <button 
              className="btn-primary" 
              style={{ padding: '8px 14px', fontSize: '0.82rem', background: 'linear-gradient(135deg, var(--color-blue), #2563eb)' }}
              onClick={() => onAddTransactionForTicker(currentTicker)}
            >
              <Plus size={16} /> <span>Add Trade</span>
            </button>

            <button className="icon-btn" onClick={onClose} style={{ padding: '8px', borderRadius: '8px' }}>
              <X size={22} />
            </button>
          </div>
        </div>

        {/* HERO METRICS STRIP */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          padding: '1.25rem 1.75rem',
          background: 'rgba(0, 0, 0, 0.2)',
          borderBottom: '1px solid var(--border-color)'
        }}>
          {/* Card 1: Live Price & Holding */}
          <div style={{ background: 'var(--bg-card)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Live Price & Value
            </div>
            <div className="mono" style={{ fontSize: '1.3rem', fontWeight: 800, margin: '4px 0 2px' }}>
              EGP {livePrice.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {currentShares > 0 ? (
                <>Holding: <strong className="mono" style={{ color: 'var(--text-primary)' }}>EGP {marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></>
              ) : (
                <>No Active Shares</>
              )}
            </div>
          </div>

          {/* Card 2: Unrealized P&L */}
          <div style={{ background: 'var(--bg-card)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Unrealized P&L
            </div>
            {currentShares > 0 ? (
              <>
                <div className="mono" style={{ fontSize: '1.3rem', fontWeight: 800, margin: '4px 0 2px', color: unrealizedPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                  {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <div className="mono" style={{ fontSize: '0.8rem', color: unrealizedPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)', fontWeight: 600 }}>
                  {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnLPct.toFixed(2)}%
                </div>
              </>
            ) : (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '8px' }}>Position Closed</div>
            )}
          </div>

          {/* Card 3: Realized P&L & Dividends */}
          <div style={{ background: 'var(--bg-card)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Realized & Dividends
            </div>
            <div className="mono" style={{ fontSize: '1.3rem', fontWeight: 800, margin: '4px 0 2px', color: (realizedPnL + totalDividends) >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
              {(realizedPnL + totalDividends) >= 0 ? '+' : ''}EGP {(realizedPnL + totalDividends).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
              <span>Realized: <strong className="mono" style={{ color: realizedPnL >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>{realizedPnL >= 0 ? '+' : ''}{realizedPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></span>
              <span>•</span>
              <span>Dividends: <strong className="mono text-green">+{totalDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></span>
            </div>
          </div>

          {/* Card 4: Combined Net Performance */}
          <div style={{ background: 'var(--bg-card)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}
                 title={isReentered ? 'This ticker was re-entered — the realized figure is from prior closed cycles and is not a settled final result for the position.' : undefined}>
              {isReentered ? 'Realized (prior cycles)' : 'Total Stock Return'}
            </div>
            <div className="mono" style={{ fontSize: '1.3rem', fontWeight: 800, margin: '4px 0 2px', color: combinedTotalReturn >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
              {combinedTotalReturn >= 0 ? '+' : ''}EGP {combinedTotalReturn.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Yield on Cost: <strong className="mono text-blue">{yieldOnCost !== '—' ? `${yieldOnCost}%` : '—'}</strong>
            </div>
          </div>
        </div>

        {/* MODAL NAVIGATION TABS */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border-color)',
          background: 'rgba(255,255,255,0.01)',
          padding: '0 1.5rem',
          gap: '8px'
        }}>
          {[
            { id: 'overview', label: 'Overview & Stats', icon: <BarChart2 size={16} />, badge: null },
            { id: 'buysell', label: 'Buy / Sell History', icon: <TrendingUp size={16} />, badge: buys.length + sells.length },
            { id: 'dividends', label: 'Dividends History', icon: <Coins size={16} />, badge: dividends.length },
            { id: 'all', label: 'All Transactions', icon: <Layers size={16} />, badge: totalTxCount },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid var(--color-blue)' : '3px solid transparent',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.badge !== null && (
                <span className="badge" style={{ 
                  background: activeTab === tab.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: activeTab === tab.id ? 'var(--color-blue)' : 'var(--text-secondary)',
                  fontSize: '0.7rem'
                }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* TAB BODY CONTENT */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1.75rem' }}>
          
          {/* TAB 1: OVERVIEW & STATS */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Detailed Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                
                {/* Cost & Holdings breakdown */}
                <div className="card" style={{ background: 'var(--bg-card)', padding: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '1rem', letterSpacing: '0.5px' }}>
                    Active Position Details
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Shares Owned</span>
                      <strong className="mono">{currentShares.toLocaleString()}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{isReentered ? 'Current-cycle Avg Cost' : 'Average Purchase Cost'}</span>
                      <strong className="mono">EGP {currentCycleAvgCost > 0 ? currentCycleAvgCost.toFixed(2) : (avgBuyPrice || 0).toFixed(2)}</strong>
                    </div>
                    {isReentered && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}
                           title="Average cost across every buy in all cycles of this ticker, not just the current open position.">
                        <span style={{ color: 'var(--text-secondary)' }}>Lifetime Avg Cost (all cycles)</span>
                        <strong className="mono" style={{ color: 'var(--color-blue)' }}>EGP {lifetimeAvgCost.toFixed(2)}</strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Cost Basis</span>
                      <strong className="mono">EGP {costBasis.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Live Price</span>
                      <strong className="mono">EGP {livePrice.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Current Market Value</span>
                      <strong className="mono">EGP {marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                    </div>
                  </div>
                </div>

                {/* Historical Trading Summary */}
                <div className="card" style={{ background: 'var(--bg-card)', padding: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '1rem', letterSpacing: '0.5px' }}>
                    Historical Activity Summary
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Bought Volume</span>
                      <strong className="mono">{totalBoughtShares.toLocaleString()} shares</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Sold Volume</span>
                      <strong className="mono">{totalSoldShares.toLocaleString()} shares</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Average Sell Price</span>
                      <strong className="mono">{avgSellPrice > 0 ? `EGP ${avgSellPrice.toFixed(2)}` : '—'}</strong>
                    </div>
                    {avgSellPrice > 0 && livePrice > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', paddingTop: '4px', borderTop: '1px dashed var(--border-color)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Price since exit</span>
                        <strong className="mono" style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {livePrice.toFixed(2)} <span style={{ opacity: 0.7 }}>(sold at {avgSellPrice.toFixed(2)})</span>
                        </strong>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Fees Paid</span>
                      <strong className="mono" style={{ color: 'var(--text-muted)' }}>EGP {totalFeesPaid.toFixed(2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>First Purchase Date</span>
                      <strong className="mono">{firstBuyDate}</strong>
                    </div>
                    {capWeightedDays !== null && calendarDays !== null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}
                           title="Calendar days count from the first buy. Capital-weighted days weight each lot by the money it deployed, so late additions don't inflate the holding period.">
                        <span style={{ color: 'var(--text-secondary)' }}>Holding period</span>
                        <strong className="mono">
                          {calendarDays}d cal · <span style={{ color: 'var(--color-blue)' }}>{capWeightedDays}d cap-wtd</span>
                        </strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Peak & Trough P&L Record */}
                <div className="card" style={{ background: 'var(--bg-card)', padding: '1.25rem' }}>
                  <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '1rem', letterSpacing: '0.5px' }}>
                    All-Time Peak & Trough P&L
                  </h4>
                  {extremes ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ background: 'rgba(34, 197, 94, 0.05)', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-green)', fontWeight: 700 }}>HISTORICAL PEAK MAX P&L</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            {new Date(extremes.maxPnlDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                        <div className="mono" style={{ textAlign: 'right', color: extremes.maxPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)', fontWeight: 800 }}>
                          <div>
                            {extremes.maxPnl >= 0 ? '+' : ''}{extremes.maxPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            {extremes.maxPnlPrice != null && extremes.maxPnlPrice > 0 && (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, marginLeft: '6px' }}>
                                ({extremes.maxPnlPrice.toFixed(2)})
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem' }}>{extremes.maxPnlPct >= 0 ? '+' : ''}{extremes.maxPnlPct.toFixed(2)}%</div>
                        </div>
                      </div>

                      <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--color-red)', fontWeight: 700 }}>HISTORICAL TROUGH MIN P&L</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                            {new Date(extremes.minPnlDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                        <div className="mono" style={{ textAlign: 'right', color: extremes.minPnl >= 0 ? 'var(--color-green)' : 'var(--color-red)', fontWeight: 800 }}>
                          <div>
                            {extremes.minPnl >= 0 ? '+' : ''}{extremes.minPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            {extremes.minPnlPrice != null && extremes.minPnlPrice > 0 && (
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, marginLeft: '6px' }}>
                                ({extremes.minPnlPrice.toFixed(2)})
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem' }}>{extremes.minPnlPct >= 0 ? '+' : ''}{extremes.minPnlPct.toFixed(2)}%</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic', padding: '1rem 0' }}>
                      No historical price range available for this position yet.
                    </div>
                  )}
                </div>

              </div>

              {/* Price Chart Section */}
              <div className="card" style={{ background: 'var(--bg-card)', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Price Movement & Chart</h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                      Historical market trends for {currentTicker}
                    </p>
                  </div>
                  
                  {/* Range Selectors */}
                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    {['1d', '1w', '1m', '6m', '1y', '5y'].map(r => (
                      <button
                        key={r}
                        onClick={() => setChartRange(r)}
                        style={{
                          background: chartRange === r ? 'var(--color-blue)' : 'transparent',
                          color: chartRange === r ? '#fff' : 'var(--text-secondary)',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {r.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {loadingHistory ? (
                  <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    <Activity size={20} className="spinning" style={{ marginRight: '8px' }} /> Loading chart data...
                  </div>
                ) : historyData.length > 0 ? (
                  <div style={{ height: '220px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historyData}>
                        <defs>
                          <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="displayDate" stroke="var(--text-secondary)" fontSize={11} />
                        <YAxis domain={['auto', 'auto']} stroke="var(--text-secondary)" fontSize={11} orientation="right" />
                        <Tooltip 
                          contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', fontSize: '0.85rem' }}
                          formatter={(val: any) => [`EGP ${Number(val).toFixed(2)}`, 'Close Price']}
                        />
                        <Area type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorStock)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No chart price history available for {currentTicker}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: BUYING & SELLING HISTORY */}
          {activeTab === 'buysell' && (
            <div>
              {/* Summary Header Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Buy Summary */}
                <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-blue)', fontWeight: 700, textTransform: 'uppercase' }}>
                    BUY TRANSACTIONS ({buys.length})
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Bought Shares</div>
                      <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700 }}>{totalBoughtShares.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Invested</div>
                      <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700 }}>EGP {totalBuySpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Weighted Avg Buy</div>
                      <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-blue)' }}>
                        {avgBuyPrice > 0 ? `EGP ${avgBuyPrice.toFixed(2)}` : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sell Summary */}
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', padding: '1rem 1.25rem' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-red)', fontWeight: 700, textTransform: 'uppercase' }}>
                    SELL TRANSACTIONS ({sells.length})
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Sold Shares</div>
                      <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700 }}>{totalSoldShares.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Net Proceeds</div>
                      <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700 }}>EGP {totalSellProceeds.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Weighted Avg Sell</div>
                      <div className="mono" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-red)' }}>
                        {avgSellPrice > 0 ? `EGP ${avgSellPrice.toFixed(2)}` : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trades Table */}
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Broker</th>
                      <th style={{ textAlign: 'right' }}>Shares</th>
                      <th style={{ textAlign: 'right' }}>Unit Price</th>
                      <th style={{ textAlign: 'right' }}>Fees</th>
                      <th style={{ textAlign: 'right' }}>Total Value</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buys.concat(sells).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => {
                      const totalVal = (tx.quantity || 0) * (tx.price || 0) + (tx.type === 'Buy' ? (tx.fees || 0) : -(tx.fees || 0));
                      return (
                        <tr key={tx.id}>
                          <td style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{tx.date}</td>
                          <td>
                            <span className={`badge ${tx.type === 'Buy' ? 'badge-blue' : 'badge-red'}`}>
                              {tx.type}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{tx.broker || 'Thunder'}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{(tx.quantity || 0).toLocaleString()}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>EGP {(tx.price || 0).toFixed(2)}</td>
                          <td className="mono" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>EGP {(tx.fees || 0).toFixed(2)}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                            EGP {totalVal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {confirmDeleteId === tx.id ? (
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                <button className="btn" style={{ padding: '2px 8px', fontSize: '0.7rem', background: 'var(--color-red)', color: '#fff' }} onClick={() => handleDelete(tx.id)}>Confirm</button>
                                <button className="btn" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                              </div>
                            ) : (
                              <button className="icon-btn" title="Delete transaction" onClick={() => setConfirmDeleteId(tx.id)}>
                                <Trash2 size={15} className="text-red" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {buys.length === 0 && sells.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                          No Buy or Sell transactions recorded for {currentTicker}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: DIVIDENDS HISTORY */}
          {activeTab === 'dividends' && (
            <div>
              {/* Dividend Summary Card */}
              <div style={{ background: 'rgba(63, 185, 80, 0.05)', border: '1px solid rgba(63, 185, 80, 0.2)', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-green)', fontWeight: 700, textTransform: 'uppercase' }}>
                    TOTAL DIVIDEND CASH RECEIVED
                  </div>
                  <div className="mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-green)', margin: '4px 0 2px' }}>
                    +EGP {totalDividends.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Across {dividends.length} payout {dividends.length === 1 ? 'event' : 'events'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Yield on Cost Basis</div>
                  <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-blue)' }}>
                    {yieldOnCost !== '—' ? `${yieldOnCost}%` : '—'}
                  </div>
                </div>
              </div>

              {/* Dividends Table */}
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Payment Date</th>
                      <th>Type</th>
                      <th>Broker</th>
                      <th style={{ textAlign: 'right' }}>Fees Paid</th>
                      <th style={{ textAlign: 'right' }}>Net Dividend Received</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dividends.map(tx => {
                      const netDiv = (tx.price || 0) - (tx.fees || 0);
                      return (
                        <tr key={tx.id}>
                          <td style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{tx.date}</td>
                          <td><span className="badge badge-green">Dividend</span></td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{tx.broker || 'Thunder'}</td>
                          <td className="mono" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>EGP {(tx.fees || 0).toFixed(2)}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-green)' }}>
                            +EGP {netDiv.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {confirmDeleteId === tx.id ? (
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                <button className="btn" style={{ padding: '2px 8px', fontSize: '0.7rem', background: 'var(--color-red)', color: '#fff' }} onClick={() => handleDelete(tx.id)}>Confirm</button>
                                <button className="btn" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                              </div>
                            ) : (
                              <button className="icon-btn" title="Delete dividend" onClick={() => setConfirmDeleteId(tx.id)}>
                                <Trash2 size={15} className="text-red" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {dividends.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                          No dividend payouts recorded for {currentTicker} yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: ALL TRANSACTIONS LOG */}
          {activeTab === 'all' && (
            <div>
              {/* Search Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '280px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    placeholder="Search by date, type, broker..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 34px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>
                <button 
                  className="btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={() => onAddTransactionForTicker(currentTicker)}
                >
                  <Plus size={14} /> Add Transaction
                </button>
              </div>

              {/* Transactions Table */}
              <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Broker</th>
                      <th style={{ textAlign: 'right' }}>Shares</th>
                      <th style={{ textAlign: 'right' }}>Price / Amount</th>
                      <th style={{ textAlign: 'right' }}>Fees</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAllTx.map(tx => (
                      <tr key={tx.id}>
                        <td style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{tx.date}</td>
                        <td>
                          <span className={`badge ${
                            tx.type === 'Buy' ? 'badge-blue' :
                            tx.type === 'Sell' ? 'badge-red' :
                            tx.type === 'Dividend' ? 'badge-green' : 'badge-purple'
                          }`}>
                            {tx.type}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{tx.broker || 'Thunder'}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{tx.quantity ? tx.quantity.toLocaleString() : '—'}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>
                          EGP {(tx.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>EGP {(tx.fees || 0).toFixed(2)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {confirmDeleteId === tx.id ? (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button className="btn" style={{ padding: '2px 8px', fontSize: '0.7rem', background: 'var(--color-red)', color: '#fff' }} onClick={() => handleDelete(tx.id)}>Confirm</button>
                              <button className="btn" style={{ padding: '2px 8px', fontSize: '0.7rem' }} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                            </div>
                          ) : (
                            <button className="icon-btn" title="Delete record" onClick={() => setConfirmDeleteId(tx.id)}>
                              <Trash2 size={15} className="text-red" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredAllTx.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                          No transactions found matching "{searchTerm}".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div style={{ 
          padding: '1rem 1.75rem', 
          borderTop: '1px solid var(--border-color)', 
          background: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)'
        }}>
          <div>
            Click any transaction row action to edit or remove records for <strong style={{ color: 'var(--text-primary)' }}>{currentTicker}</strong>.
          </div>
          <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem' }} onClick={onClose}>
            Close Window
          </button>
        </div>

      </div>
    </div>
  );
};
