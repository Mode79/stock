// Test Mubasher API for EGX prices
const tickers = ['ORWE', 'SWDY', 'AMOC', 'MICH', 'MPCI', 'OLFI', 'SUGR'];

async function testMubasher() {
  // Try Mubasher API endpoint
  for (const ticker of tickers) {
    try {
      const url = `https://api.mubasher.info/1.0/equity/quote?codes=${ticker}.EGX&lang=en&country=EG`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const data = await res.json();
      if (data && data.rows && data.rows.length > 0) {
        const q = data.rows[0];
        console.log(`${ticker}: price=${q.lastTradedPrice}, change=${q.change}, changePct=${q.changePercent}`);
      } else {
        console.log(`${ticker}: no data from mubasher`, JSON.stringify(data).substring(0, 200));
      }
    } catch (e) {
      console.log(`${ticker}: error`, e.message);
    }
  }
}

// Also try investing.com API
async function testInvesting() {
  try {
    const res = await fetch('https://api.investing.com/api/financialdata/8988/historical/chart/?period=P1D&interval=PT1M&pointscount=60', {
      headers: { 
        'User-Agent': 'Mozilla/5.0',
        'domain-id': 'www.investing.com'
      }
    });
    console.log('Investing status:', res.status);
    const text = await res.text();
    console.log('Investing response:', text.substring(0, 300));
  } catch (e) {
    console.log('Investing error:', e.message);
  }
}

async function main() {
  console.log('=== Testing Mubasher ===');
  await testMubasher();
  console.log('\n=== Testing Investing.com ===');
  await testInvesting();
}

main();
