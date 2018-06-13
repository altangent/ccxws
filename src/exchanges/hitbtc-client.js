const moment = require("moment");
const semaphore = require("semaphore");
const BasicClient = require("../basic-client");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");

class HitBTCClient extends BasicClient {
  constructor() {
    super("wss://api.hitbtc.com/api/2/ws", "HitBTC");
    this._id = 0;

    this.hasTrades = true;
    this.hasLevel2Updates = true;

    this.on("connected", this._resetSemaphore.bind(this));
  }

  _resetSemaphore() {
    this._sem = semaphore(10);
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
        id: ++this._id,
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

    if (msg.result) {
      this._sem.leave();
      return;
    }
    if (msg.method === "updateTrades") {
      for (let datum of msg.params.data) {
        datum.symbol = msg.params.symbol;
        let trade = this._constructTradesFromMessage(datum);
        this.emit("trade", trade);
        return;
      }
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

  _constructTradesFromMessage(datum) {
    let { symbol, id, price, quantity, side, timestamp } = datum;

    let market = this._tradeSubs.get(symbol);

    let unix = moment(timestamp).unix();
    let amount = side === "sell" ? -parseFloat(quantity) : parseFloat(quantity);
    let priceNum = parseFloat(price);

    return new Trade({
      exchange: "HitBTC",
      base: market.base,
      quote: market.quote,
      tradeId: id,
      unix,
      price: priceNum,
      amount,
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
