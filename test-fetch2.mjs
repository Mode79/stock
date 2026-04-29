fetch('http://localhost:5173/api/quote', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tickers: ['ORWE.CA', 'SUGR.CA', 'MICH.CA', 'MPCI.CA', 'OLFI.CA', 'AMOC.CA', 'SWDY.CA'] })
}).then(async r => {
  console.log("Status:", r.status);
  console.log("Text:", await r.text());
}).catch(console.error);
