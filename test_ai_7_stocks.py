import os
import requests
import json

def test_gemini_7_stocks():
    # Load API Key
    with open('.env', 'r') as f:
        for line in f:
            if 'VITE_GEMINI_API_KEY' in line:
                key = line.split('=')[1].strip()
                break
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"
    
    stocks = [
        {"ticker": "SWDY", "company": "El Sewedy Electric", "stats": {"currentPrice": 87.0, "rsi": 80.5, "sma50": 82.0}},
        {"ticker": "AMOC", "company": "Alexandria Mineral Oils Co.", "stats": {"currentPrice": 8.6, "rsi": 58.4, "sma50": 8.5}},
        {"ticker": "OLFI", "company": "Obour Land", "stats": {"currentPrice": 22.07, "rsi": 70.8, "sma50": 21.5}},
        {"ticker": "MPCI", "company": "Memphis Pharm", "stats": {"currentPrice": 171.71, "rsi": 64.6, "sma50": 168.0}},
        {"ticker": "MICH", "company": "Misr Chemical", "stats": {"currentPrice": 35.44, "rsi": 53.5, "sma50": 34.0}},
        {"ticker": "SUGR", "company": "Delta Sugar", "stats": {"currentPrice": 49.01, "rsi": 71.5, "sma50": 48.0}},
        {"ticker": "ORWE", "company": "Oriental Weavers", "stats": {"currentPrice": 22.95, "rsi": 63.6, "sma50": 22.0}}
    ]
    
    prompt = f"""Act as a Senior Institutional Portfolio Manager for EGX. 
    Analyze the following stocks and provide professional insights for each.
    
    DATA:
    {json.dumps(stocks, indent=2)}

    For EACH stock, provide:
    - "sentiment" (English and Arabic)
    - "recommendation" (English and Arabic)
    - "targetPrice" (next 3 months)

    Format the output as a SINGLE JSON object where keys are EXACTLY the ticker symbols and values are objects with:
    "sentiment", "sentiment_ar", "recommendation", "recommendation_ar", "targetPrice".
    Return ONLY the JSON."""
    
    payload = {
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }],
        "generationConfig": {
            "response_mime_type": "application/json"
        }
    }
    
    print(f"Sending batch request to {url}...")
    response = requests.post(url, json=payload)
    
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        res_json = response.json()
        print("AI Response Keys:", list(res_json.keys()))
        print(json.dumps(res_json, indent=2))
    else:
        print("Error response received:")
        print(response.text)

if __name__ == "__main__":
    test_gemini_7_stocks()
