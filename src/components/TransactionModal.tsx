import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { Transaction, TransactionType } from '../types';
import { COMPANY_META } from '../types';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (tx: Transaction) => void;
}

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onAddTransaction }) => {
  const [type, setType] = useState<TransactionType>('Buy');
  const isStockDividend = type === 'StockDividend';
  const [ticker, setTicker] = useState('SWDY');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [broker, setBroker] = useState('Thunder');
  const [fees, setFees] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTx: Transaction = {
      id: crypto.randomUUID(),
      date,
      type,
      ticker: ['Buy', 'Sell', 'Dividend', 'StockDividend'].includes(type) ? ticker : undefined,
      quantity: ['Buy', 'Sell', 'StockDividend'].includes(type) ? parseFloat(quantity) || 0 : undefined,
      price: isStockDividend ? 0 : (parseFloat(price) || 0),
      broker,
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
              {(['Buy', 'Sell', 'Dividend', 'StockDividend', 'Deposit', 'Withdraw'] as TransactionType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  className={`type-btn ${type === t ? 'active' : ''}`}
                  onClick={() => setType(t)}
                >
                  {t === 'StockDividend' ? 'Stock Div' : t}
                </button>
              ))}
            </div>
          </div>

          {['Buy', 'Sell', 'Dividend', 'StockDividend'].includes(type) && (
            <div className="form-group">
              <label>Ticker</label>
              <select value={ticker} onChange={(e) => setTicker(e.target.value)}>
                {Object.keys(COMPANY_META).sort().map(t => (
                  <option key={t} value={t}>{t} - {COMPANY_META[t].company}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid-2">
            {['Buy', 'Sell', 'StockDividend'].includes(type) && (
              <div className="form-group">
                <label>{isStockDividend ? 'Shares Received' : 'Quantity'}</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={quantity}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label>{isStockDividend ? 'Price per Share (0 if free)' : ['Deposit', 'Withdraw', 'Dividend'].includes(type) ? 'Amount' : 'Price per Share'}</label>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={price}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Broker Name</label>
              <select value={broker} onChange={(e) => setBroker(e.target.value)}>
                <option value="Thunder">Thunder</option>
                <option value="Telda">Telda</option>
              </select>
            </div>
            <div className="form-group">
              <label>Fees (EGP)</label>
              <input
                type="number"
                step="any"
                placeholder="0"
                value={fees}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setFees(e.target.value)}
              />
            </div>
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

          <button type="submit" className="submit-btn">
            Confirm {type}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
