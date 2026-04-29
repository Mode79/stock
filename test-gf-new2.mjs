const symbol = 'ORWE:CAI';
async function testGoogleFinance() {
  try {
    const res = await fetch(`https://www.google.com/finance/quote/${symbol}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      }
    });
    const html = await res.text();
    // Google Finance usually embeds the price in a class like "YMlKec fxKbKc"
    // Let's search the HTML for any class that has the value "23.00" or similar.
    // ORWE current price is around 23.
    const priceMatches = html.match(/class="[^"]*YMlKec[^"]*">([0-9.,]+)<\/div>/);
    if (priceMatches) {
        console.log("Price found in class:", priceMatches[1]);
    } else {
        const anyDivPrice = html.match(/<div class="[^"]*">([0-9]{2}\.[0-9]{2})<\/div>/g);
        console.log("Potential prices:", anyDivPrice ? anyDivPrice.slice(0, 5) : "none");
    }
  } catch(e) {
    console.error(e);
  }
}
testGoogleFinance();
