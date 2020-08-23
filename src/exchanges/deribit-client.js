const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Candle = require("../candle");
const { CandlePeriod } = require("../enums");
const { throttle } = require("../flowcontrol/throttle");

class DeribitClient extends BasicClient {
  constructor({ wssPath = "wss://www.deribit.com/ws/api/v2", watcherMs } = {}) {
    super(wssPath, "Deribit", undefined, watcherMs);
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasCandles = true;
    this.hasLevel2Updates = true;
    this.id = 0;
    this.candlePeriod = CandlePeriod._1m;
    this._send = throttle(this._send.bind(this), 50);
  }

  _beforeClose() {
    this._send.cancel();
  }

  _send(message) {
    this._wss.send(message);
  }

  _sendSubTicker(remote_id) {
    this._send(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "public/subscribe",
        params: {
          channels: [`ticker.${remote_id}.raw`],
        },
        id: ++this.id,
      })
    );
  }

  _sendUnsubTicker(remote_id) {
    this._send(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "public/unsubscribe",
        params: {
          channels: [`ticker.${remote_id}.raw`],
        },
        id: ++this.id,
      })
    );
  }

  _sendSubTrades(remote_id) {
    this._send(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "public/subscribe",
        params: {
          channels: [`trades.${remote_id}.raw`],
        },
        id: ++this.id,
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._send(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "public/unsubscribe",
        params: {
          channels: [`trades.${remote_id}.raw`],
        },
        id: ++this.id,
      })
    );
  }

  _sendSubCandles(remote_id) {
    this._send(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "public/subscribe",
        params: {
          channels: [`chart.trades.${remote_id}.${candlePeriod(this.candlePeriod)}`],
        },
        id: ++this.id,
      })
    );
  }

  _sendUnsubCandles(remote_id) {
    this._send(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "public/unsubscribe",
        params: {
          channels: [`chart.trades.${remote_id}.${candlePeriod(this.candlePeriod)}`],
        },
        id: ++this.id,
      })
    );
  }

  _sendSubLevel2Updates(remote_id) {
    this._send(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "public/subscribe",
        params: {
          channels: [`book.${remote_id}.raw`],
        },
        id: ++this.id,
      })
    );
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "public/unsubscribe",
        params: {
          channels: [`book.${remote_id}.raw`],
        },
        id: ++this.id,
      })
    );
  }

  _onMessage(raw) {
    const msg = JSON.parse(raw);
    // console.log(msg);

    // Error?
    if (!msg.params) {
      return;
    }

    // Everything past here should be a channel message
    const channel = msg.params.channel;
    if (!channel) {
      return;
    }

    // tickers - ticker.{instrument_name}.{interval}
    if (channel.startsWith("ticker")) {
      const parts = channel.split(".");
      const market = this._tickerSubs.get(parts[1]);
      if (!market) return;

      const ticker = this._constructTicker(msg, market);
      this.emit("ticker", ticker, market);
      return;
    }

    // trades - trades.{instrument_name}.{interval}
    if (channel.startsWith("trades")) {
      const parts = channel.split(".");
      const market = this._tradeSubs.get(parts[1]);
      if (!market) return;

      for (let datum of msg.params.data) {
        const trade = this._constructTrade(datum, market);
        this.emit("trade", trade, market);
      }
      return;
    }

    // candle - chart.trades.{instrument_name}.{resolution}
    if (channel.startsWith("chart")) {
      const parts = channel.split(".");
      const market = this._candleSubs.get(parts[2]);
      if (!market) return;

      const candle = this._constructCandle(msg.params.data, market);
      this.emit("candle", candle, market);
      return;
    }

    // book - book.{instrument_name}.{interval}
    if (channel.startsWith("book")) {
      const parts = channel.split(".");
      const market = this._level2UpdateSubs.get(parts[1]);
      if (!market) return;

      // capture snapshot
      if (!msg.params.data.prev_change_id) {
        const snapshot = this._constructLevel2Snapshot(msg.params.data, market);
        this.emit("l2snapshot", snapshot, market);
      }
      // capture update
      else {
        const update = this._constructLevel2Update(msg.params.data, market);
        this.emit("l2update", update, market);
      }
      return;
    }
  }

  /**
    {
      "jsonrpc": "2.0",
      "method": "subscription",
      "params": {
        "channel": "ticker.BTC-PERPETUAL.raw",
        "data": {
          "timestamp": 1597244851057,
          "stats": {
            "volume_usd": 404775400.0,
            "volume": 35574.05167122,
            "price_change": 0.493,
            "low": 11131.5,
            "high": 11632.5
          },
          "state": "open",
          "settlement_price": 11452.62,
          "open_interest": 117979530,
          "min_price": 11443.06,
          "max_price": 11791.58,
          "mark_price": 11617.8,
          "last_price": 11618.0,
          "instrument_name": "BTC-PERPETUAL",
          "index_price": 11609.61,
          "funding_8h": 0.00001212,
          "estimated_delivery_price": 11609.61,
          "current_funding": 0.00020545,
          "best_bid_price": 11618.0,
          "best_bid_amount": 7460.0,
          "best_ask_price": 11618.5,
          "best_ask_amount": 497870.0
        }
      }
    }
   */
  _constructTicker(msg, market) {
    let data = msg.params.data;
    return new Ticker({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestamp: data.timestamp,
      last: (data.last_price ? data.last_price : 0).toFixed(8),
      open: undefined,
      high: (data.stats.high ? data.stats.high : 0).toFixed(8),
      low: (data.stats.low ? data.stats.low : 0).toFixed(8),
      volume: (data.stats.volume ? data.stats.volume : 0).toFixed(8),
      quoteVolume: undefined,
      change: undefined,
      changePercent: (data.stats.price_change ? data.stats.price_change : 0).toFixed(2),
      ask: (data.best_ask_price ? data.best_ask_price : 0).toFixed(8),
      askVolume: (data.best_ask_amount ? data.best_ask_amount : 0).toFixed(8),
      bid: (data.best_bid_price ? data.best_bid_price : 0).toFixed(8),
      bidVolume: (data.best_bid_amount ? data.best_bid_amount : 0).toFixed(8),
    });
  }

  /**
   * PERPETUAL
    {
      "trade_seq": 56761222,
      "trade_id": "88095252",
      "timestamp": 1597246721811,
      "tick_direction": 3,
      "price": 11576.0,
      "mark_price": 11574.5,
      "instrument_name": "BTC-PERPETUAL",
      "index_price": 11567.32,
      "direction": "buy",
      "amount": 4310.0
    }
   */
  _constructTrade(datum, market) {
    return new Trade({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      tradeId: datum.trade_id,
      side: datum.direction,
      unix: datum.timestamp,
      price: datum.price.toFixed(8),
      amount: datum.amount.toFixed(8),
      tradeSeq: datum.trade_seq,
      blockTradeId: datum.block_trade_id,
      markPrice: datum.mark_price.toFixed(8),
      indexPrice: datum.index_price.toFixed(8),
      liquidation: datum.liquidation,
      iv: datum.iv,
      tickDirection: datum.tick_direction,
    });
  }

  /**
    {
      "volume" : 0.05219351,
      "tick" : 1573645080000,
      "open" : 8869.79,
      "low" : 8788.25,
      "high" : 8870.31,
      "cost" : 460,
      "close" : 8791.25
    },
   */
  _constructCandle(data) {
    return new Candle(
      data.tick,
      data.open.toFixed(8),
      data.high.toFixed(8),
      data.low.toFixed(8),
      data.close.toFixed(8),
      data.volume.toFixed(8)
    );
  }

  /**
    {
      "type" : "snapshot",
      "timestamp" : 1554373962454,
      "instrument_name" : "BTC-PERPETUAL",
      "change_id" : 297217,
      "bids" : [
        [
          "new",
          5042.34,
          30
        ],
        [
          "new",
          5041.94,
          20
        ]
      ],
      "asks" : [
        [
          "new",
          5042.64,
          40
        ],
        [
          "new",
          5043.3,
          40
        ]
      ]
    }
   */
  _constructLevel2Snapshot(data, market) {
    const timestampMs = data.timestamp;
    const sequenceId = data.change_id;

    const asks = data.asks.map(
      p => new Level2Point(p[1].toFixed(8), p[2].toFixed(8), undefined, { action: p[0] })
    );
    const bids = data.bids.map(
      p => new Level2Point(p[1].toFixed(8), p[2].toFixed(8), undefined, { action: p[0] })
    );

    return new Level2Snapshot({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestampMs,
      sequenceId,
      asks,
      bids,
    });
  }

  /**
   {
      "type" : "change",
      "timestamp" : 1554373911330,
      "prev_change_id" : 297217,
      "instrument_name" : "BTC-PERPETUAL",
      "change_id" : 297218,
      "bids" : [
        [
          "delete",
          5041.94,
          0
        ],
        [
          "delete",
          5042.34,
          0
        ]
      ],
      "asks" : [

      ]
    }
   */
  _constructLevel2Update(data, market) {
    const timestampMs = data.timestamp;
    const lastSequenceId = data.prev_change_id;
    const sequenceId = data.change_id;

    const asks = data.asks.map(
      p => new Level2Point(p[1].toFixed(8), p[2].toFixed(2), undefined, { action: p[0] })
    );
    const bids = data.bids.map(
      p => new Level2Point(p[1].toFixed(8), p[2].toFixed(2), undefined, { action: p[0] })
    );

    return new Level2Snapshot({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestampMs,
      sequenceId,
      lastSequenceId,
      asks,
      bids,
    });
  }
}

function candlePeriod(period) {
  switch (period) {
    case CandlePeriod._1m:
      return "1";
    case CandlePeriod._3m:
      return "3";
    case CandlePeriod._5m:
      return "5";
    case CandlePeriod._10m:
      return "10";
    case CandlePeriod._15m:
      return "15";
    case CandlePeriod._30m:
      return "30";
    case CandlePeriod._1h:
      return "60";
    case CandlePeriod._2h:
      return "120";
    case CandlePeriod._3h:
      return "180";
    case CandlePeriod._6h:
      return "360";
    case CandlePeriod._12h:
      return "720";
    case CandlePeriod._1d:
      return "1D";
  }
}

module.exports = DeribitClient;
