const BasicClient = require("../basic-client");
const Trade = require("../trade");
const zlib = require('zlib');
const winston = require("winston");

class HuobiClient extends BasicClient {
  constructor() {
    super("wss://api.huobi.pro/ws", "Huobi");
  }

  _sendSubscribe(remote_id) {
    this._wss.send(
      JSON.stringify({
        sub: `market.${remote_id}.trade.detail`,
        id: ''
      })
    );
  }

  _sendUnsubscribe(remote_id) {
    this._wss.send(
      JSON.stringify({
        unsub: `market.${remote_id}.trade.detail`,
        id: ''
      })
    );
  }

  _onMessage(raw) {
    zlib.unzip(raw, (err, resp) => {
      if(err) {
        winston.error(err);
        return;
      }

      let msgs = JSON.parse(resp);
      if(!msgs.ch || !msgs.ch.includes('trade.detail')) return;

      let remoteId = msgs.ch.split('.')[1]; //market.ethbtc.trade.detail
      for(let datum of msgs.tick.data) {
        let trade = this._constructTradesFromMessage(remoteId, datum);
        this.emit("trade", trade);
      }
    });
  }

  _constructTradesFromMessage(remoteId, datum) {
    let { amount, direction, ts, price, id } = datum;
    let market = this._subscriptions.get(remoteId);

    amount = direction === "sell" ? -parseFloat(amount) : parseFloat(amount);
    let priceNum = parseFloat(price);
    let unix = Math.floor(ts / 1000);

    return new Trade({
      exchange: "Huobi",
      base: market.base,
      quote: market.quote,
      tradeId: id,
      unix,
      price: priceNum,
      amount,
    });
  }
}

module.exports = HuobiClient;
