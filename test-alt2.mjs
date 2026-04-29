// Test various sources
async function tryEGX() {
  // EGX official API
  try {
    const res = await fetch('https://www.egx.com.eg/api/Markets/Security?securityId=ORWE', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    console.log('EGX status:', res.status);
    const text = await res.text();
    console.log('EGX:', text.substring(0, 300));
  } catch (e) {
    console.log('EGX error:', e.message);
  }
}

async function tryMarketWatch() {
  try {
    const res = await fetch('https://api.marketwatch.com/instrument/1.0/EG/stock/ORWE/quote', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    console.log('MarketWatch status:', res.status);
    const text = await res.text();
    console.log('MW:', text.substring(0, 300));
  } catch (e) {
    console.log('MarketWatch error:', e.message);
  }
}

async function tryTradingView() {
  try {
    const body = JSON.stringify({
      symbols: { tickers: ['EGX:ORWE', 'EGX:SWDY', 'EGX:AMOC'], query: { types: [] } },
      columns: ['close', 'change', 'change_abs']
    });
    const res = await fetch('https://scanner.tradingview.com/egypt/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body
    });
    console.log('TradingView status:', res.status);
    const text = await res.text();
    console.log('TV:', text.substring(0, 500));
  } catch (e) {
    console.log('TradingView error:', e.message);
  }
}

async function main() {
  console.log('=== EGX ===');
  await tryEGX();
  console.log('\n=== MarketWatch ===');
  await tryMarketWatch();
  console.log('\n=== TradingView ===');
  await tryTradingView();
}

main();
