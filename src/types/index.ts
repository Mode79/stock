export type TransactionType = 'Buy' | 'Sell' | 'Dividend' | 'Deposit' | 'Withdraw';

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  ticker?: string;
  quantity?: number;
  price?: number;
  fees: number;
  broker?: string;
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
  'ABUK': { company: 'Abu Qir Fertilizers & Chemical Industries', sector: 'Chemicals' },
  'AFMC': { company: 'Alexandria Flour Mills', sector: 'Food & Beverage' },
  'ALCN': { company: 'Alexandria Container & Cargo Handling', sector: 'Logistics' },
  'AMOC': { company: 'Alexandria Mineral Oils Company (AMOC)', sector: 'Energy' },
  'AUTO': { company: 'GB Corp (Ghabbour Auto)', sector: 'Automotive' },
  'BINV': { company: 'B Investments Holding', sector: 'Financial Services' },
  'BTFH': { company: 'Belton Financial Holding', sector: 'Financial Services' },
  'CERA': { company: 'Cairo Educational Services', sector: 'Education' },
  'CICH': { company: 'CI Capital Holding', sector: 'Financial Services' },
  'CIDE': { company: 'Chemical Industries Development', sector: 'Chemicals' },
  'CLHO': { company: 'Cleopatra Hospital Group', sector: 'Healthcare' },
  'COMI': { company: 'Commercial International Bank (CIB)', sector: 'Banking' },
  'DAPH': { company: 'Development & Engineering Consultants', sector: 'Real Estate' },
  'DOMT': { company: 'Domty (Arabian Food Industries)', sector: 'Food & Beverage' },
  'EAST': { company: 'Eastern Company', sector: 'Consumer Goods' },
  'EFID': { company: 'Edita Food Industries', sector: 'Food & Beverage' },
  'EGAL': { company: 'Egypt Aluminum', sector: 'Basic Materials' },
  'EGCH': { company: 'Egyptian Chemical Industries (KIMA)', sector: 'Chemicals' },
  'EKHO': { company: 'Egypt Kuwait Holding', sector: 'Financial Services' },
  'ESRS': { company: 'Ezz Steel', sector: 'Basic Materials' },
  'ETEL': { company: 'Telecom Egypt', sector: 'Telecommunications' },
  'FWRY': { company: 'Fawry for Banking & Payment Technology', sector: 'Fintech' },
  'GBOH': { company: 'GB Auto', sector: 'Automotive' },
  'HELI': { company: 'Heliopolis Housing & Development', sector: 'Real Estate' },
  'HRHO': { company: 'EFG Hermes Holding', sector: 'Financial Services' },
  'ISPH': { company: 'Ibnsina Pharma', sector: 'Pharmaceuticals' },
  'JUFO': { company: 'Juhayna Food Industries', sector: 'Food & Beverage' },
  'KABO': { company: 'El Nasr Clothing & Textiles (KABO)', sector: 'Textiles' },
  'MFPC': { company: 'Misr Fertilizers Production Co. (MOPCO)', sector: 'Chemicals' },
  'MICH': { company: 'Misr Chemical Industries', sector: 'Chemicals' },
  'MNHD': { company: 'Madinet Masr for Housing (MNHD)', sector: 'Real Estate' },
  'MOIL': { company: 'Maridive & Oil Services', sector: 'Energy' },
  'MPCI': { company: 'Memphis Pharmaceutical & Chemical', sector: 'Pharmaceuticals' },
  'OCDI': { company: 'SODIC (Sixth of October Development)', sector: 'Real Estate' },
  'OIH': { company: 'Orascom Investment Holding', sector: 'Financial Services' },
  'OLFI': { company: 'Obour Land for Food Industries', sector: 'Food & Beverage' },
  'ORAS': { company: 'Orascom Construction PLC', sector: 'Construction' },
  'ORHD': { company: 'Orascom Development Egypt', sector: 'Real Estate' },
  'ORWE': { company: 'Oriental Weavers Carpet', sector: 'Textiles' },
  'PHDC': { company: 'Palm Hills Developments', sector: 'Real Estate' },
  'POUL': { company: 'Cairo Poultry Co.', sector: 'Food & Beverage' },
  'PRMH': { company: 'Prime Holding', sector: 'Financial Services' },
  'RAYA': { company: 'Raya Holding for Financial Investments', sector: 'Financial Services' },
  'RMDA': { company: 'Tenth of Ramadan Pharma (Rameda)', sector: 'Pharmaceuticals' },
  'SKPC': { company: 'Sidi Kerir Petrochemicals', sector: 'Chemicals' },
  'SNFC': { company: 'Sharkia National Food', sector: 'Food & Beverage' },
  'SUGR': { company: 'Delta Sugar Company', sector: 'Food & Beverage' },
  'SWDY': { company: 'El Sewedy Electric Company', sector: 'Electrical' },
  'TAQA': { company: 'Taqa Arabia', sector: 'Energy' },
  'TMGH': { company: 'Talaat Moustafa Group Holding', sector: 'Real Estate' },
  'VALO': { company: 'Valu', sector: 'Financial Services' }
};
