import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Holding, Transaction } from '../types';
import { assessStock, type ModelAssessment } from '../utils/stockOrderModel';

type Snapshot = { close: number | null; previousClose: number | null; time: number | null; updateMode: string | null };
type Row = { ticker: string; assessment: ModelAssessment | null; error: string; source: string };
const money = (value: number | null | undefined) => value == null ? '—' : `EGP ${value.toFixed(2)}`;
const percent = (value: number | null | undefined) => value == null ? '—' : `${(value * 100).toFixed(1)}%`;

function cairoDate(timestamp: number): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(timestamp));
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function cairoHour(timestamp: number): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', hour: '2-digit', hour12: false }).formatToParts(new Date(timestamp));
  return Number(parts.find((part) => part.type === 'hour')?.value || 0);
}

export function SwingAdvice({ holdings, transactions }: { holdings: Holding[]; transactions: Transaction[] }) {
  const tickers = useMemo(() => [...new Set(transactions.filter((tx) => (tx.type === 'Buy' || tx.type === 'Sell') && tx.ticker).map((tx) => tx.ticker!.trim().toUpperCase()))].sort(), [transactions]);
  const [rows, setRows] = useState<Row[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({});
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState('');
  const [checkedAt, setCheckedAt] = useState(0);
  const refresh = useCallback(async () => {
    if (!tickers.length) { setRows([]); return; }
    setLoading(true);
    const snapshotRequest = fetch('/api/swing-snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tickers }) })
      .then(async (response) => response.ok ? (await response.json()).data as Record<string, Snapshot> : {});
    const historyRows = await Promise.all(tickers.map(async (ticker): Promise<Row> => {
      try {
        const response = await fetch(`/api/history?symbol=${encodeURIComponent(ticker)}&range=5y&raw=1`);
        if (!response.ok) throw new Error(`History unavailable (${response.status})`);
        const history = await response.json();
        if (!Array.isArray(history)) throw new Error('History format not recognized');
        return { ticker, assessment: assessStock(history), error: '', source: 'Yahoo daily history' };
      } catch (cause) { return { ticker, assessment: null, error: cause instanceof Error ? cause.message : 'History unavailable', source: 'Yahoo daily history' }; }
    }));
    setRows(historyRows);
    setSnapshots(await snapshotRequest.catch(() => ({})));
    const now = Date.now();
    setCheckedAt(now);
    setChecked(new Date(now).toLocaleString());
    setLoading(false);
  }, [tickers]);
  useEffect(() => { const id = window.setTimeout(() => { void refresh(); }, 0); return () => window.clearTimeout(id); }, [refresh]);

  const chosen = rows.find((row) => row.ticker === selected) || rows[0];
  const status = (row: Row) => {
    const a = row.assessment, tv = snapshots[row.ticker];
    if (!a) return { label: 'NO DATA', reason: row.error, actionable: false };
    if (!a.plan) return { label: 'NO ORDER', reason: a.reason, actionable: false };
    if (!tv || !tv.time || tv.close == null || !Number.isFinite(tv.close)) return { label: 'VERIFY DATA', reason: 'TradingView quote unavailable.', actionable: false };
    if (cairoHour(checkedAt) < 16 && cairoDate(tv.time * 1000) === cairoDate(checkedAt)) return { label: 'WAIT FOR CLOSE', reason: 'The daily TradingView bar may still be forming or delayed.', actionable: false };
    if (cairoDate(tv.time * 1000) !== a.lastDate) return { label: 'VERIFY DATA', reason: 'Historical model and TradingView are on different dates.', actionable: false };
    if (Math.abs(tv.close / a.asOfClose - 1) > .01) return { label: 'VERIFY DATA', reason: 'TradingView and historical close differ by more than 1%.', actionable: false };
    return { label: 'BUY LIMIT PLAN', reason: a.reason, actionable: true };
  };
  const selectedStatus = chosen ? status(chosen) : null;
  return <section style={{ padding: '1.5rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
      <div><h2 style={{ margin: 0 }}>Order Planner</h2><p className="text-muted">Tested swing patterns for stocks you have bought or sold, including closed positions.</p></div>
      <button className="btn-secondary" onClick={() => void refresh()} disabled={loading}>{loading ? 'Checking…' : 'Refresh plans'}</button>
    </div>
    <p className="text-muted" style={{ fontSize: '.82rem' }}>Recent low and high are observed prices from the last five completed sessions, not predicted order levels. Buy and sell limits appear only when a tested plan supports them. Research history: Yahoo daily OHLCV; current-price check: TradingView. No Telda order is placed automatically.</p>
    {checked && <p className="text-muted" style={{ fontSize: '.75rem' }}>Last checked {checked}</p>}
    <div style={{ overflowX: 'auto' }}><table className="data-table"><thead><tr><th>Stock</th><th>Position</th><th>Plan status</th><th>Why withheld</th><th>Recent low</th><th>Recent high</th><th>Buy limit</th><th>Sell limit</th><th>Stop</th><th>Validation trades</th></tr></thead><tbody>
      {rows.map((row) => { const a = row.assessment, owned = holdings.some((h) => h.ticker.trim().toUpperCase() === row.ticker && h.shares > 0), s = status(row);
        return <tr key={row.ticker} onClick={() => setSelected(row.ticker)} style={{ cursor: 'pointer', background: chosen?.ticker === row.ticker ? 'rgba(80,130,255,.10)' : undefined }}>
          <td><b>{row.ticker}</b></td><td>{owned ? 'Held' : 'Previously traded'}</td><td><b>{s.label}</b></td><td title={s.reason}>{s.actionable ? 'Validated setup' : s.reason}</td>
          <td title={`Observed five-session low through ${a?.lastDate || 'unknown date'}; not an order`}>{money(a?.recentLow)}</td><td title={`Observed five-session high through ${a?.lastDate || 'unknown date'}; not an order`}>{money(a?.recentHigh)}</td>
          <td>{s.actionable ? money(a?.plan?.limit) : 'No tested order'}</td><td>{owned ? 'No tested exit' : s.actionable ? money(a?.plan?.target) : 'After entry'}</td><td>{s.actionable ? money(a?.plan?.stop) : '—'}</td><td>{a?.validation.trades ?? '—'}</td>
        </tr>; })}</tbody></table></div>
    {chosen && selectedStatus && <div style={{ marginTop: '1rem', padding: '1.25rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
      <h3 style={{ marginTop: 0 }}>{chosen.ticker} · {selectedStatus.label}</h3><p>{selectedStatus.reason}</p>
      {chosen.assessment && <>
        <p className="text-muted">Historical bars: {chosen.assessment.historyBars} valid, {chosen.assessment.rejectedBars} rejected · {chosen.assessment.firstDate} to {chosen.assessment.lastDate} · Pattern {chosen.assessment.pattern?.replaceAll('_', ' ') || 'none'} · Trust {chosen.assessment.trust}</p>
        <p className="text-muted">Observed last-five-session range: {money(chosen.assessment.recentLow)} to {money(chosen.assessment.recentHigh)}. These are historical touch points only. They do not measure the chance that a buy near the low will be followed by a sale near the high.</p>
        <p className="text-muted">Later-period validation: {chosen.assessment.validation.trades} trades · win rate {percent(chosen.assessment.validation.winRate)} · average {percent(chosen.assessment.validation.mean)} · median {percent(chosen.assessment.validation.median)} · profit factor {chosen.assessment.validation.profitFactor?.toFixed(2) ?? '—'} · completed-trade drawdown {percent(chosen.assessment.validation.maxDrawdown)}.</p>
        {selectedStatus.actionable && chosen.assessment.plan && <p>Proposed Telda buy limit {money(chosen.assessment.plan.limit)}. Cancel after {chosen.assessment.plan.expiresAfterSessions} sessions if unfilled. If that new buy fills, plan a stop at {money(chosen.assessment.plan.stop)} and a sell limit at {money(chosen.assessment.plan.target)} for those new shares; review after {chosen.assessment.plan.maxHoldSessions} sessions. Size so the planned stop risks at most 0.5% of your portfolio. Gap losses can exceed that limit.</p>}
        {!selectedStatus.actionable && holdings.some((h) => h.ticker.trim().toUpperCase() === chosen.ticker && h.shares > 0) && <p>You currently hold {chosen.ticker}. The model has no validated sell limit for this holding; the recent high above is a reference, not a recommended exit price.</p>}
      </>}
      <p className="text-muted" style={{ fontSize: '.78rem' }}>Model chooses among three fixed patterns using development data, then evaluates the chosen pattern on later trades. Simulated limits must trade through by 0.1%; stop wins ambiguous bars; stops receive a 1% adverse-fill penalty and 0.8% round-trip cost is deducted. Historical opens are excluded because sources disagree on some EGX dates. Trust requires enough later trades and consistent positive results. It is evidence quality, not a probability of profit.</p>
      <a href={`https://www.tradingview.com/symbols/EGX-${encodeURIComponent(chosen.ticker)}/`} target="_blank" rel="noreferrer">Open {chosen.ticker} on TradingView ↗</a>
    </div>}
  </section>;
}
