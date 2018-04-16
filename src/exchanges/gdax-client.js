const moment = require("moment");
const BasicClient = require("../basic-client");

class GdaxClient extends BasicClient {
  constructor() {
    super("wss://ws-feed.gdax.com", "GDAX");
  }

  _sendSubscribe(remote_id) {
    this._wss.send(
      JSON.stringify({
        type: "subscribe",
        product_ids: [remote_id],
        channels: ["matches"]
      })
    );
  }

  _sendUnsubscribe(remote_id) {
    this._wss.send(
      JSON.stringify({
        type: "unsubscribe",
        product_ids: [remote_id],
        channels: ["matches"]
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

    // create tradingpair
    let tradingpair = this._subscriptions.get(product_id);
    let tradingPairSymbol = `GDAX:${tradingpair.base_symbol}/${tradingpair.quote_symbol}`;

    let unix = moment.utc(time).unix();
    let amount = side === "sell" ? -parseFloat(size) : parseFloat(size);
    let priceNum = parseFloat(price);

    return [tradingPairSymbol, trade_id, unix, priceNum, amount];
  }
}

module.exports = GdaxClient;
