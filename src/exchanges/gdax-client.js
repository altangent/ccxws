const moment = require("moment");
const BasicClient = require("../basic-client");
const Trade = require("../trade");

class GdaxClient extends BasicClient {
  constructor() {
    super("wss://ws-feed.gdax.com", "GDAX");
  }

  _sendSubscribe(remote_id) {
    this._wss.send(
      JSON.stringify({
        type: "subscribe",
        product_ids: [remote_id],
        channels: ["matches"],
      })
    );
  }

  _sendUnsubscribe(remote_id) {
    this._wss.send(
      JSON.stringify({
        type: "unsubscribe",
        product_ids: [remote_id],
        channels: ["matches"],
      })
    );
  }

  _sendSubLevel2(remote_id) {
    this._wss.send(
      JSON.stringify({
        type: "subscribe",
        product_ids: [remote_id],
        channels: ["level2"],
      })
    );
  }

  _sendUnsubLevel2(remote_id) {
    this._wss.send(
      JSON.stringify({
        type: "unsubscribe",
        product_ids: [remote_id],
        channels: ["level2"],
      })
    );
  }

  _sendSubLevel3(remote_id) {
    this._wss.send(
      JSON.stringify({
        type: "subscribe",
        product_ids: [remote_id],
        channels: ["full"],
      })
    );
  }

  _sendUnsubLevel3(remote_id) {
    this._wss.send(
      JSON.stringify({
        type: "unsubscribe",
        product_ids: [remote_id],
        channels: ["full"],
      })
    );
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);

    let { type, product_id } = msg;

    if (type === "match" && this._subscriptions.has(product_id)) {
      let trade = this._constructTrade(msg);
      this.emit("trade", trade);
    }

    if (type === "snapshot" && this._level2Subs.has(product_id)) {
      let snapshot = this._constructLevel2Snapshot(msg);
      this.emit("l2snapshot", snapshot);
    }

    if (type === "l2update" && this._level2Subs.has(product_id)) {
      let update = this._constructLevel2Update(msg);
      this.emit("l2update", update);
    }

    if (
      ["received", "open", "done", "match", "change"].includes(type) &&
      this._level3Subs.has(product_id)
    ) {
      let update = this._constructLevel3Update(msg);
      this.emit("l3update", update);
      return;
    }
  }

  _constructTrade(msg) {
    let { trade_id, time, product_id, size, price, side } = msg;

    let market = this._subscriptions.get(product_id);

    let unix = moment.utc(time).unix();
    let amount = side === "sell" ? -parseFloat(size) : parseFloat(size);
    let priceNum = parseFloat(price);

    return new Trade({
      exchange: "GDAX",
      base: market.base,
      quote: market.quote,
      tradeId: trade_id,
      unix,
      price: priceNum,
      amount,
    });
  }

  _constructLevel2Snapshot(msg) {
    let { product_id, bids, asks } = msg;

    let market = this._level2Subs.get(product_id);

    bids = bids.map(([price, size]) => ({ price, size }));
    asks = asks.map(([price, size]) => ({ price, size }));

    return {
      exchange: "GDAX",
      base: market.base,
      quote: market.quote,
      bids,
      asks,
    };
  }

  _constructLevel2Update(msg) {
    let { product_id, changes } = msg;

    let market = this._level2Subs.get(product_id);

    changes = changes.map(([side, price, size]) => ({ side, price, size }));

    return {
      exchange: "GDAX",
      base: market.base,
      quote: market.quote,
      changes,
    };
  }

  _constructLevel3Update(msg) {
    let market = this._level3Subs.get(msg.product_id);
    let time = moment(msg.time).valueOf();

    switch (msg.type) {
      case "received":
        return {
          exchange: "GDAX",
          base: market.base,
          quote: market.quote,
          type: msg.type,
          time,
          sequence: msg.sequence,
          order_id: msg.order_id.replace(/-/g, ""),
          size: msg.size,
          price: msg.price,
          side: msg.side,
          order_type: msg.order_type,
          funds: msg.funds,
        };
      case "open":
        return {
          exchange: "GDAX",
          base: market.base,
          quote: market.quote,
          type: msg.type,
          time,
          sequence: msg.sequence,
          order_id: msg.order_id.replace(/-/g, ""),
          price: msg.price,
          remaining_size: msg.remaining_size,
          side: msg.side,
        };
      case "done":
        return {
          exchange: "GDAX",
          base: market.base,
          quote: market.quote,
          type: msg.type,
          time,
          sequence: msg.sequence,
          price: msg.price,
          order_id: msg.order_id.replace(/-/g, ""),
          reason: msg.reason,
          side: msg.side,
          remaining_size: msg.remaining_size,
        };
      case "match":
        return {
          exchange: "GDAX",
          base: market.base,
          quote: market.quote,
          type: msg.type,
          trade_id: msg.trade_id,
          sequence: msg.sequence,
          maker_order_id: msg.maker_order_id.replace(/-/g, ""),
          taker_order_id: msg.taker_order_id.replace(/-/g, ""),
          time,
          size: msg.size,
          price: msg.price,
          side: msg.side,
        };
      case "change":
        return {
          exchange: "GDAX",
          base: market.base,
          quote: market.quote,
          type: msg.type,
          time,
          sequence: msg.sequence,
          order_id: msg.order_id.replace(/-/g, ""),
          new_size: msg.new_size,
          old_size: msg.old_size,
          price: msg.price,
          side: msg.side,
          new_funds: msg.new_funds,
          old_funds: msg.old_funds,
        };
    }
  }
}

module.exports = GdaxClient;
