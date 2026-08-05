import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import YahooFinanceClass from 'yahoo-finance2'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
// @ts-ignore
import Database from 'better-sqlite3';
import { calculateRecommendation } from './src/utils/recommendationEngine'

// --- DATABASE INITIALIZATION ---
const db = new Database(path.join(process.cwd(), 'portfolio.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    date TEXT,
    type TEXT,
    ticker TEXT,
    quantity REAL,
    price REAL,
    broker TEXT,
    fees REAL
  );
  CREATE TABLE IF NOT EXISTS analytics (
    ticker TEXT PRIMARY KEY,
    data TEXT
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Seed initial data if empty
const txCount = db.prepare('SELECT COUNT(*) as count FROM transactions').get() as { count: number };
if (txCount.count === 0) {
  const seeds = [
    { id: 'dep1', date: '2026-04-01', type: 'Deposit', price: 150000, broker: 'System', fees: 0 },
    { id: 's1', date: '2026-04-28', type: 'Buy', ticker: 'MICH', quantity: 288, price: 35.48, broker: 'Thndr', fees: 17.77 },
    { id: 's2', date: '2026-04-28', type: 'Buy', ticker: 'ORWE', quantity: 448, price: 22.90, broker: 'Thndr', fees: 16.81 },
    { id: 's3', date: '2026-04-28', type: 'Buy', ticker: 'SUGR', quantity: 210, price: 49.49, broker: 'Thndr', fees: 15.99 },
    { id: 's4', date: '2026-04-28', type: 'Buy', ticker: 'MPCI', quantity: 58, price: 172.99, broker: 'Thndr', fees: 15.53 },
    { id: 's5', date: '2026-04-28', type: 'Buy', ticker: 'OLFI', quantity: 458, price: 22.28, broker: 'Thndr', fees: 15.75 },
    { id: 's6', date: '2026-04-28', type: 'Buy', ticker: 'AMOC', quantity: 1261, price: 8.40, broker: 'Thndr', fees: 16.24 },
    { id: 's7', date: '2026-04-28', type: 'Buy', ticker: 'SWDY', quantity: 121, price: 87.00, broker: 'Thndr', fees: 16.16 },
    { id: 's8', date: '2026-05-03', type: 'Buy', ticker: 'OLFI', quantity: 362, price: 22.15, broker: 'Telda', fees: 4.00 },
    { id: 's9', date: '2026-05-03', type: 'Buy', ticker: 'MPCI', quantity: 46, price: 172.41, broker: 'Telda', fees: 2.98 },
    { id: 's10', date: '2026-05-03', type: 'Buy', ticker: 'MICH', quantity: 228, price: 35.80, broker: 'Telda', fees: 3.05 },
    { id: 's11', date: '2026-05-03', type: 'Buy', ticker: 'SUGR', quantity: 163, price: 48.90, broker: 'Telda', fees: 3.00 },
    { id: 's12', date: '2026-05-03', type: 'Buy', ticker: 'ORWE', quantity: 400, price: 23.10, broker: 'Telda', fees: 3.30 },
    { id: 's13', date: '2026-05-03', type: 'Buy', ticker: 'SWDY', quantity: 98, price: 87.50, broker: 'Telda', fees: 4.15 },
    { id: 's14', date: '2026-05-03', type: 'Buy', ticker: 'AMOC', quantity: 1155, price: 8.66, broker: 'Telda', fees: 5.50 },
  ];
  const insert = db.prepare('INSERT INTO transactions (id, date, type, ticker, quantity, price, broker, fees) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  seeds.forEach(s => insert.run(s.id, s.date, s.type, s.ticker || null, s.quantity || null, s.price, s.broker, s.fees));
}

const yf = new (YahooFinanceClass as any)({ suppressNotices: ['yahooSurvey'] });

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const GEMINI_KEY_ENV = env.VITE_GEMINI_API_KEY || '';
  const OPENAI_KEY_ENV = env.VITE_OPENAI_API_KEY || '';

  function logAIInteraction(trigger: string, provider: string, model: string, prompt: string, response: string) {
    const timestamp = new Date().toLocaleString();
    const logEntry = `
=========================================
TIMESTAMP: ${timestamp}
TRIGGER: ${trigger}
PROVIDER: ${provider}
MODEL: ${model}
-----------------------------------------
PROMPT:
${prompt}
-----------------------------------------
RESPONSE:
${response}
=========================================
`;
    fs.appendFileSync(path.join(process.cwd(), 'ai_interactions.log'), logEntry, 'utf8');
  }

  async function callAI(provider: string, model: string, key: string, prompt: string, retryCount = 0): Promise<string> {
    try {
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
        const data: any = await res.json();
        if (data.error) {
          if (data.error.code === 'insufficient_quota' || data.error.code === 'rate_limit_exceeded') {
             if (retryCount < 1) {
               console.log(`[AI Proxy] Quota hit on ${provider}. Retrying in 2s...`);
               await new Promise(r => setTimeout(r, 2000));
               return callAI(provider, model, key, prompt, retryCount + 1);
             }
          }
          throw new Error(data.error.message);
        }
        return data.choices[0].message.content;
      } else {
        // Gemini
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${key || GEMINI_KEY_ENV}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: "application/json" }
          })
        });
        const data: any = await res.json();
        if (data.error) {
          if (data.error.status === 'RESOURCE_EXHAUSTED' || data.error.code === 429) {
             if (retryCount < 2) {
               console.log(`[AI Proxy] Quota hit on Gemini. Retrying in 3s...`);
               await new Promise(r => setTimeout(r, 3000));
               return callAI(provider, model, key, prompt, retryCount + 1);
             }
          }
          console.error(`[AI Error - ${provider}]`, data.error);
          throw new Error(data.error.message || JSON.stringify(data.error));
        }
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      }
    } catch (e: any) {
      if (retryCount < 1) {
        await new Promise(r => setTimeout(r, 1000));
        return callAI(provider, model, key, prompt, retryCount + 1);
      }
      throw e;
    }
  }

  function cleanJSON(text: string) {
    let clean = text.trim();
    if (clean.includes('```')) {
      const match = clean.match(/```json\s*([\s\S]*?)\s*```/) || clean.match(/```\s*([\s\S]*?)\s*```/);
      if (match) clean = match[1];
      else clean = clean.replace(/```json/g, '').replace(/```/g, '');
    }
    return clean.trim();
  }

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
                const dataName: any = await tvRes.json();
                const dataDesc: any = await tvResDesc.json();
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

            // 1b. FUNDAMENTALS ENDPOINT (real EGX ratios from TradingView scanner)
            if (req.method === 'GET' && url.includes('fundamentals')) {
              const queryUrl = new URL(url, `http://${req.headers.host}`);
              const symbols = (queryUrl.searchParams.get('symbols') || '')
                .split(',').map(s => s.trim().toUpperCase().replace('EGX:', '').split('.')[0]).filter(Boolean);
              if (symbols.length === 0) { res.setHeader('Content-Type', 'application/json'); res.end('{}'); return; }
              try {
                // Column order MUST match parseFundamentals() in src/utils/fundamentals.ts
                const columns = ['name', 'close', 'price_earnings_ttm', 'return_on_equity',
                  'debt_to_equity', 'earnings_per_share_basic_ttm', 'market_cap_basic', 'dividends_yield', 'sector'];
                const tvRes = await fetch('https://scanner.tradingview.com/egypt/scan', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ symbols: { tickers: symbols.map(s => `EGX:${s}`), query: { types: [] } }, columns })
                });
                const tvData: any = await tvRes.json();
                const out: Record<string, any[]> = {};
                (tvData.data || []).forEach((item: any) => {
                  const sym = item.s.replace('EGX:', '');
                  out[sym] = item.d;
                });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(out));
                return;
              } catch (e: any) {
                res.writeHead(500).end(JSON.stringify({ error: e.message }));
                return;
              }
            }

            // 2. AI ANALYZE ENDPOINT
            if (req.method === 'POST' && (url === '/ai-analyze' || url === '/api/ai-analyze')) {
              let body = '';
              req.on('data', chunk => body += chunk.toString());
              req.on('end', async () => {
                try {
                  const { ticker = 'Unknown', company = 'Unknown', history = [], stats = {} } = JSON.parse(body);
                  const provider = req.headers['x-ai-provider'] as string || 'gemini';
                  let model = req.headers['x-ai-model'] as string;
                  const key = req.headers['x-ai-key'] as string;
                  const isLoggingEnabled = req.headers['x-ai-logging'] === 'true';

                  // Safety: Prevent using GPT model name with Gemini provider and vice versa
                  if (provider === 'gemini' && (!model || !model.includes('gemini'))) model = 'gemini-2.0-flash';
                  if (provider === 'openai' && (!model || !model.includes('gpt'))) model = 'gpt-4o';

                  console.log(`[AI Proxy] Single Analysis | Provider: ${provider} | Model: ${model} | Ticker: ${ticker}`);

                  // Programmatically calculate the recommendation, sentiment, and target price
                  const recResult = calculateRecommendation(stats as any);

                  const prompt = `Act as a senior financial analyst (CFA-level) and an educator for a non-expert investor.
Analyze stock: ${ticker} (${company})

OBJECTIVE:
Provide a full-spectrum stock analysis in SIMPLE LANGUAGE for a NON-EXPERT.

Current Data:
- Price: EGP ${stats?.currentPrice || 'N/A'}
- RSI: ${stats?.rsi || 'N/A'}
- SMA50: ${stats?.sma50 || 'N/A'}
- Support/Resistance: ${stats?.support || 'N/A'} / ${stats?.resistance || 'N/A'}
- Recent Prices: ${(history || []).slice(-10).map((h:any) => h.close).join(', ')}

Programmatic Rating Determined by Rules:
- Recommendation: ${recResult.recommendation} (${recResult.recommendation_ar})
- Sentiment: ${recResult.sentiment} (${recResult.sentiment_ar})
- Target Price: EGP ${recResult.targetPrice}

Structure your response following these sections:
1. COMPANY SNAPSHOT (Overview of business — qualitative only)
2. DECISION DASHBOARD (Restate the rating & quick decision aligning with the recommendation)
3. VALUATION (Explain the programmatic target price and the bull/bear cases in plain terms)
4. TECHNICAL ANALYSIS (Explain what the provided RSI, SMA50, support/resistance imply)
5. RISK ANALYSIS (Market & technical red flags derived ONLY from the data above)
6. FINAL RECOMMENDATION (Aligning with the calculated recommendation and entry/exit zones)

RULES:
- Use ONLY the numbers provided above. Do NOT invent or estimate financial figures.
- CRITICAL: You were given NO fundamental data (no earnings, P/E, ROE, debt). Do NOT state, guess, or imply any such figures. If you mention fundamentals at all, say they require separate review. Fabricating ratios is strictly forbidden.
- Explain terms in simple language.
- You MUST output exactly the calculated recommendation, recommendation_ar, sentiment, sentiment_ar, and targetPrice fields inside the JSON.
- RETURN THE FINAL OUTPUT AS A VALID JSON OBJECT WITH THESE KEYS: 
  "sentiment", "sentiment_ar", 
  "recommendation", "recommendation_ar", 
  "narrative", "narrative_ar", 
  "targetPrice",
  "key_metrics" (array of strings), 
  "risks" (array of strings), 
  "catalysts" (array of strings).
  
Return ONLY the JSON. No markdown outside the JSON.`;

                  if (isLoggingEnabled) logAIInteraction(`Single Analysis: ${ticker} [REQUEST]`, provider, model || 'default', prompt, 'WAITING...');
                  
                  try {
                    const rawAiText = await callAI(provider, model, key, prompt);
                    const aiText = cleanJSON(rawAiText);
                    
                    if (isLoggingEnabled) {
                      logAIInteraction(`Single Analysis: ${ticker} [RESPONSE]`, provider, model || 'default', 'See request above', aiText);
                    }

                    const parsed = JSON.parse(aiText);
                    // Override with programmatically calculated values to guarantee correctness
                    const standardized = {
                      sentiment: recResult.sentiment,
                      sentiment_ar: recResult.sentiment_ar,
                      recommendation: recResult.recommendation,
                      recommendation_ar: recResult.recommendation_ar,
                      targetPrice: recResult.targetPrice,
                      narrative: parsed.narrative || parsed.Narrative || parsed.strategy || parsed.Strategy || parsed.deepNarrative || 'Analysis generation failed.',
                      narrative_ar: parsed.narrative_ar || 'فشل توليد التحليل باللغة العربية.',
                      key_metrics: Array.isArray(parsed.key_metrics) ? parsed.key_metrics : (typeof parsed.key_metrics === 'object' && parsed.key_metrics !== null ? Object.entries(parsed.key_metrics).map(([k,v]) => `${k}: ${v}`) : []),
                      risks: Array.isArray(parsed.risks) ? parsed.risks : (typeof parsed.risks === 'object' && parsed.risks !== null ? Object.values(parsed.risks) : []),
                      catalysts: Array.isArray(parsed.catalysts) ? parsed.catalysts : (typeof parsed.catalysts === 'object' && parsed.catalysts !== null ? Object.values(parsed.catalysts) : [])
                    };
                    
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(standardized));
                  } catch (err: any) {
                    const errorMsg = err.message || 'Internal AI Proxy Error';
                    console.error('--- AI PROXY CRITICAL ERROR ---', errorMsg);
                    
                    if (isLoggingEnabled) {
                      logAIInteraction(`Single Analysis: ${ticker} [CRITICAL ERROR]`, provider, model || 'default', 'See request above', errorMsg);
                    }
                    
                    // Fallback to purely programmatic output if AI fails entirely
                    const fallbackResult = {
                      sentiment: recResult.sentiment,
                      sentiment_ar: recResult.sentiment_ar,
                      recommendation: recResult.recommendation,
                      recommendation_ar: recResult.recommendation_ar,
                      targetPrice: recResult.targetPrice,
                      narrative: `Technical indicators calculation completed. The stock is currently rated ${recResult.recommendation} with a programmatic target price of EGP ${recResult.targetPrice} based on RSI ${stats.rsi} and SMA50 ${stats.sma50}.`,
                      narrative_ar: `اكتمل حساب المؤشرات الفنية. السهم مصنف حالياً ${recResult.recommendation_ar} مع سعر مستهدف برامجي EGP ${recResult.targetPrice} بناءً على مؤشر القوة النسبية RSI ${stats.rsi} ومتوسط 50 يوم SMA50 ${stats.sma50}.`,
                      key_metrics: [`RSI: ${stats.rsi}`, `SMA50: ${stats.sma50}`, `Support: ${stats.support}`, `Resistance: ${stats.resistance}`],
                      risks: ['AI narrative generation failed. Relying on fallback technical metrics only.'],
                      catalysts: ['Review support floor levels for entry, and resistance for exit.']
                    };
                    
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(fallbackResult));
                  }
                } catch (e: any) {
                  console.error('[Proxy AI Analyze error]:', e.message);
                  res.writeHead(500).end(JSON.stringify({ error: e.message }));
                }
              });
              return;
            }

            // 2b. BATCH AI ANALYZE
            if (req.method === 'POST' && (url === '/ai-analyze-batch' || url === '/api/ai-analyze-batch')) {
              let body = '';
              req.on('data', chunk => body += chunk.toString());
              req.on('end', async () => {
                try {
                  const { stocks } = JSON.parse(body);
                  const provider = req.headers['x-ai-provider'] as string || 'gemini';
                  let model = req.headers['x-ai-model'] as string;
                  const key = req.headers['x-ai-key'] as string;
                  const isLoggingEnabled = req.headers['x-ai-logging'] === 'true';

                  if (provider === 'gemini' && (!model || !model.includes('gemini'))) model = 'gemini-2.0-flash';
                  if (provider === 'openai' && (!model || !model.includes('gpt'))) model = 'gpt-4o';

                  console.log(`[AI Proxy] Batch Analysis | Provider: ${provider} | Model: ${model} | Count: ${stocks?.length}`);

                  // Pre-calculate programmatic recommendations for all stocks
                  const precalculated = (stocks || []).map((s: any) => {
                    const rec = calculateRecommendation(s.stats);
                    return { s, rec };
                  });

                  const prompt = `Act as a Senior Financial Analyst with CFA-level expertise.
                   Perform a rigorous portfolio-wide analysis for the following stocks:
                   
                   DATA:
                   ${precalculated.map(({ s, rec }: { s: any; rec: any }) => `
                   STOCK: ${s?.company} (${s?.ticker})
                   - Price: EGP ${s?.stats?.currentPrice || 'N/A'}
                   - RSI: ${s?.stats?.rsi || 'N/A'}
                   - SMA50: ${s?.stats?.sma50 || 'N/A'}
                   - Support/Resistance: ${s?.stats?.support || 'N/A'} / ${s?.stats?.resistance || 'N/A'}
                   - Recent Close: ${(s?.history || []).map((h:any)=>h.close).join(', ')}
                   - Programmatic Rating: ${rec.recommendation} (${rec.recommendation_ar})
                   - Programmatic Sentiment: ${rec.sentiment} (${rec.sentiment_ar})
                   - Programmatic Target Price: EGP ${rec.targetPrice}
                   `).join('\n')}

                   For each stock, write a concise plain-language note following this structure:
                   1. Company Snapshot & Business Model (qualitative only)
                   2. Decision Dashboard (restate rating & confidence aligning with programmatic rating)
                   3. Valuation (explain the programmatic target price)
                   4. Technical Trend & Sentiment (interpret the provided RSI / SMA50 / support / resistance)
                   5. Risks & Red Flags (derived ONLY from the data above)

                   Format the output as a SINGLE JSON object where keys are EXACTLY the ticker symbols and values are objects with:
                   "sentiment", "sentiment_ar", "recommendation", "recommendation_ar", "targetPrice", "narrative", "narrative_ar", "key_metrics" (array of strings).

                   RULES:
                   - You MUST output exactly the programmatic recommendation, recommendation_ar, sentiment, sentiment_ar, and targetPrice for each stock in the returned JSON object.
                   - CRITICAL: No fundamental data (earnings, P/E, ROE, debt) was provided. Do NOT invent, estimate, or imply any such figures — base every statement strictly on the technical numbers given.
                   - Return ONLY the JSON. No markdown tags.`;

                   if (isLoggingEnabled) logAIInteraction(`Batch Analysis (${stocks?.length || 0} stocks) [REQUEST]`, provider, model || 'default', prompt, 'WAITING...');
                   
                   try {
                     const rawAiText = await callAI(provider, model, key, prompt);
                     const aiText = cleanJSON(rawAiText);

                     if (isLoggingEnabled) {
                       logAIInteraction(`Batch Analysis (${stocks?.length || 0} stocks) [RESPONSE]`, provider, model || 'default', 'See request above', aiText);
                     }
                     
                     let parsed: Record<string, any> = {};
                     try {
                       parsed = JSON.parse(aiText);
                     } catch (e) {
                       console.error('Failed to parse batch AI text, using fallback:', e);
                     }

                     const finalResults: Record<string, any> = {};
                     precalculated.forEach(({ s, rec }: { s: any; rec: any }) => {
                       const cleanTicker = s.ticker.toUpperCase().split('.')[0].replace('EGX:', '').trim();
                       const aiKey = Object.keys(parsed).find(k => {
                         const cleanK = k.toUpperCase().split('.')[0].replace('EGX:', '').trim();
                         return cleanK === cleanTicker || s.ticker.toUpperCase() === k.toUpperCase();
                       });

                       const aiData = aiKey ? parsed[aiKey] : {};
                       finalResults[s.ticker] = {
                         sentiment: rec.sentiment,
                         sentiment_ar: rec.sentiment_ar,
                         recommendation: rec.recommendation,
                         recommendation_ar: rec.recommendation_ar,
                         targetPrice: rec.targetPrice,
                         narrative: aiData.narrative || aiData.Narrative || `Technical indicators analysis completed. The stock is rated ${rec.recommendation} with a programmatic target price of EGP ${rec.targetPrice}.`,
                         narrative_ar: aiData.narrative_ar || aiData.Narrative_ar || `اكتمل تحليل المؤشرات الفنية. السهم مصنف ${rec.recommendation_ar} مع سعر مستهدف برامجي EGP ${rec.targetPrice}.`,
                         key_metrics: aiData.key_metrics || aiData.Key_metrics || [`RSI: ${s.stats?.rsi || 'N/A'}`, `SMA50: ${s.stats?.sma50 || 'N/A'}`],
                         risks: aiData.risks || aiData.Risks || ['AI narrative generation failed. Relying on programmatic parameters.'],
                         catalysts: aiData.catalysts || aiData.Catalysts || ['Review support floor levels.']
                       };
                     });

                     res.setHeader('Content-Type', 'application/json');
                     res.end(JSON.stringify(finalResults));
                   } catch (e: any) {
                     const errorMsg = e.message || 'Unknown Batch AI Error';
                     if (isLoggingEnabled) logAIInteraction(`Batch Analysis [ERROR]`, provider, model || 'default', 'See request above', errorMsg);
                     
                     // Fallback to purely programmatic output for all stocks on error
                     const fallbackResults: Record<string, any> = {};
                     precalculated.forEach(({ s, rec }: { s: any; rec: any }) => {
                       fallbackResults[s.ticker] = {
                         sentiment: rec.sentiment,
                         sentiment_ar: rec.sentiment_ar,
                         recommendation: rec.recommendation,
                         recommendation_ar: rec.recommendation_ar,
                         targetPrice: rec.targetPrice,
                         narrative: `Technical indicators analysis completed. Rated ${rec.recommendation} with a programmatic target price of EGP ${rec.targetPrice} based on RSI ${s.stats?.rsi || 'N/A'} and SMA50 ${s.stats?.sma50 || 'N/A'}.`,
                         narrative_ar: `اكتمل تحليل المؤشرات الفنية. السهم مصنف ${rec.recommendation_ar} مع سعر مستهدف برامجي EGP ${rec.targetPrice} بناءً على مؤشر RSI ${s.stats?.rsi || 'N/A'} ومتوسط SMA50 ${s.stats?.sma50 || 'N/A'}.`,
                         key_metrics: [`RSI: ${s.stats?.rsi || 'N/A'}`, `SMA50: ${s.stats?.sma50 || 'N/A'}`, `Support: ${s.stats?.support || 'N/A'}`, `Resistance: ${s.stats?.resistance || 'N/A'}`],
                         risks: ['AI batch analysis endpoint errored. Using fallback technical parameters only.'],
                         catalysts: ['Review support levels for entry, and resistance for exit.']
                       };
                     });

                     res.setHeader('Content-Type', 'application/json');
                     res.end(JSON.stringify(fallbackResults));
                   }
                } catch (e: any) {
                  res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: e.message || 'Malformed Request' }));
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
                // Forex pairs (e.g. USDEGP=X) and indices/symbols with a dot must NOT get the .CA suffix.
                const fullSymbol = (symbol.startsWith('^') || symbol.includes('.') || symbol.includes('=')) ? symbol : `${symbol}.CA`;
                if (range === '1d' || range === '1w') {
                  try {
                    const chartData = await yf.chart(fullSymbol, { range: range === '1d' ? '1d' : '5d', interval: range === '1d' ? '2m' : '15m' });
                    let details = { sector: 'Other', industry: 'Other' };
                    try {
                      // Fetch full quote for more details if needed
                      const quote = await yf.quote(fullSymbol);
                      details = {
                        sector: (quote as any).sector || (quote as any).category || 'Other',
                        industry: (quote as any).industry || 'Other'
                      };
                    } catch (qErr) {
                      console.warn(`[Proxy] Metadata fetch failed for ${fullSymbol}, continuing...`);
                    }
                    quotes = chartData.quotes.map((q: any) => ({ 
                      date: q.date, 
                      open: q.open,
                      high: q.high,
                      low: q.low,
                      close: q.close || q.adjclose,
                      volume: q.volume,
                      ...details
                    }));
                  } catch (chartErr) {
                    const period1 = new Date();
                    period1.setDate(period1.getDate() - (range === '1d' ? 1 : 7));
                    const histData = await yf.historical(fullSymbol, { period1, period2: new Date(), interval: '1d' });
                    quotes = histData.map((q: any) => ({ 
                      date: q.date, 
                      open: q.open,
                      high: q.high,
                      low: q.low,
                      close: q.close || q.adjclose,
                      volume: q.volume
                    }));
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

                  try {
                    // Forex pairs return null gaps via historical(); chart() is reliable for them.
                    if (fullSymbol.includes('=')) {
                      const chartData = await yf.chart(fullSymbol, { period1, period2: now, interval: '1d' });
                      quotes = (chartData.quotes || [])
                        .filter((q: any) => q && (q.close != null || q.adjclose != null))
                        .map((q: any) => ({ date: q.date, open: q.open, high: q.high, low: q.low, close: q.close || q.adjclose, volume: q.volume || 0 }));
                    } else {
                      const histData = await yf.historical(fullSymbol, { period1, period2: now, interval: (range === '5y' || range === 'max') ? '1mo' : '1d' });
                      quotes = histData.map((q: any) => ({
                        date: q.date,
                        open: q.open,
                        high: q.high,
                        low: q.low,
                        close: q.close || q.adjclose,
                        volume: q.volume
                      }));
                    }
                  } catch (hErr: any) {
                    // Fallback for EGX30 index if primary ticker fails
                    if (fullSymbol === '^CASE30' || fullSymbol === '^EGX30' || fullSymbol === 'CASE.CA' || fullSymbol === 'EGX30.CA') {
                      console.log(`[Proxy] Index fetch failed (${fullSymbol}), trying robust fallbacks...`);
                      const fallbacks = ['COMI.CA', '^CASE30', '^EGX30', 'CASE.CA', 'EGX30.CA', 'CASE', 'EGX30'];
                      for (const fb of fallbacks) {
                        try {
                          console.log(`[Proxy] Trying fallback: ${fb}`);
                          // Try chart() first as it's more reliable for indices on some Yahoo servers
                          const fbData = await yf.chart(fb, { period1: period1, interval: '1d' });
                          if (fbData && fbData.quotes && fbData.quotes.length > 5) {
                            quotes = fbData.quotes.map((q: any) => ({ 
                              date: q.date, 
                              open: q.open,
                              high: q.high,
                              low: q.low,
                              close: q.close || q.adjclose,
                              volume: q.volume
                            }));
                            console.log(`[Proxy] Success with ${fb} (chart) - ${quotes.length} points`);
                            break;
                          }
                        } catch (e) {
                          try {
                            const fbData = await yf.historical(fb, { period1: period1, period2: now, interval: '1d' });
                            if (fbData && fbData.length > 5) {
                              quotes = fbData.map((q: any) => ({ 
                                date: q.date, 
                                open: q.open,
                                high: q.high,
                                low: q.low,
                                close: q.close || q.adjclose,
                                volume: q.volume
                              }));
                              console.log(`[Proxy] Success with ${fb} (historical) - ${quotes.length} points`);
                              break;
                            }
                          } catch (e2) {
                            continue;
                          }
                        }
                      }
                      if (quotes.length === 0) throw new Error(`All index fallbacks failed: ${hErr.message}`);
                    } else {
                      throw hErr;
                    }
                  }
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
                  const tickers: string[] = (parsed.tickers || []).map((t: string) => t.trim().toUpperCase());
                  if (tickers.length === 0) return res.writeHead(400).end('Missing tickers');
                  console.log(`[AI Proxy] Fetching quotes for: ${tickers.join(', ')}`);
                  const tvTickers = tickers.map((t: string) => `EGX:${t.replace('.CA', '')}`);
                  const tvRes = await fetch('https://scanner.tradingview.com/egypt/scan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbols: { tickers: tvTickers, query: { types: [] } }, columns: ['close', 'change', 'change_abs', 'description', 'sector', 'logoid'] })
                  });
                  const tvData: any = await tvRes.json();
                  console.log(`[AI Proxy] TradingView Response: ${tvData.data?.length || 0} symbols found`);
                  
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
                    console.log(`[AI Proxy] Yahoo Finance Response: ${quotesArray.length} symbols found`);
                    quotesArray.forEach((q: any) => {
                      if (q.symbol) yfMap[q.symbol.replace('.CA', '')] = { price: q.regularMarketPrice, changePercent: q.regularMarketChangePercent, name: q.shortName || q.longName };
                    });
                  } catch (e: any) {
                    console.error('[AI Proxy] Yahoo Finance Error:', e.message);
                  }
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
                  console.log(`[AI Proxy] Final Response Map: ${Object.keys(finalResponseMap).join(', ')}`);
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(finalResponseMap));
                } catch (e: any) {
                  res.writeHead(500).end(JSON.stringify({ error: e.message }));
                }
              });
              return;
            }

            // 5. OPEN LOGS ENDPOINT
            if (req.method === 'GET' && url.includes('open-logs')) {
              const logPath = path.join(process.cwd(), 'ai_interactions.log');
              if (!fs.existsSync(logPath)) {
                fs.writeFileSync(logPath, `AI Interaction Log Initiated at ${new Date().toLocaleString()}\nNo interactions recorded yet.\n`, 'utf8');
              }
              exec(`start "" "${logPath}"`, (err) => {
                if (err) res.writeHead(500).end('Could not open file');
                else res.end('Opened');
              });
              return;
            }

            // 6. DATABASE ENDPOINTS
            if (url.startsWith('/db/') || url.startsWith('/api/db/')) {
              const dbUrl = url.replace('/api/db/', '/db/').replace('/db/', '');
              
              if (req.method === 'GET') {
                const endpoint = dbUrl.split('?')[0];
                if (endpoint === 'ai/models') {
                    const parsedUrl = new URL(url, `http://${req.headers.host}`);
                    const provider = parsedUrl.searchParams.get('provider');
                    const keyFromHeader = req.headers['x-ai-key'] as string;
                    
                    if (provider === 'gemini') {
                      const apiKey = keyFromHeader || GEMINI_KEY_ENV;
                      if (!apiKey) {
                        res.end(JSON.stringify([]));
                        return;
                      }
                      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                      const data: any = await response.json();
                      res.end(JSON.stringify(data.models || []));
                    } else if (provider === 'openai') {
                      const apiKey = keyFromHeader || OPENAI_KEY_ENV;
                      if (!apiKey) {
                        res.end(JSON.stringify([]));
                        return;
                      }
                      const response = await fetch('https://api.openai.com/v1/models', {
                        headers: { 'Authorization': `Bearer ${apiKey}` }
                      });
                      const data: any = await response.json();
                      res.end(JSON.stringify(data.data || []));
                    }
                    return;
                }

                if (dbUrl === 'init') {
                  const transactions = db.prepare('SELECT * FROM transactions').all();
                  const analyticsRaw = db.prepare('SELECT * FROM analytics').all() as any[];
                  const settingsRaw = db.prepare('SELECT * FROM settings').all() as any[];
                  
                  const analytics: Record<string, any> = {};
                  analyticsRaw.forEach(r => analytics[r.ticker] = JSON.parse(r.data));
                  
                  const settings: Record<string, any> = {};
                  settingsRaw.forEach(r => settings[r.key] = JSON.parse(r.value));
                  
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ transactions, analytics, settings }));
                  return;
                }
              }

              if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => body += chunk.toString());
                req.on('end', () => {
                  try {
                    const data = JSON.parse(body);
                    if (dbUrl === 'transactions') {
                      const { id, date, type, ticker, quantity, price, broker, fees } = data;
                      db.prepare('INSERT OR REPLACE INTO transactions (id, date, type, ticker, quantity, price, broker, fees) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                        .run(id, date, type, ticker || null, quantity || null, price, broker || 'Thndr', fees || 0);
                      res.end('Saved');
                    } else if (dbUrl === 'settings') {
                      Object.entries(data).forEach(([key, value]) => {
                        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
                          .run(key, JSON.stringify(value));
                      });
                      res.end('Saved');
                    } else if (dbUrl === 'analytics') {
                      Object.entries(data).forEach(([ticker, val]) => {
                        db.prepare('INSERT OR REPLACE INTO analytics (ticker, data) VALUES (?, ?)')
                          .run(ticker, JSON.stringify(val));
                      });
                      res.end('Saved');
                    } else {
                      res.writeHead(404).end();
                    }
                  } catch (e: any) {
                    res.writeHead(500).end(e.message);
                  }
                });
                return;
              }

              if (req.method === 'DELETE' && dbUrl.startsWith('transactions/')) {
                const id = dbUrl.split('/')[1];
                db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
                res.end('Deleted');
                return;
              }

              if (req.method === 'POST' && dbUrl === 'reset') {
                db.prepare('DELETE FROM transactions').run();
                db.prepare('DELETE FROM analytics').run();
                db.prepare('DELETE FROM settings').run();
                res.end('Reset');
                return;
              }
            }

            next();
          });
        }
      }
    ],
  };
});
