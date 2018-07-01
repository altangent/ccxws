const BasicClient = require("../basic-client");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");
const Level2Snapshot = require("../level2-snapshot");

class PoloniexClient extends BasicClient {
  constructor() {
    super("wss://api2.poloniex.com/", "Poloniex");
    this._idMap = new Map();
    this.hasTrades = true;
    this.hasLevel2Updates = true;
    this.on("connected", this._resetSubCount.bind(this));
  }

  _resetSubCount() {
    this._subCount = {};
  }

  _sendSubTrades(remote_id) {
    this._sendSubscribe(remote_id);
  }

  _sendUnsubTrades(remote_id) {
    this._sendUnsubscribe(remote_id);
  }

  _sendSubLevel2Updates(remote_id) {
    this._sendSubscribe(remote_id);
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._sendUnsubscribe(remote_id);
  }

  _sendSubscribe(remote_id) {
    this._subCount[remote_id] = (this._subCount[remote_id] || 0) + 1; // increment market counter
    // if we have more than one sub, ignore the request as we're already subbed
    if (this._subCount[remote_id] > 1) return;

    this._wss.send(
      JSON.stringify({
        command: "subscribe",
        channel: remote_id,
      })
    );
  }

  _sendUnsubscribe(remote_id) {
    this._subCount[remote_id] -= 1; // decrement market count

    // if we still have subs, then leave channel open
    if (this._subCount[remote_id]) return;

    this._wss.send(
      JSON.stringify({
        command: "unsubscribe",
        channel: remote_id,
      })
    );
  }

  _onMessage(raw) {
    // different because messages are broadcast as joined updates
    // [148,540672082,[["o",1,"0.07313000","7.21110596"],["t","43781170",0,"0.07313000","0.00199702",1528900825]]]
    // we need to pick apart these messages and broadcast them accordingly

    let msg = JSON.parse(raw);
    let id = msg[0];
    let seq = msg[1];
    let updates = msg[2];
    if (!updates) return;

    let bids = [];
    let asks = [];

    for (let update of updates) {
      switch (update[0]) {
        // when connection is first established it will send an 'info' packet
        // that can be used to map the "id" to the market_symbol
        case "i": {
          let remote_id = update[1].currencyPair;
          this._idMap.set(id, remote_id);

          if (this._level2UpdateSubs.has(remote_id)) {
            let snapshot = this._constructoLevel2Snapshot(seq, update[1]);
            this.emit("l2snapshot", snapshot);
          }

          break;
        }
        // trade events will stream-in after we are subscribed to the channel
        // and hopefully after the info packet has been sent
        case "t": {
          if (this._tradeSubs.has(this._idMap.get(id))) {
            let trade = this._constructTradeFromMessage(id, update);
            this.emit("trade", trade);
          }
          break;
        }

        case "o": {
          if (this._level2UpdateSubs.has(this._idMap.get(id))) {
            //[171, 280657226, [["o", 0, "0.00225182", "0.00000000"], ["o", 0, "0.00225179", "860.66363984"]]]
            //[171, 280657227, [["o", 1, "0.00220001", "0.00000000"], ["o", 1, "0.00222288", "208.47334089"]]]
            let point = new Level2Point(update[2], update[3]);
            if (update[1] === 0) asks.push(point);
            if (update[1] === 1) bids.push(point);
          }
          break;
        }
      }
    }

    // check if we have bids/asks and construct order update message
    if (bids.length || asks.length) {
      let market = this._level2UpdateSubs.get(this._idMap.get(id));
      let l2update = new Level2Update({
        exchange: "Poloniex",
        base: market.base,
        quote: market.quote,
        sequenceId: seq,
        asks,
        bids,
      });
      this.emit("l2update", l2update);
    }
  }

  _constructTradeFromMessage(id, update) {
    let [, trade_id, side, price, size, unix] = update;

    // figure out the market symbol
    let remote_id = this._idMap.get(id);
    if (!remote_id) return;

    let market = this._tradeSubs.get(remote_id);

    let amount = side === "sell" ? -parseFloat(size) : parseFloat(size);
    price = parseFloat(price);
    trade_id = parseInt(trade_id);

    return new Trade({
      exchange: "Poloniex",
      base: market.base,
      quote: market.quote,
      tradeId: trade_id,
      unix,
      price,
      amount,
    });
  }

  _constructoLevel2Snapshot(seq, update) {
    let market = this._level2UpdateSubs.get(update.currencyPair);
    let [asksObj, bidsObj] = update.orderBook;
    let asks = [];
    let bids = [];
    for (let price in asksObj) {
      asks.push(new Level2Point(price, asksObj[price]));
    }
    for (let price in bidsObj) {
      bids.push(new Level2Point(price, bidsObj[price]));
    }
    return new Level2Snapshot({
      exchange: "Poloniex",
      base: market.base,
      quote: market.quote,
      sequenceId: seq,
      asks,
      bids,
    });
  }
}

module.exports = PoloniexClient;
