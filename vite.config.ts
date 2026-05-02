import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import YahooFinanceClass from 'yahoo-finance2'

const yf = new (YahooFinanceClass as any)({ suppressNotices: ['yahooSurvey'] });

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const GEMINI_KEY_ENV = env.VITE_GEMINI_API_KEY || '';
  const OPENAI_KEY_ENV = env.VITE_OPENAI_API_KEY || '';

  async function callAI(provider: string, model: string, key: string, prompt: string) {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key || OPENAI_KEY_ENV}`
        },
        body: JSON.stringify({
          model: model || 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return data.choices[0].message.content;
    } else {
      // Gemini
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.5-flash'}:generateContent?key=${key || GEMINI_KEY_ENV}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    }
  }
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
                    columns: ['name', 'description', 'logoid'], sort: { sortBy: 'name', sortOrder: 'asc' }, range: [0, 15]
                  })
                });
                const tvResDesc = await fetch('https://scanner.tradingview.com/egypt/scan', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    filter: [{ left: 'description', operation: 'match', right: query.toUpperCase() }],
                    columns: ['name', 'description', 'logoid'], sort: { sortBy: 'name', sortOrder: 'asc' }, range: [0, 15]
                  })
                });
                const dataName = await tvRes.json();
                const dataDesc = await tvResDesc.json();
                const resultsMap = new Map();
                [...(dataName.data || []), ...(dataDesc.data || [])].forEach((item: any) => {
                  const symbol = item.s.replace('EGX:', '');
                  if (!resultsMap.has(symbol)) resultsMap.set(symbol, { symbol, name: item.d[1], logoid: item.d[2] });
                });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(Array.from(resultsMap.values()).slice(0, 10)));
                return;
              } catch (e: any) {
                res.writeHead(500).end(JSON.stringify({ error: e.message }));
                return;
              }
            }

            // 2. AI ANALYZE ENDPOINT
            if (req.method === 'POST' && url.includes('ai-analyze')) {
              let body = '';
              req.on('data', chunk => body += chunk.toString());
              req.on('end', async () => {
                try {
                  const { ticker, company, history, stats } = JSON.parse(body);
                  const provider = req.headers['x-ai-provider'] as string || 'gemini';
                  const model = req.headers['x-ai-model'] as string;
                  const key = req.headers['x-ai-key'] as string;

                  const prompt = `Act as a Senior Institutional Portfolio Manager specializing in the Egyptian Stock Exchange (EGX). 
                  Analyze the following data for ${company} (${ticker}):
                  - Current Price: EGP ${stats?.currentPrice || 'N/A'}
                  - RSI (14): ${stats?.rsi || 'N/A'}
                  - 50-Day Moving Average: EGP ${stats?.sma50 || 'N/A'}
                  - 6-Month High/Low: ${stats?.resistance || 'N/A'} / ${stats?.support || 'N/A'}
                  - Last 10 days Close Prices: ${(history || []).slice(-10).map((h:any) => h.close).join(', ')}

                  Provide a professional, directional, and highly insightful analysis in BOTH English and Arabic.
                  Format your response as a valid JSON object with these keys: "sentiment", "sentiment_ar", "recommendation", "recommendation_ar", "narrative", "narrative_ar", "targetPrice". 
                  Return ONLY the JSON. No markdown.`;

                  let aiText = await callAI(provider, model, key, prompt);
                  
                  if (aiText.includes('```')) {
                    const match = aiText.match(/```json\s*([\s\S]*?)\s*```/) || aiText.match(/```\s*([\s\S]*?)\s*```/);
                    if (match) aiText = match[1];
                    else aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
                  }

                  const parsed = JSON.parse(aiText);
                  const standardized = {
                    sentiment: parsed.sentiment || parsed.Sentiment || 'NEUTRAL',
                    sentiment_ar: parsed.sentiment_ar || 'حيادي',
                    recommendation: parsed.recommendation || parsed.Recommendation || 'HOLD',
                    recommendation_ar: parsed.recommendation_ar || 'انتظار',
                    narrative: parsed.narrative || parsed.Narrative || parsed.strategy || parsed.Strategy || parsed.deepNarrative || 'Analysis generation failed.',
                    narrative_ar: parsed.narrative_ar || 'فشل توليد التحليل باللغة العربية.',
                    targetPrice: parsed.targetPrice || parsed.TargetPrice || (stats?.currentPrice || 0) * 1.1
                  };
                  
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(standardized));
                } catch (e: any) {
                  console.error('[Proxy AI Analyze error]:', e.message);
                  res.writeHead(500).end(JSON.stringify({ error: e.message }));
                }
              });
              return;
            }

            // 2b. BATCH AI ANALYZE
            if (req.method === 'POST' && url.includes('ai-analyze-batch')) {
              let body = '';
              req.on('data', chunk => body += chunk.toString());
              req.on('end', async () => {
                try {
                  const { stocks } = JSON.parse(body);
                  const provider = req.headers['x-ai-provider'] as string || 'gemini';
                  const model = req.headers['x-ai-model'] as string;
                  const key = req.headers['x-ai-key'] as string;

                  const prompt = `Act as a Senior Institutional Portfolio Manager for EGX. 
                  Analyze the following stocks and provide professional insights for each.
                  DATA:
                  ${(stocks || []).map((s:any) => `
                  STOCKED: ${s?.company} (${s?.ticker})
                  - Price: EGP ${s?.stats?.currentPrice || 'N/A'}
                  - RSI: ${s?.stats?.rsi || 'N/A'}
                  - SMA50: ${s?.stats?.sma50 || 'N/A'}
                  - Support/Resistance: ${s?.stats?.support || 'N/A'} / ${s?.stats?.resistance || 'N/A'}
                  - Recent Close: ${(s?.history || []).map((h:any)=>h.close).join(', ')}
                  `).join('\n')}

                  Format the output as a SINGLE JSON object where keys are EXACTLY the ticker symbols and values are objects with:
                  "sentiment", "sentiment_ar", "recommendation", "recommendation_ar", "targetPrice".
                  Return ONLY the JSON. No markdown.`;

                  let aiText = await callAI(provider, model, key, prompt);
                  
                  if (aiText.includes('```')) {
                    const match = aiText.match(/```json\s*([\s\S]*?)\s*```/) || aiText.match(/```\s*([\s\S]*?)\s*```/);
                    if (match) aiText = match[1];
                    else aiText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
                  }
                  
                  res.setHeader('Content-Type', 'application/json');
                  res.end(aiText.trim());
                } catch (e: any) {
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
                    body: JSON.stringify({ symbols: { tickers: tvTickers, query: { types: [] } }, columns: ['close', 'change', 'change_abs', 'description', 'sector', 'logoid'] })
                  });
                  const tvData = await tvRes.json();
                  const tvMap: Record<string, any> = {};
                  if (tvData.data) {
                    tvData.data.forEach((item: any) => {
                      tvMap[item.s.replace('EGX:', '')] = { price: item.d[0], changePercent: item.d[1], name: item.d[3], sector: item.d[4], logoid: item.d[5] };
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
                    const meta = { 
                      name: tvMap[symbol]?.name || yfMap[symbol]?.name || symbol, 
                      sector: tvMap[symbol]?.sector || 'Other',
                      logoid: tvMap[symbol]?.logoid || null
                    };
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
