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

  _onMessage(raw) {
    let msg = JSON.parse(raw);
    if (msg.type !== "match") return;

    let trade = this._constructTradeFromMessage(msg);
    this.emit("trade", trade);
  }

  _constructTradeFromMessage(msg) {
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
}

module.exports = GdaxClient;
