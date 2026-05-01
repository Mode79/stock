# Thunder Pro: EGX Intelligence Portfolio Tracker

Thunder Pro is a high-performance, real-time portfolio management system specifically designed for the Egyptian Stock Exchange (EGX). It combines institutional-grade market data with Google Gemini AI to provide deep insights, automated technical analysis, and transaction tracking.

## 🚀 System Architecture

The application follows a modern, decoupled architecture with a lightweight proxy layer to bridge client-side interactions with external financial and AI services.

### 1. Frontend Layer (React & Vite)
- **Single Page Application (SPA)** built with React 19 and TypeScript.
- **Reactive State Management**: Handles real-time portfolio recalculations and live price streaming.
- **Persistence**: Transactions are persisted locally using `localStorage` for privacy and offline access.
- **Visualization**: Powered by `Recharts` for sophisticated technical analysis charts (Area, Bar, and Pie charts).

### 2. Integration Layer (Vite Dev Proxy)
The system uses a custom middleware integrated directly into the Vite development server to handle API orchestration and security:
- **Quote Aggregator**: Merges data from TradingView and Yahoo Finance to ensure maximum ticker coverage for EGX stocks.
- **AI Gateway**: Bridges the frontend with the Google Gemini 3 Flash model, handling prompt engineering and response standardization.
- **Historical Engine**: Fetches and formats technical time-series data for the charting engine.

### 3. External Data Providers
- **TradingView**: Primary source for real-time EGX scanner data and sector classification.
- **Yahoo Finance**: Secondary source for historical price data and asset metadata.
- **Google Gemini API**: Generative AI engine used for neural-based market forecasting.

---

## 🛠️ Technology Stack

| Category | Technology |
| :--- | :--- |
| **Framework** | [React 19](https://react.dev/) |
| **Build Tool** | [Vite 8](https://vitejs.dev/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | Vanilla CSS (Modern CSS Variables & Grid) |
| **Charts** | [Recharts](https://recharts.org/) |
| **Icons** | [Lucide React](https://lucide.dev/) |
| **AI Engine** | Google Gemini 3 Flash Preview |
| **Market Data** | TradingView & Yahoo Finance |

---

## 🧩 Core Components

### 📈 Portfolio Dashboard
The central hub for financial overview. It calculates:
- **Equity**: Total market value of current holdings.
- **Unrealized P&L**: Profit/Loss based on live prices vs. average cost.
- **Wallet**: Available cash balance updated by deposits, withdrawals, and dividends.

### 🧠 AI Intelligence Reports
The standout feature that generates deep neural analysis for any holding. It provides:
- **Directional Sentiment**: (e.g., Aggressive Bullish, Neutral).
- **Target Price Forecasting**: 3-month outlook powered by Gemini.
- **Automated Technicals**: RSI (Relative Strength Index) and SMA50 (50-Day Moving Average) calculation.
- **Actionable Narratives**: 3-4 sentences of institutional-grade strategic advice.

### 🕒 Transaction Engine
A robust system for recording financial history:
- Support for **Buy, Sell, Deposit, Withdraw,** and **Dividend** events.
- Automatic cost-basis adjustment (Weighted Average Cost).
- Smart ticker search with real-time EGX suggestions.

### 📊 Advanced Charting
Interactive modals that display:
- **Multi-range timeframes**: (1D, 1W, 1M, 3M, 1Y, 5Y).
- **Dynamic Gradients**: Visual P&L indicators based on price movement.
- **Real-time Tooltips**: Precision data points for price action analysis.

---

## ⚙️ Setup & Installation

1. **Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   VITE_GEMINI_API_KEY=your_google_ai_key_here
   ```

2. **Run Development Server**:
   ```bash
   npm install
   npm run dev
   ```

3. **Production Build**:
   ```bash
   npm run build
   ```

---

## 🔒 Security & Privacy
Thunder Pro is designed as a **Client-First** application. Your transaction history and portfolio data never leave your browser, except when being passed through the secure proxy for AI analysis. All data remains stored in your local browser environment.
