const BasicClient = require("../basic-client");
const Trade = require("../trade");

class BitfinexClient extends BasicClient {
  constructor() {
    super("wss://api.bitfinex.com/ws", "Bitfinex");
    this._chanIds = {};
  }

  _sendSubscribe(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "subscribe",
        channel: "trades",
        pair: remote_id,
      })
    );
  }

  _sendUnsubscribe(remote_id) {
    let chanId = this._chanIds[remote_id];
    if (chanId) {
      this._wss.send(
        JSON.stringify({
          event: "unsubscribe",
          chanId: chanId,
        })
      );
    }
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);
    this._onTradeMessage(msg);
    this._onSubscribeEventMessage(msg);
  }

  _onTradeMessage(msg) {
    if (msg[1] !== "tu") return;

    let trade = this._constructTradeFromMessage(msg);
    this.emit("trade", trade);
  }

  _onSubscribeEventMessage(msg) {
    if (msg.event !== "subscribed") return;

    let { chanId, pair } = msg;
    this._chanIds[pair] = chanId;
  }

  _constructTradeFromMessage(msg) {
    // eslint-disable-next-line no-unused-vars
    let [status, instr, sequence, id, unix, price, amount] = msg;
    let remote_id = sequence.split("-")[1];
    let market = this._subscriptions.get(remote_id);

    return new Trade({
      exchange: "Bitfinex",
      base: market.base,
      quote: market.quote,
      tradeId: id,
      unix,
      price,
      amount,
    });
  }
}

module.exports = BitfinexClient;
