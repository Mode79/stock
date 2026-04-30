import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import YahooFinanceClass from 'yahoo-finance2'

// Instantiate the engine once
const yf = new (YahooFinanceClass as any)({ suppressNotices: ['yahooSurvey'] });

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'egx-price-proxy',
      configureServer(server) {
        server.middlewares.use('/api', async (req, res, next) => {
          const url = req.url || '';

          // 1. SEARCH ENDPOINT (TradingView)
          if (req.method === 'GET' && url.includes('search')) {
            const queryUrl = new URL(url, `http://${req.headers.host}`);
            const query = queryUrl.searchParams.get('q') || '';
            try {
              const tvRes = await fetch('https://scanner.tradingview.com/egypt/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  filter: [{ left: 'name', operation: 'match', right: query.toUpperCase() }],
                  columns: ['name', 'description'], sort: { sortBy: 'name', sortOrder: 'asc' }, range: [0, 15]
                })
              });
              const tvResDesc = await fetch('https://scanner.tradingview.com/egypt/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  filter: [{ left: 'description', operation: 'match', right: query.toUpperCase() }],
                  columns: ['name', 'description'], sort: { sortBy: 'name', sortOrder: 'asc' }, range: [0, 15]
                })
              });
              const dataName = await tvRes.json();
              const dataDesc = await tvResDesc.json();
              const resultsMap = new Map();
              [...(dataName.data || []), ...(dataDesc.data || [])].forEach((item: any) => {
                const symbol = item.s.replace('EGX:', '');
                if (!resultsMap.has(symbol)) resultsMap.set(symbol, { symbol, name: item.d[1] });
              });
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(Array.from(resultsMap.values()).slice(0, 10)));
              return;
            } catch (e: any) {
              res.writeHead(500).end(JSON.stringify({ error: e.message }));
              return;
            }
          }

          // 2. HISTORY ENDPOINT (Yahoo Finance v3)
          if (req.method === 'GET' && url.includes('history')) {
            const queryUrl = new URL(url, `http://${req.headers.host}`);
            const symbol = (queryUrl.searchParams.get('symbol') || '').toUpperCase();
            const range = queryUrl.searchParams.get('range') || '1m';

            try {
              const intervalMap: Record<string, any> = {
                '1d': '5m', '1w': '15m', '1m': '1d', '3m': '1d', '6m': '1d', 'ytd': '1d', '1y': '1d', '5y': '1wk', 'max': '1mo'
              };
              const periodMap: Record<string, any> = {
                '1d': '1d', '1w': '5d', '1m': '1mo', '3m': '3mo', '6m': '6mo', 'ytd': 'ytd', '1y': '1y', '5y': '5y', 'max': 'max'
              };

              let quotes = [];
              if (range === '1d' || range === '1w') {
                const chartData = await yf.chart(`${symbol}.CA`, {
                  range: periodMap[range],
                  interval: intervalMap[range]
                });
                quotes = chartData.quotes.map((q: any) => ({ date: q.date, close: q.close || q.adjclose }));
              } else {
                const histData = await yf.historical(`${symbol}.CA`, {
                  range: periodMap[range],
                  interval: intervalMap[range]
                });
                quotes = histData.map((q: any) => ({ date: q.date, close: q.close || q.adjclose }));
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(quotes.filter((q: any) => q.close != null)));
              return;
            } catch (e: any) {
              console.error(`[History Error] ${symbol}:`, e.message);
              res.writeHead(500).end(JSON.stringify({ error: e.message }));
              return;
            }
          }

          // 3. QUOTE ENDPOINT
          if (req.method === 'POST' && url.includes('quote')) {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body);
                const tickers: string[] = parsed.tickers || [];
                if (tickers.length === 0) return res.writeHead(400).end('Missing tickers');

                // TradingView Data (Primary)
                const tvTickers = tickers.map((t: string) => `EGX:${t.replace('.CA', '')}`);
                const tvRes = await fetch('https://scanner.tradingview.com/egypt/scan', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ symbols: { tickers: tvTickers, query: { types: [] } }, columns: ['close', 'change', 'change_abs', 'description', 'sector'] })
                });
                const tvData = await tvRes.json();
                const tvMap: Record<string, any> = {};
                if (tvData.data) {
                  tvData.data.forEach((item: any) => {
                    tvMap[item.s.replace('EGX:', '')] = { price: item.d[0], changePercent: item.d[1], name: item.d[3], sector: item.d[4] };
                  });
                }

                // Yahoo Data (Fallback/Meta)
                let yfMap: Record<string, any> = {};
                try {
                  const quotes = await yf.quote(tickers);
                  const quotesArray = Array.isArray(quotes) ? quotes : [quotes];
                  quotesArray.forEach((q: any) => {
                    if (q.symbol) yfMap[q.symbol.replace('.CA', '')] = { price: q.regularMarketPrice, changePercent: q.regularMarketChangePercent, name: q.shortName || q.longName };
                  });
                } catch (e) {}

                const finalResponseMap: Record<string, any> = {};
                tickers.forEach((t: string) => {
                  const symbol = t.replace('.CA', '');
                  const meta = { name: tvMap[symbol]?.name || yfMap[symbol]?.name || symbol, sector: tvMap[symbol]?.sector || 'Other' };
                  finalResponseMap[symbol] = { ...(tvMap[symbol] || yfMap[symbol]), ...meta };
                });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(finalResponseMap));
              } catch (e: any) {
                res.writeHead(500).end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }
          next();
        });
      }
    }
  ],
})
