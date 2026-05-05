# BoltScan: Institutional EGX Intelligence & Portfolio Suite

BoltScan is a high-performance, professional-grade portfolio management and market intelligence system designed for the Egyptian Stock Exchange (EGX). It bridges the gap between retail trading and institutional analysis using advanced AI, real-time data streaming, and predictive modeling.

## 🚀 System Architecture

BoltScan utilizes a sophisticated multi-tier architecture designed for low-latency data processing and robust persistence.

### 1. Frontend Layer (React 19 & Vite)
- **High-Performance Rendering**: Built with React 19 for reactive UI updates and seamless tab transitions.
- **Institutional Visuals**: Custom CSS architecture focusing on "Glassmorphism" and high-contrast financial data visualization.
- **Persistence Layer**: Dual-sync architecture using **SQLite** for transaction integrity and **localStorage** for UI preferences and persistent benchmarks.
- **Visualization Engine**: Sophisticated charting powered by **Recharts** and the **TradingView Advanced Chart Library**.

### 2. Intelligent Backend (Vite Middleware & SQLite)
- **Database Engine**: Integrated **SQLite** database for enterprise-grade transaction tracking, AI analysis history, and metadata persistence.
- **AI Gateway**: A dual-provider bridge supporting **Google Gemini (Flash 2.0)** and **OpenAI (GPT-4o)** for market forecasting and narrative generation.
- **Proxy Orchestrator**: Handles real-time quote aggregation from Yahoo Finance and TradingView symbols (e.g., COMI.CA, ^EGX30).

### 3. Data Providers & Integrations
- **TradingView**: Powers the "Live Market Intelligence" panel with institutional scanners and technical analysis toolbars.
- **Yahoo Finance API**: Supplies deep historical time-series data for performance benchmarking and P&L reconstruction.
- **Sharia Compliance Engine**: Automated screening for Sharia-compliant symbols based on financial ratios.

---

## 🛠️ Technology Stack

| Category | Technology |
| :--- | :--- |
| **Framework** | React 19 (Latest) |
| **Build Tool** | Vite 8 |
| **Language** | TypeScript |
| **Database** | SQLite (Persistent Backend) |
| **AI Providers** | Google Gemini & OpenAI |
| **Charting** | TradingView Advanced & Recharts |
| **Styling** | Professional Vanilla CSS (Modern Variables) |
| **Icons** | Lucide React |

---

## 🧩 Premium Features

### 🏛️ Institutional Market Intelligence
- **TradingView Advanced Chart**: Full technical analysis suite with 1D/1W/1M/YTD resolutions and institutional toolbars.
- **Real-time EGX30 Benchmarking**: Live tracking of the Egyptian index with high-fidelity fallback proxies.

### 🧠 AI Strategy & Analysis
- **One-Shot Global Analysis**: Batch-processes your entire portfolio and watchlist in a single AI run, updating sentiment, targets, and risks.
- **Multi-Model Support**: Toggle between Gemini and OpenAI models based on analysis needs.
- **Narrative Intelligence**: Generates human-readable strategic advice for every asset.

### 📊 Performance Analytics
- **Unrealized P&L Trend**: High-resolution (1W, 1M, YTD) historical P&L reconstruction since your first purchase.
- **Alpha Tracking**: Dynamic multi-symbol comparison manager that normalizes benchmarks to your portfolio's inception date.

### 🧪 Simulation & Education
- **Simulation Lab**: "What-If" purchase simulator to calculate average-cost improvements before committing capital.
- **Learning Center**: A comprehensive encyclopedia for market terminology, technical indicators, and buy/sell judgment criteria.

---

## ⚙️ Setup & Configuration

1. **Environment Initialization**:
   Create a `.env` file:
   ```env
   VITE_GEMINI_API_KEY=your_key
   VITE_OPENAI_API_KEY=your_key
   ```

2. **Launch Suite**:
   ```bash
   npm install
   npm run dev
   ```

---

## 🔒 Security & Performance
BoltScan is designed with a **privacy-first** mentality. Your financial transactions are stored in your local SQLite database, and API keys are managed through secure environment variables. All performance-heavy calculations (P&L reconstruction and alpha normalization) are optimized for client-side execution.
