# Thunder Tracker Pro - EGX Dashboard

A professional, real-time portfolio tracking dashboard designed specifically for traders on the Egyptian Exchange (EGX) using the Thndr brokerage app. It features a premium dark-mode UI, live price synchronization via a Data Consensus Engine, and advanced financial analytics.

## 🚀 Features

*   **Real-Time Live Sync Engine**: Automatically fetches and updates live stock prices every 60 seconds without refreshing the page. Includes a manual "Live Sync" trigger button.
*   **Data Consensus Engine**: A sophisticated Node.js backend proxy that fetches data from multiple APIs simultaneously (TradingView as Primary, Yahoo Finance as Fallback). It calculates price variances and automatically rejects highly inaccurate `.CA` data from Yahoo Finance, ensuring your dashboard always matches Thndr perfectly.
*   **Cash Waterfall Logic**: Tracks Total Deposited, Wallet Balance, Fees Paid, and dynamically calculates Free vs. Reserved Cash based on pending orders.
*   **Precision Portfolio Analytics**: Calculates total invested capital, real-time market value, unrealized P&L in exact EGP, and P&L percentages with 4-decimal precision for exact cost basis matching.
*   **Interactive Visualizations**: Powered by `recharts` to render a Portfolio Allocation Donut Chart, P&L Bar Chart, and Invested vs. Market Value comparisons.
*   **Premium Aesthetic**: Glassmorphism elements, monospace numeric typography for readability, and dynamic red/green color coding.

## 🛠️ Tech Stack

*   **Frontend**: React 18, TypeScript
*   **Build Tool / Backend Proxy**: Vite
*   **Styling**: Vanilla CSS with custom CSS variables (Dark Theme)
*   **Charting**: Recharts
*   **Icons**: Lucide React
*   **APIs**: TradingView Scanner API, Yahoo Finance API (`yahoo-finance2`)

## 🏗️ Project Architecture

```text
/
├── index.html              # Entry point
├── vite.config.ts          # Vite config & Data Consensus Backend Proxy
├── src/
│   ├── main.tsx            # React DOM mounting
│   ├── App.tsx             # Main Dashboard Component & State Management
│   ├── App.css             # Component-specific layout styling
│   └── index.css           # Global design tokens, CSS variables, and typography
```

## 🧠 How the Data Consensus Engine Works

Because the EGX market has historically poor data coverage on standard free APIs, this project uses a custom middleware inside `vite.config.ts`:

1.  **Request**: The React frontend sends a `POST /api/quote` request containing the list of tickers.
2.  **Primary Source (TradingView)**: The proxy formats the tickers to `EGX:TICKER` and queries the TradingView Scanner API, which is highly accurate.
3.  **Secondary Source (Yahoo Finance)**: The proxy simultaneously queries `yahoo-finance2` using the `TICKER.CA` format.
4.  **Evaluation**: The engine compares both prices. If Yahoo Finance's price deviates by more than 10% from TradingView (which happens frequently), it logs a warning and forcefully rejects the Yahoo data.
5.  **Response**: The clean, verified data is sent back to the React app to render the table.

## ⚙️ How to Run

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Start the Development Server**:
    ```bash
    npm run dev
    ```
3.  **View the Dashboard**:
    Open `http://localhost:5173/` in your browser.

## 🎛️ Customizing the Portfolio

To add, remove, or adjust your holdings, open `src/App.tsx` and locate the `INITIAL_HOLDINGS` array:

```javascript
const INITIAL_HOLDINGS = [
  { 
    ticker: 'SWDY', 
    company: 'Elsewedy Electric', 
    sector: 'Electrical', 
    shares: 121, 
    avgCost: 87.1336,       // Average cost including fees (4 decimals)
    totalCost: 10543.16,    // Exact total EGP paid
    livePrice: 87.1336      // Fallback price before first sync
  },
  // ... add new objects here
];
```

You can also update your global financials at the top of `App.tsx`:
*   `WALLET_BALANCE`: Your current free cash.
*   `TOTAL_DEPOSITED`: Total cash transferred to the brokerage.
*   `TOTAL_FEES_PAID`: Lifetime fees paid.
