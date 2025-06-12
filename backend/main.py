from fastapi import FastAPI
from pydantic import BaseModel
from tradingview_ta import TA_Handler
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    symbol: str
    amount: float

def calculate_pivot_points(high, low, close):
    pivot = (high + low + close) / 3
    resistance1 = 2 * pivot - low
    support1 = 2 * pivot - high
    resistance2 = pivot + (resistance1 - support1)
    support2 = pivot - (resistance1 - support1)
    return {
        "pivot": pivot,
        "resistance1": resistance1,
        "support1": support1,
        "resistance2": resistance2,
        "support2": support2
    }

@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    symbol = request.symbol
    amount = request.amount

    handler = TA_Handler(
        symbol=symbol,
        screener="crypto",
        exchange="BINANCE",
        interval="1h"
    )

    try:
        analysis = handler.get_analysis()
        indicators = analysis.indicators

        high = float(indicators.get("high", 0))
        low = float(indicators.get("low", 0))
        close = float(indicators.get("close", 0))

        if high == 0 or low == 0 or close == 0:
            close = float(handler.get_price())
            high = close * 1.01
            low = close * 0.99

        pivots = calculate_pivot_points(high, low, close)

        rsi = float(indicators.get("RSI", 0))
        macd_line = float(indicators.get("MACD.macd", 0))
        signal_line = float(indicators.get("MACD.signal", 0))
        bb_upper = float(indicators.get("BB.upper", 0))
        bb_lower = float(indicators.get("BB.lower", 0))
        bb_middle = float(indicators.get("BB.middle", 0))
        psar = float(indicators.get("PSAR", 0))
        stoch_k = float(indicators.get("Stoch.RSI.K", 0))
        stoch_d = float(indicators.get("Stoch.RSI.D", 0))

        # تحلیل اولیه فقط برای نمایش
        if rsi < 40 and macd_line > signal_line:
            direction = "BUY"
        elif rsi > 70  and macd_line < signal_line:
            direction = "SELL"
        else:
            direction = "HOLD"

        confirmations = {
            "RSI": {
                "buy": rsi < 40 ,
                "sell": rsi >70 
            },
            "MACD": {
                "buy": macd_line > signal_line,
                "sell": macd_line < signal_line
            },
            "Pivot Support/Resistance": {
                "buy": True,
                "sell": True
            },
            "Bollinger Bands": {
                "buy": close < bb_lower,
                "sell": close > bb_upper
            },
            "PSAR": {
                "buy": close > psar,
                "sell": close < psar
            },
            "Stoch RSI": {
                "buy": stoch_k < 30 and stoch_d < 30,
                "sell": stoch_k > 70 and stoch_d > 70
            },
        }

        keys = [k for k in confirmations.keys() if k != "Pivot Support/Resistance"]

        long_true_count = sum(confirmations[k]["buy"] for k in keys)
        short_true_count = sum(confirmations[k]["sell"] for k in keys)
        total = len(keys)

        long_percent = round((long_true_count / total) * 100, 1) if total else 0
        short_percent = round((short_true_count / total) * 100, 1) if total else 0

        if long_percent > short_percent and long_percent >= 50:
            final_signal = "BUY"
        elif short_percent > long_percent and short_percent >= 50:
            final_signal = "SELL"
        else:
            final_signal = "HOLD"

        # حالا با توجه به سیگنال نهایی، استاپ و تی‌پی را تنظیم کن
        trade_direction = final_signal

        stop_loss_buffer = 0.007
        take_profit_buffer = 0.01
        min_distance = close * 0.05
        max_distance = close * 0.5

        if trade_direction == "BUY":
            sl_candidate = pivots["support1"]
            tp_candidate = pivots["resistance1"]
        elif trade_direction == "SELL":
            sl_candidate = pivots["resistance1"]
            tp_candidate = pivots["support1"]
        else:
            sl_candidate = pivots["support1"]
            tp_candidate = pivots["resistance1"]

        pivot_distance = abs(tp_candidate - sl_candidate)

        if min_distance <= pivot_distance <= max_distance:
            sl = sl_candidate
            tp = tp_candidate
        else:
            if trade_direction == "BUY":
                sl = close * (1 - stop_loss_buffer)
                tp = close * (1 + take_profit_buffer)
            elif trade_direction == "SELL":
                sl = close * (1 + stop_loss_buffer)
                tp = close * (1 - take_profit_buffer)
            else:
                sl = close * (1 - stop_loss_buffer)
                tp = close * (1 + take_profit_buffer)

        if trade_direction == "BUY" and tp <= sl:
            tp = close * (1 + take_profit_buffer)
            sl = close * (1 - stop_loss_buffer)
        elif trade_direction == "SELL" and tp >= sl:
            tp = close * (1 - take_profit_buffer)
            sl = close * (1 + stop_loss_buffer)

        rr = None
        if trade_direction == "BUY" and sl != close:
            rr = (tp - close) / (close - sl) if (close - sl) != 0 else None
        elif trade_direction == "SELL" and sl != close:
            rr = (close - tp) / (sl - close) if (sl - close) != 0 else None

        gain = loss = None
        if trade_direction == "BUY":
            gain = (tp - close) * amount / close
            loss = (close - sl) * amount / close
        elif trade_direction == "SELL":
            gain = (close - tp) * amount / close
            loss = (sl - close) * amount / close

        return {
            "symbol": symbol,
            "amount": amount,
            "direction": trade_direction,
            "entry": round(close, 4),
            "sl": round(sl, 4),
            "tp": round(tp, 4),
            "rr": round(rr, 2) if rr is not None else None,
            "gain": round(gain, 2) if gain is not None else None,
            "loss": round(loss, 2) if loss is not None else None,
            "rsi": round(rsi, 2),
            "macd": {
                "line": round(macd_line, 4),
                "signal": round(signal_line, 4)
            },
            "bollinger_bands": {
                "upper": round(bb_upper, 4),
                "middle": round(bb_middle, 4),
                "lower": round(bb_lower, 4)
            },
            "psar": round(psar, 4),
            "stoch_rsi": {
                "K": round(stoch_k, 2),
                "D": round(stoch_d, 2)
            },
            "confirmations": confirmations,
            "long_percent": long_percent,
            "short_percent": short_percent,
            "final_signal": final_signal
        }

    except Exception as e:
        return {"error": str(e)}
