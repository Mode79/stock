import React from 'react';
import { Transaction } from '../types';
import { ArrowUpRight, ArrowDownRight, DollarSign, Wallet, Trash2 } from 'lucide-react';

interface LedgerProps {
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
}

const Ledger: React.FC<LedgerProps> = ({ transactions, onDeleteTransaction }) => {
  const sortedTx = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getIcon = (type: string) => {
    switch (type) {
      case 'Buy': return <ArrowDownRight className="text-red" />;
      case 'Sell': return <ArrowUpRight className="text-green" />;
      case 'Dividend': return <DollarSign className="text-blue" />;
      case 'Deposit': return <Wallet className="text-green" />;
      case 'Withdraw': return <Wallet className="text-red" />;
      default: return null;
    }
  };

  return (
    <div className="card ledger-card">
      <div className="card-header">
        <h2 className="card-title">Transaction History</h2>
      </div>
      <div className="table-container">
        <table className="portfolio-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Ticker</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Fees</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedTx.map(tx => {
              const total = (tx.quantity || 0) * (tx.price || 0) + (tx.type === 'Buy' ? tx.fees : -tx.fees);
              const displayTotal = ['Deposit', 'Withdraw', 'Dividend'].includes(tx.type) ? tx.price : total;

              return (
                <tr key={tx.id}>
                  <td className="text-dim">{tx.date}</td>
                  <td>
                    <div className="flex-center gap-2">
                      {getIcon(tx.type)}
                      <span className="font-bold">{tx.type}</span>
                    </div>
                  </td>
                  <td className="font-mono">{tx.ticker || '-'}</td>
                  <td className="font-mono">{tx.quantity?.toLocaleString() || '-'}</td>
                  <td className="font-mono">{tx.price?.toFixed(4)}</td>
                  <td className="font-mono text-dim">{tx.fees.toFixed(2)}</td>
                  <td className={`font-mono font-bold ${tx.type === 'Buy' || tx.type === 'Withdraw' ? 'text-red' : 'text-green'}`}>
                    {displayTotal?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    <button 
                      onClick={() => onDeleteTransaction(tx.id)}
                      className="icon-btn text-dim hover:text-red transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Ledger;
