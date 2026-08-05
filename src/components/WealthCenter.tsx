import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RTooltip,
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, ReferenceDot,
} from 'recharts';
import {
  Target, ShieldAlert, PieChart as PieIcon, TrendingUp, AlertTriangle, CheckCircle2, Wallet, Globe,
  BellRing, Volume2, VolumeX, LineChart as LineChartIcon, Rocket, Flag,
} from 'lucide-react';
import { reconstructNetWorth, monteCarloProjection, goalAnalysis } from '../utils/wealthProjection';
import { buildTechnicalProfile, resampleWeekly } from '../utils/technicalAnalysis';
import { calculateRecommendation } from '../utils/recommendationEngine';
import { parseFundamentals, scoreFundamentals } from '../utils/fundamentals';
import { buildActions } from '../utils/actionCenter';
import {
  xirr, buildPortfolioCashflows, totalReturnOnCapital, portfolioRisk,
  allocationByPosition, allocationBySector, concentrationHHI, realReturn, usdAdjustedReturn,
} from '../utils/portfolioMetrics';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#a855f7', '#6366f1'];

export function WealthCenter({ holdings, transactions, walletBalance, lang = 'EN' }: {
  holdings: any[]; transactions: any[]; walletBalance: number; lang?: 'EN' | 'AR';
}) {
  const [histories, setHistories] = useState<Record<string, any[]>>({});
  const [benchmark, setBenchmark] = useState<any[]>([]);
  const [fxSeries, setFxSeries] = useState<any[]>([]);
  const [fundamentals, setFundamentals] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [inflation, setInflation] = useState<number>(() => Number(localStorage.getItem('wc_inflation') || 25));
  const ar = lang === 'AR';

  const tickers = useMemo(() => holdings.map(h => h.ticker), [holdings]);

  useEffect(() => {
    if (tickers.length === 0) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const hs: Record<string, any[]> = {};
      await Promise.all(tickers.map(async (t) => {
        try { const j = await (await fetch(`/api/history?symbol=${t}&range=1y`)).json(); if (Array.isArray(j)) hs[t] = j; } catch {}
      }));
      const [bench, fx, fund] = await Promise.all([
        fetch(`/api/history?symbol=^EGX30&range=1y`).then(r => r.json()).catch(() => []),
        fetch(`/api/history?symbol=USDEGP=X&range=1y`).then(r => r.json()).catch(() => []),
        fetch(`/api/fundamentals?symbols=${tickers.join(',')}`).then(r => r.json()).catch(() => ({})),
      ]);
      if (cancelled) return;
      setHistories(hs);
      setBenchmark(Array.isArray(bench) ? bench : []);
      setFxSeries(Array.isArray(fx) ? fx : []);
      setFundamentals(fund && typeof fund === 'object' ? fund : {});
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tickers.join(',')]);

  // Derived totals
  const positions = holdings.map(h => ({ ...h, value: h.shares * h.livePrice }));
  const equity = positions.reduce((a, p) => a + p.value, 0);
  const totalAssets = equity + walletBalance;

  // Per-holding engine verdicts (memoized)
  const verdicts = useMemo(() => {
    const benchClose = benchmark.map(p => p.close);
    return positions.map(p => {
      const hist = histories[p.ticker];
      const profile = hist && hist.length >= 15 ? buildTechnicalProfile(hist, benchClose.length > 2 ? benchClose : undefined) : null;
      const weekly = hist && hist.length >= 40 ? buildTechnicalProfile(resampleWeekly(hist)) : null;
      const fund = scoreFundamentals(fundamentals[p.ticker] ? parseFundamentals(p.ticker, fundamentals[p.ticker]) : null);
      const rec = profile ? calculateRecommendation(profile, {
        fundamentals: fund, weeklyTrendRegime: weekly?.trendRegime,
        hasBenchmark: benchClose.length > 2, capital: equity,
      }) : null;
      const pnlPct = p.totalCost > 0 ? ((p.value - p.totalCost) / p.totalCost) * 100 : 0;
      return { p, rec, weightPct: equity > 0 ? (p.value / equity) * 100 : 0, pnlPct };
    });
  }, [positions.map(p => p.ticker + p.value).join(','), histories, fundamentals, benchmark]);

  const actions = useMemo(() => buildActions(
    verdicts.filter(v => v.rec).map(v => ({
      ticker: v.p.ticker, company: v.p.company, rec: v.rec!, weightPct: v.weightPct, livePrice: v.p.livePrice, pnlPct: v.pnlPct,
    }))
  ), [verdicts]);

  // ----- Price alerts: stop-loss breached / base target reached -----
  const priceAlerts = useMemo(() => {
    const out: { ticker: string; type: 'STOP' | 'TARGET'; level: number; price: number }[] = [];
    for (const v of verdicts) {
      if (!v.rec) continue;
      const lp = v.p.livePrice;
      if (v.rec.stopLoss > 0 && lp <= v.rec.stopLoss) out.push({ ticker: v.p.ticker, type: 'STOP', level: v.rec.stopLoss, price: lp });
      else if (v.rec.targets?.base > 0 && lp >= v.rec.targets.base) out.push({ ticker: v.p.ticker, type: 'TARGET', level: v.rec.targets.base, price: lp });
    }
    return out;
  }, [verdicts]);

  const [alertsMuted, setAlertsMuted] = useState(() => localStorage.getItem('wc_alerts_muted') === '1');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const spokenRef = useRef<Set<string>>(new Set());
  const liveAlerts = priceAlerts.filter(a => !dismissed.has(`${a.ticker}:${a.type}`));

  // Speak each new alert once (respects mute).
  useEffect(() => {
    if (alertsMuted || liveAlerts.length === 0) return;
    const key = liveAlerts.map(a => `${a.ticker}:${a.type}`).sort().join('|');
    if (spokenRef.current.has(key)) return;
    spokenRef.current.add(key);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const msg = liveAlerts.map(a => `${a.ticker} ${a.type === 'STOP' ? 'hit its stop loss' : 'reached its target'}`).join(', ');
      const u = new SpeechSynthesisUtterance('Price alert: ' + msg);
      u.rate = 0.95;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    }
  }, [liveAlerts.map(a => a.ticker + a.type).join(','), alertsMuted]);

  // Risk metrics
  const risk = useMemo(() => portfolioRisk(
    positions.map(p => ({ ticker: p.ticker, weight: p.value })),
    histories, benchmark.map(p => p.close),
  ), [positions.map(p => p.value).join(','), histories, benchmark]);

  // Allocation
  const posAlloc = allocationByPosition(positions.map(p => ({ ticker: p.ticker, value: p.value })));
  const secAlloc = allocationBySector(positions.map(p => ({ sector: p.sector, value: p.value })));
  const hhi = concentrationHHI(posAlloc);
  const cashPct = totalAssets > 0 ? (walletBalance / totalAssets) * 100 : 0;

  // True returns
  const asOf = new Date().toISOString().split('T')[0];
  const nominalTotal = totalReturnOnCapital(transactions, equity + walletBalance);
  const xirrRate = xirr(buildPortfolioCashflows(transactions, equity + walletBalance, asOf));
  const xirrPct = xirrRate !== null ? Math.round(xirrRate * 1000) / 10 : null;
  // Real return compares like-for-like ANNUAL figures: annualized return (XIRR) vs annual inflation.
  const realRet = xirrPct !== null ? realReturn(xirrPct, inflation)
    : nominalTotal !== null ? realReturn(nominalTotal, inflation) : null;
  // USD-adjusted: measure the FX move over the ACTUAL holding period, not a fixed year.
  const inceptionDate = transactions.length ? [...transactions].sort((a, b) => a.date.localeCompare(b.date))[0].date : null;
  const fxAtInception = (() => {
    if (!fxSeries.length || !inceptionDate) return fxSeries.length ? fxSeries[0].close : 0;
    const at = fxSeries.find((p: any) => p.date.split('T')[0] >= inceptionDate);
    return at ? at.close : fxSeries[0].close;
  })();
  const fxEnd = fxSeries.length ? fxSeries[fxSeries.length - 1].close : 0;
  const usdRet = nominalTotal !== null && fxAtInception && fxEnd ? usdAdjustedReturn(nominalTotal, fxAtInception, fxEnd) : null;
  const fxMovePct = fxAtInception && fxEnd ? ((fxEnd - fxAtInception) / fxAtInception) * 100 : 0;

  // ----- Wealth Trajectory: historical reconstruction + Monte-Carlo forecast -----
  const history = useMemo(() => reconstructNetWorth(transactions, histories), [transactions, histories]);
  const [expReturn, setExpReturn] = useState<number>(() => Number(localStorage.getItem('wc_exp_return') || 15));
  const [monthlyAdd, setMonthlyAdd] = useState<number>(() => Number(localStorage.getItem('wc_monthly_add') || 0));
  const [horizon, setHorizon] = useState<number>(() => Number(localStorage.getItem('wc_horizon') || 5));
  const projVol = risk.available && risk.annualVol > 0 ? risk.annualVol : 25;
  const projection = useMemo(
    () => (totalAssets > 0 ? monteCarloProjection(totalAssets, expReturn, projVol, horizon, monthlyAdd) : []),
    [totalAssets, expReturn, projVol, horizon, monthlyAdd]
  );
  const finalProj = projection.length ? projection[projection.length - 1] : null;
  const totalContrib = finalProj ? finalProj.contributedLine : totalAssets;

  // ----- Financial Independence goal -----
  const defaultGoal = Math.max(1000000, Math.ceil((totalAssets * 2) / 100000) * 100000);
  const [goal, setGoal] = useState<number>(() => Number(localStorage.getItem('wc_goal') || 0) || defaultGoal);
  const goalHorizon = Math.max(horizon, 20); // look far enough to assess reachability
  const goalRes = useMemo(
    () => (totalAssets > 0 && goal > 0 ? goalAnalysis(totalAssets, expReturn, projVol, goalHorizon, monthlyAdd, goal) : null),
    [totalAssets, expReturn, projVol, goalHorizon, monthlyAdd, goal]
  );
  const goalCurve = goalRes ? goalRes.curve.filter((_, i) => i % 3 === 0).map(c => ({ ...c, displayDate: new Date(c.date).toLocaleDateString(undefined, { year: '2-digit', month: 'short' }) })) : [];
  const goalDateLabel = goalRes?.expectedDate ? new Date(goalRes.expectedDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : null;

  const histChart = history.map(p => ({ ...p, displayDate: new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }));
  const projChart = projection.map(p => ({ ...p, displayDate: new Date(p.date).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), lo: p.p10, band: p.p90 - p.p10 }));
  const fmt = (v: number) => `EGP ${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const t = (en: string, arr: string) => (ar ? arr : en);

  if (loading) return (
    <div className="card" style={{ padding: '4rem', textAlign: 'center', margin: '0 1.5rem' }}>
      <TrendingUp size={42} className="spinning text-blue" style={{ opacity: 0.5, marginBottom: '1rem' }} />
      <h3>{t('Computing your wealth metrics…', 'جاري حساب مؤشرات الثروة…')}</h3>
    </div>
  );

  const card: React.CSSProperties = { background: 'var(--bg-card, #16171a)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '1.5rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0 1.5rem 3rem', direction: ar ? 'rtl' : 'ltr' }}>

      {/* ============ PRICE ALERTS ============ */}
      {liveAlerts.length > 0 && (
        <div style={{ border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.07)', borderRadius: '16px', padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BellRing size={18} className="text-red" />
              <strong style={{ color: 'var(--color-red)' }}>{t('Price Alerts', 'تنبيهات السعر')} ({liveAlerts.length})</strong>
            </div>
            <button onClick={() => { const m = !alertsMuted; setAlertsMuted(m); localStorage.setItem('wc_alerts_muted', m ? '1' : '0'); }}
              title={alertsMuted ? t('Unmute voice alerts', 'تفعيل الصوت') : t('Mute voice alerts', 'كتم الصوت')}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '4px 8px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem' }}>
              {alertsMuted ? <VolumeX size={14} /> : <Volume2 size={14} />} {alertsMuted ? t('Muted', 'مكتوم') : t('Voice on', 'الصوت يعمل')}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {liveAlerts.map(a => (
              <div key={`${a.ticker}:${a.type}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                <span>
                  <b>{a.ticker}</b> — <span style={{ color: a.type === 'STOP' ? 'var(--color-red)' : 'var(--color-green)', fontWeight: 700 }}>
                    {a.type === 'STOP' ? t('STOP-LOSS breached', 'كسر وقف الخسارة') : t('TARGET reached', 'بلوغ الهدف')}</span>
                  {' '}<span className="text-muted">({t('price', 'السعر')} {a.price} {a.type === 'STOP' ? '≤' : '≥'} {a.level})</span>
                </span>
                <button onClick={() => setDismissed(prev => new Set(prev).add(`${a.ticker}:${a.type}`))}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem' }}>
                  {t('dismiss', 'إخفاء')} ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ ACTION CENTER ============ */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
          <Target size={22} className="text-blue" />
          <h3 style={{ margin: 0 }}>{t('Action Center', 'مركز القرارات')}</h3>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('what to do now, ranked by urgency', 'ما يجب فعله الآن، مرتباً حسب الأولوية')}</span>
        </div>
        {actions.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-green)', padding: '1rem', background: 'rgba(16,185,129,0.06)', borderRadius: '12px' }}>
            <CheckCircle2 size={20} /> {t('No urgent actions. All holdings are within plan — hold and monitor.', 'لا إجراءات عاجلة. جميع المراكز ضمن الخطة — احتفظ وراقب.')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {actions.map(a => (
              <div key={a.ticker} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', borderLeft: `4px solid ${a.color}` }}>
                <div style={{ minWidth: '74px' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{a.ticker}</div>
                  <span style={{ fontSize: '0.55rem', fontWeight: 700, padding: '2px 6px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', color: a.color }}>{ar ? ({CRITICAL:'حرج',HIGH:'عالٍ',MEDIUM:'متوسط',LOW:'منخفض'} as any)[a.urgency] : a.urgency}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: a.color, fontSize: '0.9rem' }}>{ar ? a.action_ar : a.action}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45, marginTop: '2px' }}>{ar ? a.reason_ar : a.reason}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============ TRUE RETURNS ============ */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
          <Globe size={22} className="text-green" />
          <h3 style={{ margin: 0 }}>{t('True Returns', 'العوائد الحقيقية')}</h3>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('what your money actually earned', 'ما حققته أموالك فعلياً')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
          {[
            { label: t('Money-Weighted (XIRR)', 'العائد السنوي (XIRR)'), val: xirrPct !== null ? `${xirrPct >= 0 ? '+' : ''}${xirrPct}%` : 'N/A', sub: t('annualized, timing-aware', 'سنوي، يراعي التوقيت'), color: (xirrPct ?? 0) >= 0 ? 'var(--color-green)' : 'var(--color-red)' },
            { label: t('Total Return on Capital', 'إجمالي العائد على رأس المال'), val: nominalTotal !== null ? `${nominalTotal >= 0 ? '+' : ''}${nominalTotal}%` : 'N/A', sub: t('vs money you deposited', 'مقابل ما أودعته'), color: (nominalTotal ?? 0) >= 0 ? 'var(--color-green)' : 'var(--color-red)' },
            { label: t('Real Return (ann.)', 'العائد الحقيقي سنوياً'), val: realRet !== null ? `${realRet >= 0 ? '+' : ''}${realRet}%` : 'N/A', sub: t(`annualized, after ${inflation}% inflation`, `سنوي، بعد تضخم ${inflation}٪`), color: (realRet ?? 0) >= 0 ? 'var(--color-green)' : 'var(--color-red)' },
            { label: t('USD-Adjusted', 'بالدولار'), val: usdRet !== null ? `${usdRet >= 0 ? '+' : ''}${usdRet}%` : 'N/A', sub: t(`EGP ${fxMovePct >= 0 ? 'weakened' : 'strengthened'} ${Math.abs(fxMovePct).toFixed(1)}%`, `الجنيه ${fxMovePct >= 0 ? 'ضعف' : 'قوي'} ${Math.abs(fxMovePct).toFixed(1)}٪`), color: (usdRet ?? 0) >= 0 ? 'var(--color-green)' : 'var(--color-red)' },
          ].map(m => (
            <div key={m.label} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{m.label}</div>
              <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 800, color: m.color }}>{m.val}</div>
              <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>{m.sub}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          <label>{t('Inflation assumption:', 'افتراض التضخم:')}</label>
          <input type="number" value={inflation} min={0} max={100}
            onChange={(e) => { const v = Number(e.target.value); setInflation(v); localStorage.setItem('wc_inflation', String(v)); }}
            style={{ width: '64px', padding: '3px 6px', background: '#2a2b2e', border: '1px solid #444', color: 'white', borderRadius: '6px' }} />
          <span>%</span>
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{t('— editable; used for the Real Return only', '— قابل للتعديل؛ يُستخدم للعائد الحقيقي فقط')}</span>
        </div>
      </div>

      {/* ============ WEALTH TRAJECTORY ============ */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
          <LineChartIcon size={22} className="text-blue" />
          <h3 style={{ margin: 0 }}>{t('Wealth Trajectory', 'مسار الثروة')}</h3>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('where your money has been', 'أين كانت أموالك')}</span>
        </div>
        {histChart.length > 1 ? (
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={histChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gGain" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="displayDate" tick={{ fontSize: 10, fill: '#94a3b8' }} minTickGap={40} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={42} />
              <RTooltip formatter={(v: any, n: any) => [fmt(v), n === 'value' ? t('Net Worth', 'الثروة') : t('Contributed', 'المودع')]} labelStyle={{ color: '#000' }} />
              <Area type="monotone" dataKey="value" name="value" stroke="#10b981" strokeWidth={2} fill="url(#gGain)" isAnimationActive={false} />
              <Line type="monotone" dataKey="contributed" name="contributed" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
              {histChart.filter(p => p.deposit).map((p, i) => (
                <ReferenceDot key={i} x={p.displayDate} y={p.value} r={4} fill="#3b82f6" stroke="#fff" strokeWidth={1} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        ) : <p className="text-muted" style={{ fontSize: '0.8rem' }}>{t('Building history…', 'جاري بناء التاريخ…')}</p>}
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          <span><span style={{ color: '#10b981' }}>━</span> {t('Net worth', 'الثروة')}</span>
          <span><span style={{ color: '#94a3b8' }}>┄</span> {t('Capital you contributed', 'رأس المال المودع')}</span>
          <span><span style={{ color: '#3b82f6' }}>●</span> {t('Deposit', 'إيداع')}</span>
          <span style={{ marginInlineStart: 'auto', color: 'var(--text-secondary)' }}>{t('The green-over-grey gap is your market gains.', 'الفجوة الخضراء فوق الرمادية هي أرباح السوق.')}</span>
        </div>
      </div>

      {/* ============ FORWARD PROJECTION ============ */}
      <div style={{ ...card, borderColor: 'rgba(16,185,129,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <Rocket size={22} className="text-green" />
          <h3 style={{ margin: 0 }}>{t('Wealth Forecast', 'توقعات الثروة')}</h3>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{t('Monte-Carlo projection · 600 simulated futures', 'محاكاة مونت كارلو · 600 سيناريو')}</span>
        </div>

        {/* Controls (clearly-labeled assumptions) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginBottom: '12px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{t('Expected return', 'العائد المتوقع')}
            <input type="number" value={expReturn} onChange={(e) => { const v = Number(e.target.value); setExpReturn(v); localStorage.setItem('wc_exp_return', String(v)); }}
              style={{ width: 56, padding: '3px 6px', background: '#2a2b2e', border: '1px solid #444', color: 'white', borderRadius: 6 }} />%/yr</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{t('Monthly add', 'إضافة شهرية')}
            <input type="number" value={monthlyAdd} onChange={(e) => { const v = Number(e.target.value); setMonthlyAdd(v); localStorage.setItem('wc_monthly_add', String(v)); }}
              style={{ width: 80, padding: '3px 6px', background: '#2a2b2e', border: '1px solid #444', color: 'white', borderRadius: 6 }} />EGP</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{t('Horizon', 'المدة')}
            <select value={horizon} onChange={(e) => { const v = Number(e.target.value); setHorizon(v); localStorage.setItem('wc_horizon', String(v)); }}
              style={{ padding: '3px 6px', background: '#2a2b2e', border: '1px solid #444', color: 'white', borderRadius: 6 }}>
              {[1, 3, 5, 10, 20].map(y => <option key={y} value={y}>{y} {t('yr', 'سنة')}</option>)}
            </select></label>
          <span style={{ alignSelf: 'center', fontStyle: 'italic', color: 'var(--text-muted)' }}>
            {t(`volatility ${projVol.toFixed(0)}% (from your book)`, `التذبذب ${projVol.toFixed(0)}٪`)}
          </span>
        </div>

        {projChart.length > 1 && (
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={projChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="displayDate" tick={{ fontSize: 10, fill: '#94a3b8' }} minTickGap={50} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={42} />
              <RTooltip labelStyle={{ color: '#000' }} itemSorter={(i: any) => -i.value}
                formatter={(v: any, n: any) => {
                  if (n === 'lo' || n === 'band') return [null, null];
                  const names: any = { p90: t('Optimistic (90%)', 'متفائل'), p50: t('Median (50%)', 'وسيط'), p10: t('Pessimistic (10%)', 'متشائم'), contributedLine: t('Contributed', 'المودع') };
                  return [fmt(v), names[n] || n];
                }} />
              {/* Confidence band via stacked areas: invisible base (p10) + visible width (p90-p10) */}
              <Area type="monotone" dataKey="lo" stackId="band" stroke="none" fill="none" isAnimationActive={false} legendType="none" />
              <Area type="monotone" dataKey="band" stackId="band" stroke="none" fill="url(#gBand)" isAnimationActive={false} legendType="none" />
              <Line type="monotone" dataKey="p50" stroke="#10b981" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="p90" stroke="#10b981" strokeWidth={1} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="p10" stroke="#ef4444" strokeWidth={1} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="contributedLine" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="2 3" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {finalProj && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginTop: '12px' }}>
            {[
              { label: t(`Median in ${horizon}y`, `الوسيط خلال ${horizon} سنوات`), val: fmt(finalProj.p50), color: 'var(--color-green)' },
              { label: t('Optimistic (90%)', 'متفائل (90٪)'), val: fmt(finalProj.p90), color: 'var(--color-green)' },
              { label: t('Pessimistic (10%)', 'متشائم (10٪)'), val: fmt(finalProj.p10), color: (finalProj.p10 >= totalContrib ? 'var(--color-yellow)' : 'var(--color-red)') },
              { label: t('Total you contribute', 'إجمالي ما ستودعه'), val: fmt(totalContrib), color: 'var(--text-secondary)' },
            ].map(m => (
              <div key={m.label} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{m.label}</div>
                <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 800, color: m.color }}>{m.val}</div>
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '10px', fontStyle: 'italic' }}>
          {t('The shaded band is the 10–90% range of 600 simulated futures using your portfolio’s real volatility. Expected return, contributions and horizon are your editable assumptions — not promises. Markets can fall below the 10% line.',
             'النطاق المظلل هو مدى 10–90٪ من 600 سيناريو باستخدام تذبذب محفظتك الحقيقي. العائد والإضافات والمدة افتراضات قابلة للتعديل وليست وعوداً.')}
        </p>
      </div>

      {/* ============ FINANCIAL INDEPENDENCE GOAL ============ */}
      {goalRes && (
        <div style={{ ...card, borderColor: 'rgba(59,130,246,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <Flag size={22} className="text-blue" />
            <h3 style={{ margin: 0 }}>{t('Financial Independence Goal', 'هدف الاستقلال المالي')}</h3>
            <label style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {t('Target', 'الهدف')}
              <input type="number" value={goal} step={100000}
                onChange={(e) => { const v = Number(e.target.value); setGoal(v); localStorage.setItem('wc_goal', String(v)); }}
                style={{ width: 130, padding: '4px 8px', background: '#2a2b2e', border: '1px solid #444', color: 'white', borderRadius: 6 }} /> EGP
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) 1fr', gap: '1.5rem', alignItems: 'center' }}>
            {/* Probability gauge */}
            <div style={{ textAlign: 'center' }}>
              {(() => {
                const p = goalRes.probability;
                const col = p >= 75 ? 'var(--color-green)' : p >= 45 ? 'var(--color-yellow)' : 'var(--color-red)';
                const R = 52, C = 2 * Math.PI * R;
                return (
                  <svg width="140" height="140" viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
                    <circle cx="70" cy="70" r={R} fill="none" stroke={col} strokeWidth="12" strokeLinecap="round"
                      strokeDasharray={`${(p / 100) * C} ${C}`} transform="rotate(-90 70 70)" />
                    <text x="70" y="66" textAnchor="middle" fontSize="30" fontWeight="800" fill={col}>{p}%</text>
                    <text x="70" y="90" textAnchor="middle" fontSize="10" fill="#94a3b8">{t('probability', 'احتمال')}</text>
                  </svg>
                );
              })()}
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {t(`chance of reaching ${fmt(goal)} within ${goalHorizon}y`, `فرصة بلوغ ${fmt(goal)} خلال ${goalHorizon} سنة`)}
              </div>
            </div>

            {/* Verdict + success curve */}
            <div>
              <div style={{ fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '10px' }}>
                {goalDateLabel ? (
                  <>{t('At', 'عند')} <b>{expReturn}%/yr</b>{monthlyAdd > 0 ? <> {t('plus', 'و')} <b>{fmt(monthlyAdd)}/mo</b></> : null}, {t('you are', 'لديك')} <b style={{ color: goalRes.probability >= 60 ? 'var(--color-green)' : 'var(--color-yellow)' }}>{goalRes.probability}%</b> {t('likely to reach', 'احتمال بلوغ')} <b>{fmt(goal)}</b> — {t('expected around', 'متوقع حوالي')} <b className="text-blue">{goalDateLabel}</b>.</>
                ) : (
                  <>{t('At current assumptions, reaching', 'بالافتراضات الحالية، بلوغ')} <b>{fmt(goal)}</b> {t('is unlikely within', 'غير مرجح خلال')} {goalHorizon}{t('y (', ' سنة (')}<b style={{ color: 'var(--color-red)' }}>{goalRes.probability}%</b>). {t('Raise contributions or extend the horizon.', 'ارفع الإضافات أو مدّد المدة.')}</>
                )}
              </div>
              {goalCurve.length > 1 && (
                <ResponsiveContainer width="100%" height={120}>
                  <ComposedChart data={goalCurve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gGoal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="displayDate" tick={{ fontSize: 9, fill: '#94a3b8' }} minTickGap={40} />
                    <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={34} />
                    <RTooltip formatter={(v: any) => [`${v}%`, t('reached by then', 'محقق بحلوله')]} labelStyle={{ color: '#000' }} />
                    <Area type="monotone" dataKey="pct" stroke="#3b82f6" strokeWidth={2} fill="url(#gGoal)" isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {t('Cumulative probability of having reached the goal by each date (1,500 simulations).', 'الاحتمال التراكمي لبلوغ الهدف بحلول كل تاريخ (1500 محاكاة).')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ RISK + ALLOCATION ============ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>

        {/* Risk */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
            <ShieldAlert size={22} className="text-yellow" />
            <h3 style={{ margin: 0 }}>{t('Portfolio Risk', 'مخاطر المحفظة')}</h3>
          </div>
          {risk.available ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {[
                { label: t('Volatility (ann.)', 'التذبذب سنوياً'), val: `${risk.annualVol}%`, color: risk.annualVol > 40 ? 'var(--color-red)' : risk.annualVol > 25 ? 'var(--color-yellow)' : 'var(--color-green)', tip: t('how much the book swings', 'مدى تقلب المحفظة') },
                { label: t('Beta vs EGX30', 'بيتا مقابل المؤشر'), val: risk.beta.toFixed(2), color: Math.abs(risk.beta) > 1.2 ? 'var(--color-yellow)' : 'var(--text-primary)', tip: t('>1 = more volatile than market', 'أكبر من 1 = أكثر تقلباً من السوق') },
                { label: t('Sharpe Ratio', 'نسبة شارب'), val: risk.sharpe.toFixed(2), color: risk.sharpe >= 1 ? 'var(--color-green)' : risk.sharpe >= 0 ? 'var(--color-yellow)' : 'var(--color-red)', tip: t('return per unit of risk; >1 good', 'العائد لكل وحدة مخاطرة؛ أكبر من 1 جيد') },
                { label: t('Max Drawdown', 'أقصى تراجع'), val: `-${risk.maxDrawdown}%`, color: 'var(--color-red)', tip: t('worst peak-to-trough fall', 'أسوأ هبوط من القمة') },
              ].map(m => (
                <div key={m.label} style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{m.label}</div>
                  <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: m.color }}>{m.val}</div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>{m.tip}</div>
                </div>
              ))}
            </div>
          ) : <p className="text-muted" style={{ fontSize: '0.8rem' }}>{t('Not enough overlapping history to compute portfolio risk.', 'لا توجد بيانات كافية لحساب المخاطر.')}</p>}
          <div style={{ marginTop: '12px', padding: '10px', borderRadius: '10px', background: hhi > 0.25 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.06)', border: `1px solid ${hhi > 0.25 ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.2)'}`, fontSize: '0.75rem' }}>
            {hhi > 0.25
              ? <><AlertTriangle size={14} className="text-yellow" /> {t(`Concentrated portfolio (HHI ${hhi}). Top position is ${posAlloc[0]?.pct ?? 0}% of equity — consider trimming.`, `محفظة مركّزة (HHI ${hhi}). أكبر مركز ${posAlloc[0]?.pct ?? 0}٪.`)}</>
              : <><CheckCircle2 size={14} className="text-green" /> {t(`Well diversified (HHI ${hhi}). Cash buffer ${cashPct.toFixed(0)}%.`, `تنويع جيد (HHI ${hhi}). السيولة ${cashPct.toFixed(0)}٪.`)}</>}
          </div>
        </div>

        {/* Allocation pies */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.5rem' }}>
            <PieIcon size={22} className="text-blue" />
            <h3 style={{ margin: 0 }}>{t('Allocation', 'التوزيع')}</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', height: '210px' }}>
            <div>
              <div style={{ textAlign: 'center', fontSize: '0.62rem', color: 'var(--text-muted)' }}>{t('By Position', 'حسب السهم')}</div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={posAlloc} dataKey="value" nameKey="label" innerRadius={32} outerRadius={62} paddingAngle={2} isAnimationActive={false}>
                    {posAlloc.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <RTooltip formatter={(v: any, n: any) => [`${v.toLocaleString()} (${posAlloc.find(s => s.label === n)?.pct}%)`, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div style={{ textAlign: 'center', fontSize: '0.62rem', color: 'var(--text-muted)' }}>{t('By Sector', 'حسب القطاع')}</div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={secAlloc} dataKey="value" nameKey="label" innerRadius={32} outerRadius={62} paddingAngle={2} isAnimationActive={false}>
                    {secAlloc.map((_, i) => <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />)}
                  </Pie>
                  <RTooltip formatter={(v: any, n: any) => [`${v.toLocaleString()} (${secAlloc.find(s => s.label === n)?.pct}%)`, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
            {posAlloc.slice(0, 6).map((s, i) => (
              <span key={s.key} style={{ fontSize: '0.6rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length] }} /> {s.label} {s.pct}%
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Net-worth strip */}
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Wallet size={20} className="text-blue" />
          <div><div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{t('Total Net Worth', 'إجمالي الثروة')}</div>
          <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 800 }}>EGP {totalAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></div>
        </div>
        <div><div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{t('Invested (Equity)', 'مستثمر')}</div><div className="mono" style={{ fontWeight: 700 }}>EGP {equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div></div>
        <div><div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{t('Cash Buffer', 'السيولة')}</div><div className="mono" style={{ fontWeight: 700 }}>{cashPct.toFixed(0)}%</div></div>
        <div><div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{t('Positions', 'المراكز')}</div><div className="mono" style={{ fontWeight: 700 }}>{holdings.length}</div></div>
      </div>
    </div>
  );
}
