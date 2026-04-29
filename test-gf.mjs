// Test scraping Google Finance for EGX prices
const tickers = {
  'ORWE': 'ORWE:CAI',
  'SWDY': 'SWDY:CAI',
  'AMOC': 'AMOC:CAI',
  'MICH': 'MICH:CAI',
  'MPCI': 'MPCI:CAI',
  'OLFI': 'OLFI:CAI',
  'SUGR': 'SUGR:CAI'
};

async function fetchPrice(symbol, gfSymbol) {
  try {
    const res = await fetch(`https://www.google.com/finance/quote/${gfSymbol}`);
    const html = await res.text();
    const match = html.match(/data-last-price="([^"]+)"/);
    if (match) {
      console.log(`${symbol}: ${match[1]}`);
    } else {
      console.log(`${symbol}: NOT FOUND`);
    }
  } catch (e) {
    console.error(`${symbol}: ERROR`, e.message);
  }
}

async function main() {
  for (const [sym, gf] of Object.entries(tickers)) {
    await fetchPrice(sym, gf);
  }
}

main();
