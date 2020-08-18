const BasicClient = require("../basic-client");
const zlib = require("../zlib");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Candle = require("../candle");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");
const Level2Snapshot = require("../level2-snapshot");
const { CandlePeriod } = require("../enums");

class HuobiBase extends BasicClient {
  constructor({ name, wssPath, watcherMs }) {
    super(wssPath, name, undefined, watcherMs);
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasCandles = true;
    this.hasLevel2Snapshots = true;
    this.hasLevel2Updates = false;
    this.candlePeriod = CandlePeriod._1m;
  }

  _sendPong(ts) {
    if (this._wss) {
      this._wss.send(JSON.stringify({ pong: ts }));
    }
  }

  _sendSubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        sub: `market.${remote_id}.detail`,
        id: remote_id,
      })
    );
  }

  _sendUnsubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        unsub: `market.${remote_id}.detail`,
        id: remote_id,
      })
    );
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        sub: `market.${remote_id}.trade.detail`,
        id: remote_id,
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        unsub: `market.${remote_id}.trade.detail`,
        id: remote_id,
      })
    );
  }

  _sendSubCandles(remote_id) {
    this._wss.send(
      JSON.stringify({
        sub: `market.${remote_id}.kline.${candlePeriod(this.candlePeriod)}`,
        id: remote_id,
      })
    );
  }

  _sendUnsubCandles(remote_id) {
    this._wss.send(
      JSON.stringify({
        unsub: `market.${remote_id}.kline.${candlePeriod(this.candlePeriod)}`,
        id: remote_id,
      })
    );
  }

  _sendSubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        sub: `market.${remote_id}.depth.size_150.high_freq`,
        data_type: "incremental",
        id: "depth_update_" + remote_id,
      })
    );
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        unsub: `market.${remote_id}.depth.size_150.high_freq`,
        data_type: "incremental",
        id: "depth_update_" + remote_id,
      })
    );
  }

  _sendSubLevel2Snapshots(remote_id) {
    this._wss.send(
      JSON.stringify({
        sub: `market.${remote_id}.depth.step0`,
        id: "depth_" + remote_id,
      })
    );
  }

  _sendUnsubLevel2Snapshots(remote_id) {
    this._wss.send(
      JSON.stringify({
        unsub: `market.${remote_id}.depth.step0`,
      })
    );
  }

  _onMessage(raw) {
    zlib.unzip(raw, (err, resp) => {
      if (err) {
        this.emit("error", err);
        return;
      }

      let msgs = JSON.parse(resp);

      // handle pongs
      if (msgs.ping) {
        this._sendPong(msgs.ping);
        return;
      }

      if (!msgs.ch) return;

      // trades
      if (msgs.ch.endsWith("trade.detail")) {
        msgs = JSON.parse(resp.toString().replace(/:([0-9]{1,}\.{0,1}[0-9]{0,}),/g, ':"$1",'));

        let remoteId = msgs.ch.split(".")[1]; //market.ethbtc.trade.detail
        let market = this._tradeSubs.get(remoteId);
        if (!market) return;

        for (let datum of msgs.tick.data) {
          let trade = this._constructTradesFromMessage(datum, market);
          this.emit("trade", trade, market);
        }
        return;
      }

      // candles
      if (msgs.ch.includes("kline")) {
        let remoteId = msgs.ch.split(".")[1]; //market.ethbtc.kline.1min
        let market = this._candleSubs.get(remoteId);
        if (!market) return;

        let candle = this._constructCandle(msgs);
        this.emit("candle", candle, market);
      }

      // tickers
      if (msgs.ch.endsWith(".detail")) {
        let remoteId = msgs.ch.split(".")[1];
        let market = this._tickerSubs.get(remoteId);
        if (!market) return;

        let ticker = this._constructTicker(msgs.tick, market);
        this.emit("ticker", ticker, market);
        return;
      }

      // l2update
      if (msgs.ch.endsWith("depth.size_150.high_freq")) {
        let remoteId = msgs.ch.split(".")[1];
        let market = this._level2UpdateSubs.get(remoteId);
        if (!market) return;

        if (msgs.tick.event === "snapshot") {
          const snapshot = this._constructL2UpdateSnapshot(msgs, market);
          this.emit("l2snapshot", snapshot, market);
        } else {
          const update = this._constructL2Update(msgs, market);
          this.emit("l2update", update, market);
        }
        return;
      }

      // l2snapshot
      if (msgs.ch.endsWith("depth.step0")) {
        let remoteId = msgs.ch.split(".")[1];
        let market = this._level2SnapshotSubs.get(remoteId);
        if (!market) return;

        let snapshot = this._constructLevel2Snapshot(msgs, market);
        this.emit("l2snapshot", snapshot, market);
        return;
      }
    });
  }

  _constructTicker(data, market) {
    let { open, close, high, low, vol, amount } = data;
    let dayChange = close - open;
    let dayChangePercent = ((close - open) / open) * 100;
    return new Ticker({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestamp: Date.now(),
      last: close.toFixed(10),
      open: open.toFixed(10),
      high: high.toFixed(10),
      low: low.toFixed(10),
      volume: amount.toFixed(8),
      quoteVolume: vol.toFixed(8),
      change: dayChange.toFixed(8),
      changePercent: dayChangePercent.toFixed(8),
    });
  }

  _constructTradesFromMessage(datum, market) {
    let { amount, direction, ts, price, id } = datum;
    let unix = Math.trunc(parseInt(ts));
    return new Trade({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      tradeId: id,
      side: direction,
      unix,
      price,
      amount: typeof amount === "number" ? amount.toFixed(8) : amount,
    });
  }

  _constructCandle(msg) {
    let tick = msg.tick;
    let ms = tick.id * 1000;
    return new Candle(
      ms,
      tick.open.toFixed(8),
      tick.high.toFixed(8),
      tick.low.toFixed(8),
      tick.close.toFixed(8),
      tick.vol.toFixed(8)
    );
  }

  /**
   {
      "ch": "market.BTC_CQ.depth.size_150.high_freq",
      "tick": {
        "asks": [
          [11756.82, 1966],
          [11756.91, 3],
          [11756.93, 936]
        ],
        "bids": [
          [11756.81, 2639],
          [11755.13, 73],
          [11754.93, 1]
        ],
        "ch": "market.BTC_CQ.depth.size_150.high_freq",
        "event": "snapshot",
        "id": 91435179848,
        "mrid": 91435179848,
        "ts": 1597347675927,
        "version": 279029079
      },
      "ts": 1597347675927
    }
   */
  _constructL2UpdateSnapshot(msg, market) {
    let { tick } = msg;

    let asks = tick.asks.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(2)));
    let bids = tick.bids.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(2)));

    return new Level2Snapshot({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      sequenceId: tick.version,
      timestampMs: tick.ts,
      asks,
      bids,
      id: tick.id,
      mrid: tick.mrid,
    });
  }

  /**
   {
      "ch": "market.BTC_CQ.depth.size_150.high_freq",
      "tick": {
        "asks": [],
        "bids": [
          [11750.4, 0],
          [11742.49, 44]
        ],
        "ch": "market.BTC_CQ.depth.size_150.high_freq",
        "event": "update",
        "id": 91435179926,
        "mrid": 91435179926,
        "ts": 1597347675971,
        "version": 279029080
      },
      "ts": 1597347675971
    }
   */
  _constructL2Update(msg, market) {
    let { tick } = msg;

    let asks = tick.asks.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(2)));
    let bids = tick.bids.map(p => new Level2Point(p[0].toFixed(8), p[1].toFixed(2)));

    return new Level2Update({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      sequenceId: tick.version,
      timestampMs: tick.ts,
      asks,
      bids,
      id: tick.id,
      mrid: tick.mrid,
    });
  }

  _constructLevel2Snapshot(msg, market) {
    let { tick } = msg;
    let bids = tick.bids.map(p => new Level2Point(p[0].toFixed(10), p[1].toFixed(8)));
    let asks = tick.asks.map(p => new Level2Point(p[0].toFixed(10), p[1].toFixed(8)));
    let { ts, version } = tick;
    return new Level2Snapshot({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      sequenceId: version,
      timestampMs: ts,
      asks,
      bids,
    });
  }
}

function candlePeriod(period) {
  switch (period) {
    case CandlePeriod._1m:
      return "1min";
    case CandlePeriod._5m:
      return "5min";
    case CandlePeriod._15m:
      return "15min";
    case CandlePeriod._30m:
      return "30min";
    case CandlePeriod._1h:
      return "60min";
    case CandlePeriod._4h:
      return "4hour";
    case CandlePeriod._1d:
      return "1day";
    case CandlePeriod._1w:
      return "1week";
    case CandlePeriod._1M:
      return "1mon";
  }
}

module.exports = HuobiBase;
