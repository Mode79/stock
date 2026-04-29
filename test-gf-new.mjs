const symbol = 'ORWE:CAI';
async function testGoogleFinance() {
  try {
    const res = await fetch(`https://www.google.com/finance/quote/${symbol}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const html = await res.text();
    // Look for <div class="YMlKec fxKbKc">23.00</div> or similar.
    // The exact class might change, but it usually comes right after the currency symbol or is the main price.
    // Let's just output a chunk of HTML where ORWE is mentioned or where EGP is mentioned.
    const priceMatch = html.match(/class="YMlKec fxKbKc">([^<]+)<\/div>/);
    if (priceMatch) {
      console.log(`Found Price via YMlKec fxKbKc: ${priceMatch[1]}`);
    } else {
      console.log("Regex didn't match. Searching for EGP...");
      const egpIndex = html.indexOf('EGP');
      if (egpIndex > -1) {
         console.log("Context around EGP:", html.substring(Math.max(0, egpIndex - 50), egpIndex + 50));
      }
      // Let's also check data-last-price just in case
      const lastPrice = html.match(/data-last-price="([^"]+)"/);
      if (lastPrice) console.log("data-last-price:", lastPrice[1]);
      else console.log("No data-last-price found either.");
    }
  } catch(e) {
    console.error(e);
  }
}
testGoogleFinance();
