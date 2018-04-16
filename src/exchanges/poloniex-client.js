const BasicClient = require("../basic-client");
const Trade = require("../trade");

class PoloniexClient extends BasicClient {
  constructor() {
    super("wss://api2.poloniex.com/", "Poloniex");
    this._idMap = new Map();
  }

  _sendSubscribe(remote_id) {
    this._wss.send(
      JSON.stringify({
        command: "subscribe",
        channel: remote_id,
      })
    );
  }

  _sendUnsubscribe(remote_id) {
    this._wss.send(
      JSON.stringify({
        command: "unsubscribe",
        channel: remote_id,
      })
    );
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);
    let id = msg[0];
    let updates = msg[2];
    if (!updates) return;

    for (let update of updates) {
      switch (update[0]) {
        // when connection is first established it will send an 'info' packet
        // that can be used to map the "id" to the market_symbol
        case "i": {
          let remote_id = update[1].currencyPair;
          this._idMap.set(id, remote_id);
          break;
        }
        // trade events will stream-in after we are subscribed to the channel
        // and hopefully after the info packet has been sent
        case "t": {
          let trade = this._constructTradeFromMessage(id, update);
          this.emit("trade", trade);
          break;
        }
      }
    }
  }

  _constructTradeFromMessage(id, update) {
    let [, trade_id, side, price, size, unix] = update;

    // figure out the market symbol
    let remote_id = this._idMap.get(id);
    if (!remote_id) return;

    let market = this._subscriptions.get(remote_id);

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
}

module.exports = PoloniexClient;
