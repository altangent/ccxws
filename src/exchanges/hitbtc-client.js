const moment = require("moment");
const { throttle } = require("../flowcontrol/throttle");
const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");
const { CandlePeriod } = require("../enums");
const Candle = require("../candle");

class HitBTCClient extends BasicClient {
  constructor({ throttleMs = 25 } = {}) {
    super("wss://api.hitbtc.com/api/2/ws", "HitBTC");
    this._id = 0;

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasCandles = true;
    this.hasLevel2Updates = true;
    this.candlePeriod = CandlePeriod._1m;
    this._send = throttle(this._send.bind(this), throttleMs);
  }

  _beforeClose() {
    this._send.cancel();
  }

  _send(msg) {
    this._wss.send(msg);
  }

  _sendSubTicker(remote_id) {
    this._send(
      JSON.stringify({
        method: "subscribeTicker",
        params: {
          symbol: remote_id,
        },
        id: ++this._id,
      })
    );
  }

  _sendUnsubTicker(remote_id) {
    this._send(
      JSON.stringify({
        method: "unsubscribeTicker",
        params: {
          symbol: remote_id,
        },
      })
    );
  }

  _sendSubTrades(remote_id) {
    this._send(
      JSON.stringify({
        method: "subscribeTrades",
        params: {
          symbol: remote_id,
        },
        id: ++this._id,
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._send(
      JSON.stringify({
        method: "unsubscribeTrades",
        params: {
          symbol: remote_id,
        },
      })
    );
  }

  _sendSubCandles(remote_id) {
    this._send(
      JSON.stringify({
        method: "subscribeCandles",
        params: {
          symbol: remote_id,
          period: candlePeriod(this.candlPeriod),
        },
        id: ++this._id,
      })
    );
  }

  _sendUnsubCandles(remote_id) {
    this._send(
      JSON.stringify({
        method: "unsubscribeCandles",
        params: {
          symbol: remote_id,
          period: candlePeriod(this.candlPeriod),
        },
      })
    );
  }

  _sendSubLevel2Updates(remote_id) {
    this._send(
      JSON.stringify({
        method: "subscribeOrderbook",
        params: {
          symbol: remote_id,
        },
        id: ++this._id,
      })
    );
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._send(
      JSON.stringify({
        method: "unsubscribeOrderbook",
        params: {
          symbol: remote_id,
        },
      })
    );
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);

    // The payload for a subscribe confirm will include the id that
    // was attached in the JSON-RPC call creation.  For example:
    // { jsonrpc: '2.0', result: true, id: 7 }
    if (msg.result === true && msg.id) {
      // console.log(msg);
      // return;
    }

    // For unsubscribe calls, we are not including an id
    // so we can ignore messages that do not can an id value:
    // { jsonrpc: '2.0', result: true, id: null }
    if (msg.result !== undefined && msg.id) {
      return;
    }

    let remote_id = msg.params && msg.params.symbol;

    if (msg.method === "ticker") {
      let market = this._tickerSubs.get(remote_id);
      if (!market) return;

      let ticker = this._constructTicker(msg.params, market);
      this.emit("ticker", ticker, market);
    }

    if (msg.method === "updateTrades") {
      let market = this._tradeSubs.get(remote_id);
      if (!market) return;

      for (let datum of msg.params.data) {
        let trade = this._constructTradesFromMessage(datum, market);
        this.emit("trade", trade, market);
      }
      return;
    }

    if (msg.method === "updateCandles") {
      let market = this._candleSubs.get(remote_id);
      if (!market) return;

      for (let datum of msg.params.data) {
        let candle = this._constructCandle(datum, market);
        this.emit("candle", candle, market);
      }
    }

    if (msg.method === "snapshotOrderbook") {
      let market = this._level2UpdateSubs.get(remote_id); // coming from l2update sub
      if (!market) return;

      let result = this._constructLevel2Snapshot(msg.params, market);
      this.emit("l2snapshot", result, market);
      return;
    }

    if (msg.method === "updateOrderbook") {
      let market = this._level2UpdateSubs.get(remote_id);
      if (!market) return;

      let result = this._constructLevel2Update(msg.params, market);
      this.emit("l2update", result, market);
      return;
    }
  }

  _constructTicker(param, market) {
    let { ask, bid, last, open, low, high, volume, volumeQuote, timestamp } = param;
    let change = (parseFloat(last) - parseFloat(open)).toFixed(8);
    let changePercent = (((parseFloat(last) - parseFloat(open)) / parseFloat(open)) * 100).toFixed(
      8
    );
    return new Ticker({
      exchange: "HitBTC",
      base: market.base,
      quote: market.quote,
      timestamp: moment.utc(timestamp).valueOf(),
      last,
      open,
      high,
      low,
      volume,
      quoteVolume: volumeQuote,
      ask,
      bid,
      change,
      changePercent,
    });
  }

  _constructTradesFromMessage(datum, market) {
    let { id, price, quantity, side, timestamp } = datum;

    let unix = moment(timestamp).valueOf();

    return new Trade({
      exchange: "HitBTC",
      base: market.base,
      quote: market.quote,
      tradeId: id.toFixed(),
      side,
      unix,
      price,
      amount: quantity,
    });
  }

  _constructCandle(datum) {
    let unix = moment(datum.timestamp).valueOf();
    return new Candle(unix, datum.open, datum.max, datum.min, datum.close, datum.volume);
  }

  _constructLevel2Snapshot(data, market) {
    let { ask, bid, sequence } = data;
    let asks = ask.map(p => new Level2Point(p.price, p.size));
    let bids = bid.map(p => new Level2Point(p.price, p.size));
    return new Level2Snapshot({
      exchange: "HitBTC",
      base: market.base,
      quote: market.quote,
      sequenceId: sequence,
      asks,
      bids,
    });
  }

  _constructLevel2Update(data, market) {
    let { ask, bid, sequence } = data;
    let asks = ask.map(p => new Level2Point(p.price, p.size, p.count));
    let bids = bid.map(p => new Level2Point(p.price, p.size, p.count));
    return new Level2Update({
      exchange: "HitBTC",
      base: market.base,
      quote: market.quote,
      sequenceId: sequence,
      asks,
      bids,
    });
  }
}

function candlePeriod(period) {
  switch (period) {
    case CandlePeriod._1m:
      return "M1";
    case CandlePeriod._3m:
      return "M3";
    case CandlePeriod._5m:
      return "M5";
    case CandlePeriod._15m:
      return "M15";
    case CandlePeriod._30m:
      return "M30";
    case CandlePeriod._1h:
      return "H1";
    case CandlePeriod._4h:
      return "H4";
    case CandlePeriod._1d:
      return "D1";
    case CandlePeriod._1w:
      return "D7";
    case CandlePeriod._1M:
      return "1M";
  }
}

module.exports = HitBTCClient;
