const semaphore = require("semaphore");
const BasicClient = require("../basic-client");
const Trade = require("../trade");

class OKExClient extends BasicClient {
  constructor() {
    super("wss://real.okex.com:10441/websocket", "OKEx");
    this._pingInterval = setInterval(this._sendPing.bind(this), 30000);
    this._sem = semaphore(10);
  }

  _sendPing() {
    if (this._wss) {
      this._wss.send(JSON.stringify({ event: "ping" }));
    }
  }

  _sendSubscribe(remote_id) {
    this._sem.take(() => {
      let [base, quote] = remote_id.split("_");
      this._wss.send(
        JSON.stringify({
          event: "addChannel",
          parameters: { base, binary: "0", product: "spot", quote, type: "deal" },
        })
      );
    });
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
    /*
    [{ base: '1st',
      binary: 0,
      channel: 'addChannel',
      data: { result: true },
      product: 'spot',
      quote: 'btc',
      type: 'deal' },
    { base: '1st',
      binary: 0,
      data:
      [ { amount: '818.619',
          side: 1,
          createdDate: 1527013680457,
          price: '0.00003803',
          id: 4979071 },
      ],
      product: 'spot',
      quote: 'btc',
      type: 'deal' }]
    */
    let msgs = JSON.parse(raw);
    if (!Array.isArray(msgs)) return;
    for (let msg of msgs) {
      if (msg.product === "spot" && msg.type === "deal") {
        if (msg.data.result) {
          this._sem.leave();
          continue;
        }
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

module.exports = OKExClient;
