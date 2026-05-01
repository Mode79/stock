import React, { useState } from 'react';
import { X, Plus, Minus, DollarSign, Wallet } from 'lucide-react';
import { Transaction, TransactionType, COMPANY_META } from '../types';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (tx: Transaction) => void;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onAddTransaction }) => {
  const [type, setType] = useState<TransactionType>('Buy');
  const [ticker, setTicker] = useState('SWDY');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [fees, setFees] = useState('0');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTx: Transaction = {
      id: crypto.randomUUID(),
      date,
      type,
      ticker: ['Buy', 'Sell', 'Dividend'].includes(type) ? ticker : undefined,
      quantity: ['Buy', 'Sell'].includes(type) ? parseFloat(quantity) : undefined,
      price: parseFloat(price),
      fees: parseFloat(fees) || 0,
    };
    onAddTransaction(newTx);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content card">
        <div className="card-header">
          <h2 className="card-title">Add Transaction</h2>
          <button onClick={onClose} className="icon-btn"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="tx-form">
          <div className="form-group">
            <label>Type</label>
            <div className="type-selector">
              {(['Buy', 'Sell', 'Dividend', 'Deposit', 'Withdraw'] as TransactionType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  className={`type-btn ${type === t ? 'active' : ''}`}
                  onClick={() => setType(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {['Buy', 'Sell', 'Dividend'].includes(type) && (
            <div className="form-group">
              <label>Ticker</label>
              <select value={ticker} onChange={(e) => setTicker(e.target.value)}>
                {Object.keys(COMPANY_META).map(t => (
                  <option key={t} value={t}>{t} - {COMPANY_META[t].company}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid-2">
            {['Buy', 'Sell'].includes(type) && (
              <div className="form-group">
                <label>Quantity</label>
                <input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label>{['Deposit', 'Withdraw', 'Dividend'].includes(type) ? 'Amount' : 'Price per Share'}</label>
              <input
                type="number"
                step="0.0001"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Fees (EGP)</label>
              <input
                type="number"
                step="0.01"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="submit-btn">
            Confirm {type}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
