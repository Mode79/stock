import { useMemo } from 'react';
import type { Transaction, Holding, PortfolioStats } from '../types';
import { COMPANY_META } from '../types';

export function usePortfolio(transactions: Transaction[], livePrices: Record<string, number>) {
  return useMemo(() => {
    let walletBalance = 0;
    let totalDeposited = 0;
    let totalFeesPaid = 0;
    let realizedPnL = 0;
    let dividendsCollected = 0;

    const holdingsMap: Record<string, { shares: number; totalCost: number }> = {};
    let totalTurnover = 0;

    // Process transactions in chronological order (assuming sorted)
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedTx.forEach(tx => {
      totalFeesPaid += tx.fees || 0;

      switch (tx.type) {
        case 'Deposit':
          walletBalance += (tx.price || 0) - (tx.fees || 0);
          totalDeposited += (tx.price || 0);
          break;
        case 'Withdraw':
          walletBalance -= (tx.price || 0) + (tx.fees || 0);
          break;
        case 'Dividend':
          walletBalance += (tx.price || 0) - (tx.fees || 0);
          dividendsCollected += (tx.price || 0) - (tx.fees || 0);
          break;
        case 'Buy':
          if (tx.ticker && tx.quantity && tx.price) {
            const cost = (tx.quantity * tx.price) + (tx.fees || 0);
            walletBalance -= cost;
            
            if (!holdingsMap[tx.ticker]) holdingsMap[tx.ticker] = { shares: 0, totalCost: 0 };
            holdingsMap[tx.ticker].shares += tx.quantity;
            holdingsMap[tx.ticker].totalCost += cost;
            
            totalTurnover += cost;
          }
          break;
        case 'Sell':
          if (tx.ticker && tx.quantity && tx.price) {
            const revenue = (tx.quantity * tx.price) - (tx.fees || 0);
            walletBalance += revenue;
            
            if (holdingsMap[tx.ticker] && holdingsMap[tx.ticker].shares > 0) {
              const avgCost = holdingsMap[tx.ticker].totalCost / holdingsMap[tx.ticker].shares;
              const soldCost = avgCost * tx.quantity;
              
              // Realized PnL: Revenue - Cost Basis of shares sold
              realizedPnL += (revenue - soldCost);
              
              holdingsMap[tx.ticker].shares -= tx.quantity;
              holdingsMap[tx.ticker].totalCost -= soldCost;
              
              totalTurnover += revenue;
            }
          }
          break;
      }
    });

    // Generate enriched holdings
    const holdings: Holding[] = [];
    let totalInvested = 0;
    let marketValue = 0;

    Object.keys(holdingsMap).forEach(ticker => {
      const { shares, totalCost } = holdingsMap[ticker];
      if (shares > 0) {
        const livePrice = livePrices[ticker] || (totalCost / shares); // fallback to avg cost
        const avgCost = totalCost / shares;
        const meta = COMPANY_META[ticker] || { company: 'Unknown', sector: 'Unknown' };
        
        totalInvested += totalCost;
        marketValue += (shares * livePrice);

        holdings.push({
          ticker,
          shares,
          totalCost,
          avgCost,
          livePrice,
          company: meta.company,
          sector: meta.sector
        });
      }
    });

    const unrealizedPnL = marketValue - totalInvested;

    const stats: PortfolioStats = {
      walletBalance,
      totalDeposited,
      totalFeesPaid,
      realizedPnL,
      unrealizedPnL,
      totalInvested,
      marketValue,
      dividendsCollected
    };

    // Velocity metric (Turnover / Average Capital)
    const holdingsVelocity = totalDeposited > 0 ? (totalTurnover / totalDeposited) * 100 : 0;

    return { holdings, stats, holdingsVelocity };
  }, [transactions, livePrices]);
}
