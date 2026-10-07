import requests
import json
import os

GEMINI_KEY = os.environ.get("VITE_GEMINI_API_KEY", "")

STOCKS = [
    {"ticker": "SWDY", "company": "El Sewedy Electric", "stats": {"currentPrice": 87.0, "rsi": "80.5"}},
    {"ticker": "AMOC", "company": "Alexandria Mineral Oils Co.", "stats": {"currentPrice": 8.6, "rsi": "58.4"}}
]

PROMPT = f"Analyze these stocks and return JSON: {json.dumps(STOCKS)}"

def test_gemini_15():
    print("Testing Gemini 1.5 Flash...")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_KEY}"
    payload = {
        "contents": [{"parts": [{"text": PROMPT}]}],
        "generationConfig": {"response_mime_type": "application/json"}
    }
    res = requests.post(url, json=payload)
    print(f"Status: {res.status_code}")
    print(res.text)

if __name__ == "__main__":
    test_gemini_15()
