fetch('http://localhost:5173/api/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tickers: ['ORWE.CA'] })
}).then(r => r.text()).then(console.log).catch(console.error);
