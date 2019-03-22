const moment = require("moment");
const semaphore = require("semaphore");
const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");

class HitBTCClient extends BasicClient {
  constructor() {
    super("wss://api.hitbtc.com/api/2/ws", "HitBTC");
    this._id = 0;

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Updates = true;

    this.on("connected", this._resetSemaphore.bind(this));
  }

  _resetSemaphore() {
    this._sem = semaphore(10);
  }

  _sendSubTicker(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          method: "subscribeTicker",
          params: {
            symbol: remote_id,
          },
          id: ++this._id,
        })
      );
    });
  }

  _sendUnsubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "unsubscribeTicker",
        params: {
          symbol: remote_id,
        },
      })
    );
  }

  _sendSubTrades(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          method: "subscribeTrades",
          params: {
            symbol: remote_id,
          },
          id: ++this._id,
        })
      );
    });
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "unsubscribeTrades",
        params: {
          symbol: remote_id,
        },
      })
    );
  }

  _sendSubLevel2Updates(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({
          method: "subscribeOrderbook",
          params: {
            symbol: remote_id,
          },
          id: ++this._id,
        })
      );
    });
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._wss.send(
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

    // We use semaphores to throttle connectivity. Once a connection is
    // established we need to clear the semaphore so that the next
    // connection can happen.
    //
    // The payload for a subscribe confirm will include the id that
    // was attached in the JSON-RPC call creation.  For example:
    // { jsonrpc: '2.0', result: true, id: 7 }
    //
    // For unsubscribe calls, we are not including an id
    // so we can ignore messages that do not can an id value:
    // { jsonrpc: '2.0', result: true, id: null }
    if (msg.result && msg.id) {
      this._sem.leave();
      return;
    }

    if (msg.method === "ticker") {
      let ticker = this._constructTicker(msg.params);
      this.emit("ticker", ticker);
    }

    if (msg.method === "updateTrades") {
      for (let datum of msg.params.data) {
        datum.symbol = msg.params.symbol;
        let trade = this._constructTradesFromMessage(datum);
        this.emit("trade", trade);
      }
      return;
    }

    if (msg.method === "snapshotOrderbook") {
      let result = this._constructLevel2Snapshot(msg.params);
      this.emit("l2snapshot", result);
      return;
    }

    if (msg.method === "updateOrderbook") {
      let result = this._constructLevel2Update(msg.params);
      this.emit("l2update", result);
      return;
    }
  }

  _constructTicker(param) {
    let { ask, bid, last, open, low, high, volume, volumeQuote, timestamp, symbol } = param;
    let market = this._tickerSubs.get(symbol);
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

  _constructTradesFromMessage(datum) {
    let { symbol, id, price, quantity, side, timestamp } = datum;

    let market = this._tradeSubs.get(symbol);

    let unix = moment(timestamp).valueOf();

    return new Trade({
      exchange: "HitBTC",
      base: market.base,
      quote: market.quote,
      tradeId: id,
      side,
      unix,
      price,
      amount: quantity,
    });
  }

  _constructLevel2Snapshot(data) {
    let { ask, bid, symbol, sequence } = data;
    let market = this._level2UpdateSubs.get(symbol); // coming from l2update sub
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

  _constructLevel2Update(data) {
    let { ask, bid, symbol, sequence } = data;
    let market = this._level2UpdateSubs.get(symbol);
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

module.exports = HitBTCClient;
