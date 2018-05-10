const BasicClient = require("../basic-client");
const Trade = require("../trade");

class HitBTCClient extends BasicClient {
  constructor() {
    super("wss://real.okex.com:10441/websocket", "HitBTC");
    this.channelRegExp = /ok_sub_spot_(.*)_deals/;
    this._pingInterval = setInterval(this._sendPing.bind(this));
  }

  _sendPing() {
    if (this._wss) {
      this._wss.send(JSON.stringify({ event: "ping" }));
    }
  }

  _sendSubscribe(remote_id) {
    let [base, quote] = remote_id.split("_");
    this._wss.send(
      JSON.stringify({
        event: "addChannel",
        parameters: { base, binary: "0", product: "spot", quote, type: "deal" },
      })
    );
  }

  _sendUnsubscribe(remote_id) {
    let [base, quote] = remote_id.split("_");
    this._wss.send(
      JSON.stringify({
        event: "removeChannel",
        parameters: { base, binary: "0", product: "spot", quote, type: "deal" },
      })
    );
  }

  _onMessage(raw) {
    let msgs = JSON.parse(raw);
    if (!Array.isArray(msgs)) return;
    for (let msg of msgs) {
      if (msg.product === "spot" && msg.type === "deal") {
        if (!Array.isArray(msg.data)) return; // handle confirmation
        let { base, quote } = msg;
        let remote_id = `${base}_${quote}`;
        for (let datum of msg.data) {
          let trade = this._constructTradesFromMessage(remote_id, datum);
          this.emit("trade", trade);
        }
      }
    }
  }

  _constructTradesFromMessage(remoteId, datum) {
    let { amount, side, createdDate, price, id } = datum;
    let market = this._subscriptions.get(remoteId);

    amount = side === "2" ? -parseFloat(amount) : parseFloat(amount);
    let priceNum = parseFloat(price);
    let unix = Math.floor(createdDate / 1000);

    return new Trade({
      exchange: "OKEx",
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
