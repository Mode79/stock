import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import yahooFinance from 'yahoo-finance2'
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'egx-price-proxy',
      configureServer(server) {
        server.middlewares.use('/api/quote', async (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body);
                const tickers: string[] = parsed.tickers || [];
                if (tickers.length === 0) return res.writeHead(400).end('Missing tickers');

                // --- SOURCE 1: TradingView (Primary Trusted) ---
                const tvTickers = tickers.map((t: string) => `EGX:${t.replace('.CA', '')}`);
                const tvRes = await fetch('https://scanner.tradingview.com/egypt/scan', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ symbols: { tickers: tvTickers, query: { types: [] } }, columns: ['close', 'change', 'change_abs'] })
                });
                const tvData = await tvRes.json();
                const tvMap: Record<string, any> = {};
                if (tvData.data) {
                  tvData.data.forEach((item: any) => {
                    tvMap[item.s.replace('EGX:', '')] = { price: item.d[0], changePercent: item.d[1] };
                  });
                }

                // --- SOURCE 2: Yahoo Finance (Secondary Fallback) ---
                const YahooFinance = (yahooFinance as any).default || yahooFinance;
                const yf = typeof YahooFinance === 'function' ? new YahooFinance({ suppressNotices: ['yahooSurvey'] }) : YahooFinance;
                const quotes = await yf.quote(tickers);
                const quotesArray = Array.isArray(quotes) ? quotes : [quotes];
                const yfMap: Record<string, any> = {};
                quotesArray.forEach((q: any) => {
                  if (q.symbol) yfMap[q.symbol.replace('.CA', '')] = { price: q.regularMarketPrice, changePercent: q.regularMarketChangePercent };
                });

                // --- CONSENSUS ENGINE: Most Trusted Evaluation ---
                const finalResponseMap: Record<string, any> = {};
                
                tickers.forEach((t: string) => {
                  const symbol = t.replace('.CA', '');
                  const tvPrice = tvMap[symbol]?.price;
                  const yfPrice = yfMap[symbol]?.price;
                  
                  console.log(`[Consensus Engine] ${symbol} | TradingView: ${tvPrice} | Yahoo: ${yfPrice}`);

                  // Rule 1: If both exist, check variance. Yahoo is notoriously wrong for EGX.
                  // If difference is > 10%, we reject Yahoo and trust TradingView.
                  if (tvPrice && yfPrice) {
                    const variance = Math.abs(tvPrice - yfPrice) / tvPrice;
                    if (variance > 0.10) {
                      console.warn(`[Consensus Engine] ${symbol}: High variance detected (${(variance*100).toFixed(1)}%). Rejecting Yahoo Finance (stale/wrong). Trusting TradingView.`);
                      finalResponseMap[symbol] = tvMap[symbol];
                    } else {
                      // If within 10%, they agree. Take TradingView as primary.
                      finalResponseMap[symbol] = tvMap[symbol];
                    }
                  } else if (tvPrice) {
                    finalResponseMap[symbol] = tvMap[symbol];
                  } else if (yfPrice) {
                    console.warn(`[Consensus Engine] ${symbol}: TradingView failed. Falling back to Yahoo Finance.`);
                    finalResponseMap[symbol] = yfMap[symbol];
                  }
                });

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(finalResponseMap));
              } catch (e: any) {
                console.error('Consensus Engine error:', e.message);
                res.writeHead(500).end(JSON.stringify({ error: e.message }));
              }
            });
          } else {
            res.writeHead(405).end('Method Not Allowed');
          }
        });
      }
    }
  ],
})
