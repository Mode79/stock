const { YahooFinance } = require('yahoo-finance2');
const yahooFinance = new YahooFinance();
async function test() {
  try {
    const result = await yahooFinance.quote('SWDY.CA');
    console.log("PRICE:", result.regularMarketPrice);
  } catch(e) {
    console.error(e);
  }
}
test();
