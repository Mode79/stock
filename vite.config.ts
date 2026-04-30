import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import YahooFinanceClass from 'yahoo-finance2'

const yf = new (YahooFinanceClass as any)({ suppressNotices: ['yahooSurvey'] });

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const GEMINI_KEY = env.VITE_GEMINI_API_KEY || '';

  return {
    plugins: [
      react(),
      {
        name: 'egx-price-proxy',
        configureServer(server) {
          server.middlewares.use('/api', async (req, res, next) => {
            const url = req.url || '';

            // 1. SEARCH ENDPOINT
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

            // 2. AI ANALYZE ENDPOINT (Google Gemini Integration)
            if (req.method === 'POST' && url.includes('ai-analyze')) {
              let body = '';
              req.on('data', chunk => body += chunk.toString());
              req.on('end', async () => {
                try {
                  const { ticker, company, history, stats } = JSON.parse(body);
                  
                  if (!GEMINI_KEY) {
                    throw new Error('Gemini API Key missing in .env');
                  }

                  const prompt = `Act as a Senior Institutional Portfolio Manager specializing in the Egyptian Stock Exchange (EGX). 
                  Analyze the following data for ${company} (${ticker}):
                  - Current Price: EGP ${stats.currentPrice}
                  - RSI (14): ${stats.rsi}
                  - 50-Day Moving Average: EGP ${stats.sma50}
                  - 6-Month High/Low: ${stats.resistance} / ${stats.support}
                  - Last 10 days Close Prices: ${history.slice(-10).map((h:any) => h.close).join(', ')}

                  Provide a professional, directional, and highly insightful analysis. 
                  Include:
                  1. A "Sentiment" (e.g., Aggressive Bullish, Neutral, Bearish).
                  2. A "Strategic Recommendation" (Buy/Sell/Hold/Accumulate).
                  3. A "Deep Narrative" (3-4 sentences) explaining the internal/external situation and market structure.
                  4. A "Target Price" for the next 3 months.

                  IMPORTANT: Format your response as a valid JSON object with these keys: "sentiment", "recommendation", "narrative", "targetPrice". 
                  Do not include any markdown formatting or extra text outside the JSON.`;

                  const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{ parts: [{ text: prompt }] }],
                      generationConfig: { response_mime_type: "application/json" }
                    })
                  });

                  const geminiData = await geminiRes.json();
                  const aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
                  
                  res.setHeader('Content-Type', 'application/json');
                  res.end(aiText);
                } catch (e: any) {
                  console.error('AI Analyze error:', e.message);
                  res.writeHead(500).end(JSON.stringify({ error: e.message }));
                }
              });
              return;
            }

            // 3. HISTORY ENDPOINT
            if (req.method === 'GET' && url.includes('history')) {
              const queryUrl = new URL(url, `http://${req.headers.host}`);
              const symbol = (queryUrl.searchParams.get('symbol') || '').toUpperCase();
              const range = queryUrl.searchParams.get('range') || '1m';

              try {
                let quotes = [];
                if (range === '1d' || range === '1w') {
                  try {
                    const chartData = await yf.chart(`${symbol}.CA`, { range: range === '1d' ? '1d' : '5d', interval: range === '1d' ? '2m' : '15m' });
                    quotes = chartData.quotes.map((q: any) => ({ date: q.date, close: q.close || q.adjclose }));
                  } catch (chartErr) {
                    const period1 = new Date();
                    period1.setDate(period1.getDate() - (range === '1d' ? 1 : 7));
                    const histData = await yf.historical(`${symbol}.CA`, { period1, period2: new Date(), interval: '1d' });
                    quotes = histData.map((q: any) => ({ date: q.date, close: q.close || q.adjclose }));
                  }
                } else {
                  const now = new Date();
                  let period1 = new Date();
                  if (range === '1m') period1.setMonth(now.getMonth() - 1);
                  else if (range === '3m') period1.setMonth(now.getMonth() - 3);
                  else if (range === '6m') period1.setMonth(now.getMonth() - 6);
                  else if (range === 'ytd') period1 = new Date(now.getFullYear(), 0, 1);
                  else if (range === '1y') period1.setFullYear(now.getFullYear() - 1);
                  else if (range === '5y') period1.setFullYear(now.getFullYear() - 5);
                  else period1 = new Date(1970, 0, 1);

                  const histData = await yf.historical(`${symbol}.CA`, { period1, period2: now, interval: (range === '5y' || range === 'max') ? '1mo' : '1d' });
                  quotes = histData.map((q: any) => ({ date: q.date, close: q.close || q.adjclose }));
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(quotes.filter((q: any) => q.close != null)));
                return;
              } catch (e: any) {
                res.writeHead(500).end(JSON.stringify({ error: e.message }));
                return;
              }
            }

            // 4. QUOTE ENDPOINT
            if (req.method === 'POST' && url.includes('quote')) {
              let body = '';
              req.on('data', chunk => body += chunk.toString());
              req.on('end', async () => {
                try {
                  const parsed = JSON.parse(body);
                  const tickers: string[] = parsed.tickers || [];
                  if (tickers.length === 0) return res.writeHead(400).end('Missing tickers');
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
  };
});
