import React, { useState } from "react";
import axios from "axios";

function toBoolean(val) {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val.toLowerCase() === "true" || val.toLowerCase() === "yes";
  if (typeof val === "number") return val !== 0;
  return false;
}

function App() {
  const [symbol, setSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setData(null);
    try {
      const response = await axios.post("http://localhost:8000/analyze", {
        symbol: symbol.toUpperCase(),
        amount: parseFloat(amount),
      });
      setData(response.data);
    } catch (err) {
      setError("Something went wrong. Please check your inputs.");
    }
  };

  const direction = data ? data.final_signal?.toUpperCase() : null;

  const calculateConfirmationsPercent = () => {
    if (!data || !data.confirmations) return { longPercent: "-", shortPercent: "-" };

    const keys = Object.keys(data.confirmations).filter(k => k !== "Pivot Support/Resistance");

    let longTrueCount = 0;
    let shortTrueCount = 0;
    let total = keys.length;

    keys.forEach((key) => {
      const buy = toBoolean(data.confirmations[key]?.buy);
      const sell = toBoolean(data.confirmations[key]?.sell);
      if (buy) longTrueCount++;
      if (sell) shortTrueCount++;
    });

    const longPercent = total ? ((longTrueCount / total) * 100).toFixed(1) : "-";
    const shortPercent = total ? ((shortTrueCount / total) * 100).toFixed(1) : "-";

    return { longPercent, shortPercent };
  };

  const calculateGainLoss = () => {
    if (!data || !data.entry || !data.sl || !data.tp || !amount) return null;

    const entry = parseFloat(data.entry);
    const sl = parseFloat(data.sl);
    const tp = parseFloat(data.tp);
    const amt = parseFloat(amount);

    let gain = 0;
    let loss = 0;

    if (direction === "BUY") {
      gain = ((tp - entry) / entry) * amt;
      loss = ((entry - sl) / entry) * amt;
    } else if (direction === "SELL") {
      gain = ((entry - tp) / entry) * amt;
      loss = ((sl - entry) / entry) * amt;
    }

    return { gain: gain.toFixed(2), loss: loss.toFixed(2) };
  };

  const calculateRR = () => {
    if (!data || !data.entry || !data.sl || !data.tp || !direction) return "-";

    const entry = parseFloat(data.entry);
    const sl = parseFloat(data.sl);
    const tp = parseFloat(data.tp);

    if (direction === "BUY") {
      const risk = entry - sl;
      const reward = tp - entry;
      if (risk <= 0) return "-";
      return (reward / risk).toFixed(2);
    } else if (direction === "SELL") {
      const risk = sl - entry;
      const reward = entry - tp;
      if (risk <= 0) return "-";
      return (reward / risk).toFixed(2);
    }

    return "-";
  };

  const rr = calculateRR();
  const gainLoss = calculateGainLoss();
  const { longPercent, shortPercent } = calculateConfirmationsPercent();

  const renderConfirmations = () => {
    if (!data || !data.confirmations) return null;

    const keys = Object.keys(data.confirmations);

    return (
      <div style={{ display: "flex", gap: "40px", marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <h4>Buy Confirmations</h4>
          {keys.map((key) => {
            const confirmedBuy = toBoolean(data.confirmations[key]?.buy);
            const icon = confirmedBuy ? "✅" : "❌";
            return <p key={"buy_" + key}>{icon} {key}</p>;
          })}
          <p><strong>Long Confirmations %:</strong> {longPercent}</p>
        </div>

        <div style={{ flex: 1 }}>
          <h4>Sell Confirmations</h4>
          {keys.map((key) => {
            const confirmedSell = toBoolean(data.confirmations[key]?.sell);
            const icon = confirmedSell ? "✅" : "❌";
            return <p key={"sell_" + key}>{icon} {key}</p>;
          })}
          <p><strong>Short Confirmations %:</strong> {shortPercent}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="App" style={{ padding: 20, fontFamily: "Tahoma, Geneva, Verdana, sans-serif" }}>
      <h2 style={{ textAlign: "center", marginBottom: 24 }}>Crypto Signal Analyzer</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: 24, textAlign: "center" }}>
        <input
          type="text"
          placeholder="Symbol (e.g., BTCUSDT)"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          required
          style={{ marginRight: 8, padding: "8px 12px", fontSize: 16, borderRadius: 6, border: "1px solid #ccc", width: 160 }}
        />
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="0"
          step="any"
          style={{ marginRight: 8, padding: "8px 12px", fontSize: 16, borderRadius: 6, border: "1px solid #ccc", width: 100 }}
        />
        <button
          type="submit"
          style={{ padding: "10px 18px", fontSize: 16, borderRadius: 6, backgroundColor: "#007bff", color: "white", border: "none", cursor: "pointer" }}
        >
          Analyze
        </button>
      </form>

      {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}

      {data && !data.error && (
        <div style={{ maxWidth: 850, margin: "0 auto", backgroundColor: "#f9f9f9", padding: 20, borderRadius: 10, boxShadow: "0 0 8px rgba(0,0,0,0.1)" }}>

          {/* هشدار اگر R:R کمتر از 1 باشد */}
          {parseFloat(rr) < 1 && rr !== "-" && (
            <div style={{
              backgroundColor: "#fff3cd",
              border: "1px solid #ffeeba",
              color: "#856404",
              padding: "12px 16px",
              borderRadius: "8px",
              marginBottom: "16px",
              fontWeight: "bold",
              textAlign: "center"
            }}>
              ⚠️ نسبت سود به ضرر کمتر از ۱ است. ورود به معامله پیشنهاد نمی‌شود.
            </div>
          )}

          <h3 style={{ textAlign: "center", marginBottom: 20 }}>
            Signal: <span style={{ color: direction === "BUY" ? "green" : direction === "SELL" ? "red" : "gray" }}>{data.final_signal}</span>
          </h3>

          <div style={{ marginBottom: 16, textAlign: "center", backgroundColor: "#fff9c4", padding: 12, borderRadius: 8, color: "#856404", fontWeight: "bold" }}>
            Entry Price: {data.entry}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, backgroundColor: "#d4edda", borderRadius: 8, padding: 12, color: "#155724", fontWeight: "bold", textAlign: "center" }}>
              Gain: ${gainLoss?.gain || "-"}
            </div>
            <div style={{ flex: 1, backgroundColor: "#f8d7da", borderRadius: 8, padding: 12, color: "#721c24", fontWeight: "bold", textAlign: "center" }}>
              Loss: ${gainLoss?.loss || "-"}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, backgroundColor: "#d1ecf1", borderRadius: 8, padding: 12, color: "#0c5460", fontWeight: "bold", textAlign: "center" }}>
              Take Profit: {data.tp}
            </div>
            <div style={{ flex: 1, backgroundColor: "#d1ecf1", borderRadius: 8, padding: 12, color: "#0c5460", fontWeight: "bold", textAlign: "center" }}>
              Stop Loss: {data.sl}
            </div>
          </div>

          <p style={{ fontWeight: "bold", fontSize: 16, textAlign: "center", marginBottom: 20 }}>
            Risk-Reward Ratio: {rr}:1
          </p>

          {renderConfirmations()}
        </div>
      )}

      {data && data.error && <p style={{ color: "red", textAlign: "center" }}>Error: {data.error}</p>}
    </div>
  );
}

export default App;
