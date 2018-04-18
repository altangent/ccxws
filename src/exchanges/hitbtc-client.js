const moment = require("moment");
const BasicClient = require("../basic-client");
const Trade = require("../trade");

class HitBTCClient extends BasicClient {
  constructor() {
    super("wss://api.hitbtc.com/api/2/ws", "HitBTC");
  }

  _sendSubscribe(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "subscribeTrades",
        params: {
          symbol: remote_id,
        },
      })
    );
  }

  _sendUnsubscribe(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "unsubscribeTrades",
        params: {
          symbol: remote_id,
        },
      })
    );
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);
    if (msg.method === "updateTrades") {
      for (let datum of msg.params.data) {
        datum.symbol = msg.params.symbol;
        let trade = this._constructTradesFromMessage(datum);
        this.emit("trade", trade);
      }
    }
  }

  _constructTradesFromMessage(datum) {
    let { symbol, id, price, quantity, side, timestamp } = datum;

    let market = this._subscriptions.get(symbol);

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
}

module.exports = HitBTCClient;
