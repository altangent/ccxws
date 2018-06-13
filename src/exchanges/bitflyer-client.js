const BasicClient = require("../basic-client");
const Trade = require("../trade");
const moment = require("moment");

class BitFlyerClient extends BasicClient {
  constructor() {
    super("wss://ws.lightstream.bitflyer.com/json-rpc", "BitFlyer");
  }

  _sendSubTrade(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "subscribe",
        params: {
          channel: `lightning_executions_${remote_id}`,
        },
      })
    );
  }

  _sendUnsubTrade(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "unsubscribe",
        params: {
          channel: `lightning_executions_${remote_id}`,
        },
      })
    );
  }

  _onMessage(data) {
    let parsed = JSON.parse(data);
    if (parsed.params && parsed.params.channel && parsed.params.message) {
      let channelParts = parsed.params.channel.split("_"); //lightning_executions_BTC_JPY
      let remoteId = `${channelParts[2]}_${channelParts[3]}`;
      for (let datum of parsed.params.message) {
        let trade = this._constructTradesFromMessage(remoteId, datum);
        this.emit("trade", trade);
      }
    }
  }

  _constructTradesFromMessage(remoteId, datum) {
    let { size, side, exec_date, price, id } = datum;
    let market = this._tradeSubs.get(remoteId);

    size = side === "BUY" ? parseFloat(size) : -parseFloat(size);
    let priceNum = parseFloat(price);
    let unix = moment(exec_date).unix();

    return new Trade({
      exchange: "BitFlyer",
      base: market.base,
      quote: market.quote,
      tradeId: id,
      unix,
      price: priceNum,
      amount: size,
    });
  }
}

module.exports = BitFlyerClient;
