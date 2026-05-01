export type TransactionType = 'Buy' | 'Sell' | 'Dividend' | 'Deposit' | 'Withdraw';

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  ticker?: string;
  quantity?: number;
  price?: number;
  fees: number;
}

export interface Holding {
  ticker: string;
  shares: number;
  avgCost: number;
  totalCost: number;
  livePrice: number;
  company: string;
  sector: string;
}

export interface PortfolioStats {
  realizedPnL: number;
  unrealizedPnL: number;
  totalInvested: number;
  marketValue: number;
  walletBalance: number;
  totalDeposited: number;
  totalFeesPaid: number;
  dividendsCollected: number;
}

// Meta info about companies
export const COMPANY_META: Record<string, { company: string, sector: string }> = {
  'SWDY': { company: 'Elsewedy Electric', sector: 'Electrical' },
  'AMOC': { company: 'Alexandria Mineral Oils', sector: 'Energy/Oils' },
  'OLFI': { company: 'Obour Land for Food', sector: 'Food' },
  'MPCI': { company: 'Memphis Pharmaceuticals', sector: 'Pharma' },
  'MICH': { company: 'Misr Chemical Industries', sector: 'Chemicals' },
  'SUGR': { company: 'Delta Sugar', sector: 'Food/Sugar' },
  'ORWE': { company: 'Oriental Weavers', sector: 'Textiles' }
};
