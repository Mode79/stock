import requests
import json
import os

GEMINI_KEY = os.environ.get("VITE_GEMINI_API_KEY", "")
OPENAI_KEY = os.environ.get("VITE_OPENAI_API_KEY", "")

STOCKS = [
    {"ticker": "SWDY", "company": "El Sewedy Electric", "stats": {"currentPrice": 87.0, "rsi": "80.5"}},
    {"ticker": "AMOC", "company": "Alexandria Mineral Oils Co.", "stats": {"currentPrice": 8.6, "rsi": "58.4"}},
    {"ticker": "OLFI", "company": "Obour Land", "stats": {"currentPrice": 22.07, "rsi": "70.8"}},
    {"ticker": "MPCI", "company": "Memphis Pharmaceutical", "stats": {"currentPrice": 171.71, "rsi": "64.6"}},
    {"ticker": "MICH", "company": "Misr Chemical Industries", "stats": {"currentPrice": 35.44, "rsi": "53.5"}},
    {"ticker": "SUGR", "company": "Delta Sugar", "stats": {"currentPrice": 49.01, "rsi": "71.5"}},
    {"ticker": "ORWE", "company": "Oriental Weavers", "stats": {"currentPrice": 22.95, "rsi": "63.6"}}
]

PROMPT = f"""Act as a Senior Institutional Portfolio Manager for EGX. 
Analyze the following stocks and provide professional insights for each.
DATA:
{json.dumps(STOCKS, indent=2)}

Format the output as a SINGLE JSON object where keys are EXACTLY the ticker symbols and values are objects with:
"sentiment", "sentiment_ar", "recommendation", "recommendation_ar", "targetPrice".
Return ONLY the JSON. No markdown."""

def test_gemini():
    print("Testing Gemini...")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}"
    payload = {
        "contents": [{"parts": [{"text": PROMPT}]}],
        "generationConfig": {"response_mime_type": "application/json"}
    }
    res = requests.post(url, json=payload)
    with open("gemini_response.txt", "w", encoding="utf-8") as f:
        f.write(res.text)
    print("Gemini response saved to gemini_response.txt")

def test_openai():
    print("Testing OpenAI...")
    url = "https://api.openai.com/v1/chat/completions"
    headers = {"Authorization": f"Bearer {OPENAI_KEY}", "Content-Type": "application/json"}
    payload = {
        "model": "gpt-4o",
        "messages": [{"role": "user", "content": PROMPT}],
        "response_format": {"type": "json_object"}
    }
    res = requests.post(url, json=payload, headers=headers)
    with open("chatgpt_response.txt", "w", encoding="utf-8") as f:
        f.write(res.text)
    print("ChatGPT response saved to chatgpt_response.txt")

if __name__ == "__main__":
    test_gemini()
    test_openai()
