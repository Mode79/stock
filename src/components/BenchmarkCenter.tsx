import { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
} from 'recharts';
import {
  Coins, Landmark, TrendingUp, LineChart as LineChartIcon, Rocket, Scale, Info,
} from 'lucide-react';
import { reconstructNetWorth, monteCarloProjection } from '../utils/wealthProjection';
import { xirr, buildPortfolioCashflows, portfolioRisk } from '../utils/portfolioMetrics';
import {
  toEGPSeries, simulateAssetTrajectory, cagr, annualizedVolPct, mergeTrajectories, computeBenchmarkSummary,
  type PricePoint,
} from '../utils/benchmarkComparison';

const FALLBACK_STOCK_RETURN = 15; // %/yr, used only if XIRR can't be computed (e.g. <2 cashflows)
const FALLBACK_GOLD_RETURN = 20;  // %/yr, used only if gold history is unavailable
const FALLBACK_USD_RETURN = 12;   // %/yr, used only if FX history is unavailable
const FALLBACK_VOL = 15;

export function BenchmarkCenter({ holdings, transactions, walletBalance, lang = 'EN' }: {
  holdings: any[]; transactions: any[]; walletBalance: number; lang?: 'EN' | 'AR';
}) {
  const [histories, setHistories] = useState<Record<string, PricePoint[]>>({});
  const [goldUsd, setGoldUsd] = useState<PricePoint[]>([]);
  const [fx, setFx] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const ar = lang === 'AR';
  const t = (en: string, arr: string) => (ar ? arr : en);

  const tickers = useMemo(() => holdings.map(h => h.ticker), [holdings]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const hs: Record<string, PricePoint[]> = {};
      await Promise.all(tickers.map(async (tk) => {
        try { const j = await (await fetch(`/api/history?symbol=${tk}&range=1y`)).json(); if (Array.isArray(j)) hs[tk] = j; } catch { /* ignore */ }
      }));
      const [gold, usdegp] = await Promise.all([
        fetch(`/api/history?symbol=GC=F&range=5y`).then(r => r.json()).catch(() => []),
        fetch(`/api/history?symbol=USDEGP=X&range=5y`).then(r => r.json()).catch(() => []),
      ]);
      if (cancelled) return;
      setHistories(hs);
      setGoldUsd(Array.isArray(gold) ? gold : []);
      setFx(Array.isArray(usdegp) ? usdegp : []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tickers.join(',')]);

  const positions = holdings.map(h => ({ ...h, value: h.shares * h.livePrice }));
  const equity = positions.reduce((a, p) => a + p.value, 0);
  const totalAssets = equity + walletBalance;

  const goldEGP = useMemo(() => toEGPSeries(goldUsd, fx), [goldUsd, fx]);
  const usdEGP = fx; // price of 1 USD in EGP is the FX close itself

  const goldTrajectory = useMemo(() => simulateAssetTrajectory(transactions, goldEGP), [transactions, goldEGP]);
  const usdTrajectory = useMemo(() => simulateAssetTrajectory(transactions, usdEGP), [transactions, usdEGP]);
  const stockHistory = useMemo(() => reconstructNetWorth(transactions, histories), [transactions, histories]);

  const summary = useMemo(
    () => computeBenchmarkSummary(transactions, totalAssets, goldTrajectory, usdTrajectory),
    [transactions, totalAssets, goldTrajectory, usdTrajectory]
  );

  // ----- Historical trajectory chart (merged onto one date axis) -----
  const histChart = useMemo(() => mergeTrajectories([
    { key: 'stocks', points: stockHistory.map(p => ({ date: p.date, value: p.value })) },
    { key: 'gold', points: goldTrajectory.map(p => ({ date: p.date, value: p.value })) },
    { key: 'usd', points: usdTrajectory.map(p => ({ date: p.date, value: p.value })) },
  ]).map(r => ({ ...r, displayDate: new Date(r.date as string).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) })),
  [stockHistory, goldTrajectory, usdTrajectory]);

  // ----- Professional forecast: trailing-CAGR + realized-volatility per asset -----
  const risk = useMemo(() => portfolioRisk(
    positions.map(p => ({ ticker: p.ticker, weight: p.value })), histories, [],
  ), [positions.map(p => p.value).join(','), histories]);

  const asOf = new Date().toISOString().split('T')[0];
  const stockXirr = useMemo(() => xirr(buildPortfolioCashflows(transactions, totalAssets, asOf)), [transactions, totalAssets]);
  const stockExpPct = stockXirr !== null ? Math.round(stockXirr * 10000) / 100 : FALLBACK_STOCK_RETURN;
  const stockVol = risk.available && risk.annualVol > 0 ? risk.annualVol : FALLBACK_VOL;

  const goldSorted = [...goldEGP].sort((a, b) => a.date.localeCompare(b.date));
  const goldCagrRate = goldSorted.length >= 2 ? cagr(goldSorted[0].close, goldSorted[goldSorted.length - 1].close, goldSorted[0].date, goldSorted[goldSorted.length - 1].date) : null;
  const goldExpPct = goldCagrRate !== null ? Math.round(goldCagrRate * 10000) / 100 : FALLBACK_GOLD_RETURN;
  const goldVol = goldEGP.length >= 20 ? annualizedVolPct(goldEGP) : FALLBACK_VOL;

  const fxSorted = [...usdEGP].sort((a, b) => a.date.localeCompare(b.date));
  const usdCagrRate = fxSorted.length >= 2 ? cagr(fxSorted[0].close, fxSorted[fxSorted.length - 1].close, fxSorted[0].date, fxSorted[fxSorted.length - 1].date) : null;
  const usdExpPct = usdCagrRate !== null ? Math.round(usdCagrRate * 10000) / 100 : FALLBACK_USD_RETURN;
  const usdVol = usdEGP.length >= 20 ? annualizedVolPct(usdEGP) : FALLBACK_VOL / 2;

  const [horizon, setHorizon] = useState<number>(() => Number(localStorage.getItem('bc_horizon') || 5));
  const [monthlyAdd, setMonthlyAdd] = useState<number>(() => Number(localStorage.getItem('bc_monthly_add') || 0));

  const goldStart = goldTrajectory.length ? goldTrajectory[goldTrajectory.length - 1].value : 0;
  const usdStart = usdTrajectory.length ? usdTrajectory[usdTrajectory.length - 1].value : 0;

  const projStocks = useMemo(() => (totalAssets > 0 ? monteCarloProjection(totalAssets, stockExpPct, stockVol, horizon, monthlyAdd) : []),
    [totalAssets, stockExpPct, stockVol, horizon, monthlyAdd]);
  const projGold = useMemo(() => (goldStart > 0 ? monteCarloProjection(goldStart, goldExpPct, goldVol, horizon, monthlyAdd) : []),
    [goldStart, goldExpPct, goldVol, horizon, monthlyAdd]);
  const projUsd = useMemo(() => (usdStart > 0 ? monteCarloProjection(usdStart, usdExpPct, usdVol, horizon, monthlyAdd) : []),
    [usdStart, usdExpPct, usdVol, horizon, monthlyAdd]);

  const projChart = useMemo(() => mergeTrajectories([
    { key: 'stocks', points: projStocks.map(p => ({ date: p.date, value: p.p50 })) },
    { key: 'gold', points: projGold.map(p => ({ date: p.date, value: p.p50 })) },
    { key: 'usd', points: projUsd.map(p => ({ date: p.date, value: p.p50 })) },
  ]).map(r => ({ ...r, displayDate: new Date(r.date as string).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) })),
  [projStocks, projGold, projUsd]);

  const fmt = (v: number) => `EGP ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const card: React.CSSProperties = { background: 'var(--bg-card, #16171a)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '1.5rem' };

  if (loading) return (
    <div className="card" style={{ padding: '4rem', textAlign: 'center', margin: '0 1.5rem' }}>
      <Scale size={42} className="spinning text-blue" style={{ opacity: 0.5, marginBottom: '1rem' }} />
      <h3>{t('Comparing against gold & USD…', 'جاري المقارنة بالذهب والدولار…')}</h3>
    </div>
  );

  const legs = [
    { key: 'stocks', label: t('Your Stocks', 'أسهمك'), icon: <TrendingUp size={18} />, summary: summary.stocks, color: '#3b82f6', delta: null as number | null, deltaPct: null as number | null },
    { key: 'gold', label: t('If Gold Instead', 'لو ذهب بدلاً'), icon: <Coins size={18} />, summary: summary.gold, color: '#f59e0b', delta: summary.deltaGoldEGP, deltaPct: summary.deltaGoldPct },
    { key: 'usd', label: t('If USD Cash Instead', 'لو دولار بدلاً'), icon: <Landmark size={18} />, summary: summary.usd, color: '#10b981', delta: summary.deltaUsdEGP, deltaPct: summary.deltaUsdPct },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0 1.5rem 3rem', direction: ar ? 'rtl' : 'ltr' }}>

      {/* ============ SUMMARY ============ */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
          <Scale size={22} className="text-blue" />
          <h3 style={{ margin: 0 }}>{t('Stocks vs. Gold vs. USD', 'الأسهم مقابل الذهب والدولار')}</h3>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('same deposits & withdrawals, replayed into each asset', 'نفس الإيداعات والسحوبات، بديل الأصول')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {legs.map(l => (
            <div key={l.key} style={{ padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', borderTop: `3px solid ${l.color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: l.color }}>
                {l.icon}<strong style={{ fontSize: '0.85rem' }}>{l.label}</strong>
              </div>
              <div className="mono" style={{ fontSize: '1.3rem', fontWeight: 800, color: l.summary.profitEGP >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                {l.summary.profitEGP >= 0 ? '+' : ''}{fmt(l.summary.profitEGP)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {l.summary.returnPct !== null ? `${l.summary.returnPct >= 0 ? '+' : ''}${l.summary.returnPct}%` : 'N/A'} {t('total profit', 'إجمالي الربح')}
              </div>
              {l.delta !== null && (
                <div style={{ marginTop: '8px', fontSize: '0.72rem', color: l.delta >= 0 ? 'var(--color-green)' : 'var(--color-red)' }}>
                  {l.delta >= 0
                    ? t(`Stocks earned ${fmt(l.delta)} more`, `الأسهم حققت ${fmt(l.delta)} أكثر`)
                    : t(`Stocks earned ${fmt(Math.abs(l.delta))} less`, `الأسهم حققت ${fmt(Math.abs(l.delta))} أقل`)}
                  {l.deltaPct !== null && ` (${l.deltaPct >= 0 ? '+' : ''}${l.deltaPct}pp)`}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ============ HISTORICAL TRAJECTORY ============ */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
          <LineChartIcon size={22} className="text-blue" />
          <h3 style={{ margin: 0 }}>{t('Historical Comparison', 'المقارنة التاريخية')}</h3>
        </div>
        {histChart.length > 1 ? (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={histChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="displayDate" tick={{ fontSize: 10, fill: '#94a3b8' }} minTickGap={40} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={42} />
              <RTooltip formatter={(v: any, n: any) => [fmt(v), ({ stocks: t('Your Stocks', 'أسهمك'), gold: t('Gold Scenario', 'سيناريو الذهب'), usd: t('USD Scenario', 'سيناريو الدولار') } as any)[n] || n]} labelStyle={{ color: '#000' }} />
              <Line type="monotone" dataKey="stocks" stroke="#3b82f6" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="gold" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="usd" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : <p className="text-muted" style={{ fontSize: '0.8rem' }}>{t('Building history…', 'جاري بناء التاريخ…')}</p>}
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          <span><span style={{ color: '#3b82f6' }}>━</span> {t('Your Stocks', 'أسهمك')}</span>
          <span><span style={{ color: '#f59e0b' }}>━</span> {t('Gold Scenario', 'سيناريو الذهب')}</span>
          <span><span style={{ color: '#10b981' }}>━</span> {t('USD Scenario', 'سيناريو الدولار')}</span>
        </div>
      </div>

      {/* ============ PROFESSIONAL FORECAST ============ */}
      <div style={{ ...card, borderColor: 'rgba(59,130,246,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <Rocket size={22} className="text-blue" />
          <h3 style={{ margin: 0 }}>{t('Professional Forecast', 'التوقع الاحترافي')}</h3>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('trailing-CAGR & volatility model, per asset', 'نموذج معدل النمو السنوي المركب والتذبذب')}</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginBottom: '12px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{t('Horizon', 'المدة')}
            <select value={horizon} onChange={(e) => { const v = Number(e.target.value); setHorizon(v); localStorage.setItem('bc_horizon', String(v)); }}
              style={{ padding: '3px 6px', background: '#2a2b2e', border: '1px solid #444', color: 'white', borderRadius: 6 }}>
              {[1, 3, 5, 10, 20].map(y => <option key={y} value={y}>{y} {t('yr', 'سنة')}</option>)}
            </select></label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{t('Monthly add (all legs)', 'إضافة شهرية (لكل الأصول)')}
            <input type="number" value={monthlyAdd} onChange={(e) => { const v = Number(e.target.value); setMonthlyAdd(v); localStorage.setItem('bc_monthly_add', String(v)); }}
              style={{ width: 80, padding: '3px 6px', background: '#2a2b2e', border: '1px solid #444', color: 'white', borderRadius: 6 }} />EGP</label>
        </div>

        {projChart.length > 1 && (
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={projChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="displayDate" tick={{ fontSize: 10, fill: '#94a3b8' }} minTickGap={50} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={42} />
              <RTooltip formatter={(v: any, n: any) => [fmt(v), ({ stocks: t('Stocks (median)', 'الأسهم (وسيط)'), gold: t('Gold (median)', 'الذهب (وسيط)'), usd: t('USD (median)', 'الدولار (وسيط)') } as any)[n] || n]} labelStyle={{ color: '#000' }} />
              <Area type="monotone" dataKey="stocks" stroke="#3b82f6" strokeWidth={2.5} fill="#3b82f6" fillOpacity={0.06} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="gold" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="usd" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginTop: '12px' }}>
          {[
            { label: t('Stocks assumption', 'افتراض الأسهم'), val: `${stockExpPct >= 0 ? '+' : ''}${stockExpPct}%/yr, ${stockVol.toFixed(0)}% vol`, sub: t('your own XIRR & realized volatility', 'عائدك الفعلي وتذبذب محفظتك'), color: '#3b82f6' },
            { label: t('Gold assumption', 'افتراض الذهب'), val: `${goldExpPct >= 0 ? '+' : ''}${goldExpPct}%/yr, ${goldVol.toFixed(0)}% vol`, sub: t('trailing 5y CAGR (USD price × EGP/USD)', 'معدل نمو 5 سنوات (سعر الذهب × سعر الصرف)'), color: '#f59e0b' },
            { label: t('USD assumption', 'افتراض الدولار'), val: `${usdExpPct >= 0 ? '+' : ''}${usdExpPct}%/yr, ${usdVol.toFixed(0)}% vol`, sub: t('trailing 5y EGP/USD depreciation', 'معدل انخفاض الجنيه أمام الدولار خلال 5 سنوات'), color: '#10b981' },
          ].map(m => (
            <div key={m.label} style={{ padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', borderLeft: `3px solid ${m.color}` }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{m.label}</div>
              <div className="mono" style={{ fontSize: '0.95rem', fontWeight: 700 }}>{m.val}</div>
              <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>{m.sub}</div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '10px', fontStyle: 'italic', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
          <Info size={12} style={{ marginTop: '2px', flexShrink: 0 }} />
          {t('Each line is the median of 600 simulated paths (GBM), seeded with that asset\'s own trailing realized return and volatility — a standard historical-simulation approach, not a promise. Past performance does not guarantee future results.',
            'كل خط هو الوسيط من 600 مسار محاكاة، باستخدام العائد والتذبذب التاريخي الفعلي لكل أصل — أسلوب محاكاة تاريخية قياسي وليس وعداً. الأداء السابق لا يضمن النتائج المستقبلية.')}
        </p>
      </div>
    </div>
  );
}
