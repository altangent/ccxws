const BasicClient = require("../basic-client");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");
const moment = require("moment");

class BitmexClient extends BasicClient {
  constructor() {
    super("wss://www.bitmex.com/realtime", "BitMEX");
    this.hasTrades = true;
    this.hasLevel2Updates = true;
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "subscribe",
        args: [`trade:${remote_id}`],
      })
    );
  }

  _sendSubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "subscribe",
        args: [`orderBookL2:${remote_id}`],
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "unsubscribe",
        args: [`trade:${remote_id}`],
      })
    );
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "unsubscribe",
        args: [`orderBookL2:${remote_id}`],
      })
    );
  }

  _onMessage(msgs) {
    let message = JSON.parse(msgs);
    let { table, action } = message;

    if (table === "trade") {
      if (action !== "insert") return;
      for (let datum of message.data) {
        let trade = this._constructTrades(datum);
        this.emit("trade", trade);
      }
      return;
    }

    if (table === "orderBookL2") {
      if (action === "partial") {
        let snapshot = this._constructLevel2Snapshot(message.data);
        this.emit("l2snapshot", snapshot);
      } else {
        let update = this._constructLevel2Update(message.data, action);
        this.emit("l2update", update);
      }
      return;
    }
  }

  _constructTrades(datum) {
    let { size, side, timestamp, price, trdMatchID } = datum;
    let market = this._tradeSubs.get(datum.symbol);
    let unix = moment(timestamp).valueOf();
    return new Trade({
      exchange: "BitMEX",
      base: market.base,
      quote: market.quote,
      tradeId: trdMatchID.replace(/-/g, ""),
      unix,
      side: side.toLowerCase(),
      price: price.toFixed(8),
      amount: size.toFixed(8),
    });
  }

  // prettier-ignore
  _constructLevel2Snapshot(data) {
    let market = this._level2UpdateSubs.get(data[0].symbol);
    let asks = [];
    let bids = [];
    for (let datum of data) {
      let point = new Level2Point(datum.price.toFixed(8), datum.size.toFixed(8), undefined, { id: datum.id });
      if(datum.side === 'Sell') asks.push(point);
      else bids.push(point);
    }
    return new Level2Snapshot({
      exchange: 'BitMEX',
      base: market.base,
      quote: market.quote,
      asks,
      bids,
    });
  }

  // prettier-ignore
  _constructLevel2Update(data, type) {
    let market = this._level2UpdateSubs.get(data[0].symbol);
    let asks = [];
    let bids = [];
    for (let datum of data) {
      let price = datum.price && datum.price.toFixed(8);
      let size = datum.size && datum.size.toFixed(8);
      let point = new Level2Point(price, size, undefined, { type, id: datum.id });
      if(datum.side === 'Sell') asks.push(point);
      else bids.push(point);
    }
    return new Level2Update({
      exchange: 'BitMEX',
      base: market.base,
      quote: market.quote,
      asks,
      bids,
    });
  }
}

module.exports = BitmexClient;
