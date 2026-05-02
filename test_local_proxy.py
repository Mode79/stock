import requests
import json

def test_local_proxy():
    url = "http://localhost:5173/api/ai-analyze-batch"
    
    # Mock data similar to what the frontend sends
    payload = {
        "stocks": [
            {
                "ticker": "AMOC",
                "company": "Alexandria Mineral Oils Co.",
                "history": [{"close": 8.4}, {"close": 8.5}, {"close": 8.6}],
                "stats": {"currentPrice": 8.6, "rsi": "58.4", "sma50": "8.5", "resistance": "9.0", "support": "8.0"}
            },
            {
                "ticker": "SWDY",
                "company": "El Sewedy Electric",
                "history": [{"close": 85}, {"close": 86}, {"close": 87}],
                "stats": {"currentPrice": 87.0, "rsi": "80.5", "sma50": "82.0", "resistance": "90.0", "support": "80.0"}
            }
        ]
    }
    
    print(f"Sending request to {url}...")
    try:
        response = requests.post(url, json=payload, timeout=60)
        print(f"Status Code: {response.status_code}")
        print("Response Content:")
        print(response.text)
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_local_proxy()
