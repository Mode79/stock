import type { RecommendationResult } from './recommendationEngine';

export interface ActionInput {
  ticker: string;
  company: string;
  rec: RecommendationResult;
  weightPct: number;     // position as % of book
  livePrice: number;
  pnlPct: number;        // unrealized P&L %
}

export interface ActionItem {
  ticker: string;
  company: string;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  rank: number;
  action: string;
  action_ar: string;
  reason: string;
  reason_ar: string;
  color: string;
}

const URG = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
const COL = { CRITICAL: 'var(--color-red)', HIGH: '#f97316', MEDIUM: 'var(--color-yellow)', LOW: 'var(--color-blue)' };

// One decisive action per holding, chosen by the most urgent triggered rule,
// then the whole list is ranked so the user always sees what matters first.
export function buildActions(inputs: ActionInput[], concentrationLimit = 25): ActionItem[] {
  const items: ActionItem[] = [];

  for (const it of inputs) {
    const { ticker, company, rec, weightPct, livePrice, pnlPct } = it;
    let pick: Omit<ActionItem, 'ticker' | 'company' | 'rank'> | null = null;

    // 1. Stop-loss breached — most urgent, protect capital.
    if (rec.stopLoss > 0 && livePrice <= rec.stopLoss) {
      pick = { urgency: 'CRITICAL', color: COL.CRITICAL,
        action: `Exit — stop breached`, action_ar: 'خروج — كسر وقف الخسارة',
        reason: `Price ${livePrice} is at/below the stop ${rec.stopLoss}. The thesis has failed; cut the loss.`,
        reason_ar: `السعر ${livePrice} عند أو دون وقف الخسارة ${rec.stopLoss}. فشلت الفكرة؛ أوقف الخسارة.` };
    }
    // 2. Engine says SELL.
    else if (rec.recommendation === 'SELL') {
      pick = { urgency: 'HIGH', color: COL.HIGH,
        action: `Reduce / Exit (${weightPct.toFixed(0)}% of book)`, action_ar: `تقليل / خروج (${weightPct.toFixed(0)}٪ من المحفظة)`,
        reason: `Composite ${rec.compositeScore} is bearish. ${pnlPct >= 0 ? 'Lock in the gain' : 'Limit further downside'}.`,
        reason_ar: `النتيجة المركبة ${rec.compositeScore} هابطة. ${pnlPct >= 0 ? 'ثبّت الربح' : 'حدّ من الخسارة'}.` };
    }
    // 3. At/above base target — harvest.
    else if (rec.targets?.base > 0 && livePrice >= rec.targets.base) {
      pick = { urgency: 'HIGH', color: COL.HIGH,
        action: `Take partial profit — at target`, action_ar: 'جني ربح جزئي — بلغ الهدف',
        reason: `Price ${livePrice} reached the base target ${rec.targets.base}. Trim and let the rest run to ${rec.targets.bull}.`,
        reason_ar: `السعر ${livePrice} بلغ الهدف ${rec.targets.base}. جنِّ جزءاً ودع الباقي نحو ${rec.targets.bull}.` };
    }
    // 4. Over-concentrated.
    else if (weightPct > concentrationLimit) {
      pick = { urgency: 'HIGH', color: COL.HIGH,
        action: `Trim — ${weightPct.toFixed(0)}% concentration`, action_ar: `تقليل — تركّز ${weightPct.toFixed(0)}٪`,
        reason: `This single position is ${weightPct.toFixed(0)}% of your book (limit ${concentrationLimit}%). Rebalance to cut single-stock risk.`,
        reason_ar: `هذا المركز يمثل ${weightPct.toFixed(0)}٪ من المحفظة (الحد ${concentrationLimit}٪). أعد التوازن.` };
    }
    // 5. Strong buy setup.
    else if (rec.recommendation === 'BUY') {
      pick = { urgency: 'MEDIUM', color: COL.MEDIUM,
        action: `Add — strong setup`, action_ar: 'إضافة — إشارة قوية',
        reason: `BUY, ${rec.conviction}% conviction, ${rec.dataConfidence} trust. Entry ${rec.entryZone.low}–${rec.entryZone.high}, target ${rec.targets.base}.`,
        reason_ar: `شراء، ثقة ${rec.conviction}٪. الدخول ${rec.entryZone.low}–${rec.entryZone.high}، الهدف ${rec.targets.base}.` };
    }
    // 6. Accumulate gradually.
    else if (rec.recommendation === 'ACCUMULATE') {
      pick = { urgency: 'LOW', color: COL.LOW,
        action: `Accumulate on dips`, action_ar: 'تجميع عند التراجع',
        reason: `Mildly bullish (composite ${rec.compositeScore}). Build gradually near ${rec.entryZone.low}–${rec.entryZone.high}.`,
        reason_ar: `صعود معتدل. تجميع تدريجي قرب ${rec.entryZone.low}–${rec.entryZone.high}.` };
    }
    // HOLD with no other trigger → no action item (intentionally quiet).

    if (pick) items.push({ ticker, company, rank: URG[pick.urgency], ...pick });
  }

  return items.sort((a, b) => a.rank - b.rank || b.ticker.localeCompare(a.ticker));
}
