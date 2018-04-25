const moment = require("moment");
const semaphore = require("semaphore");
const BasicClient = require("../basic-client");
const Trade = require("../trade");

class HitBTCClient extends BasicClient {
  constructor() {
    super("wss://api.hitbtc.com/api/2/ws", "HitBTC");
    this._id = 0;
    this._sem = semaphore(10);
  }

  _sendSubscribe(remote_id) {
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

  _sendUnsubscribe(remote_id) {
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
