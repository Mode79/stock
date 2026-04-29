import { YahooFinance } from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

async function test() {
  try {
    const result = await yahooFinance.quote('SWDY.CA');
    console.log(result.regularMarketPrice);
  } catch (err) {
    console.error(err);
  }
}

test();
