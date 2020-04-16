const BasicClient = require("../basic-client");
const Trade = require("../trade");

/**
 * Liquid client as implemented by:
 * https://developers.liquid.com/#public-channels
 */
class LiquidClient extends BasicClient {
  constructor() {
    super();

    this._name = "Liquid";
    this._wssPath = "wss://tap.liquid.com/app/LiquidTapClient";
    this.requestSnapshot = false;
    this.hasTrades = true;
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "pusher:subscribe",
        data: {
          channel: `executions_cash_${remote_id.toLowerCase()}`,
        },
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "pusher:unsubscribe",
        data: {
          channel: `executions_cash_${remote_id.toLowerCase()}`,
        },
      })
    );
  }

  /////////////////////////////////////////////

  _onMessage(raw) {
    try {
      var msg = JSON.parse(raw);
    } catch (e) {
      this.emit("error", e);
      return;
    }

    // success messages look like:
    // {
    //   channel: 'executions_cash_btcjpy',
    //   data: {},
    //   event: 'pusher_internal:subscription_succeeded'
    // }

    if (msg.channel) {
      if (msg.channel.startsWith("executions_cash_") != -1) {
        this._onTrade(msg);
        return;
      }
    }
  }

  /**
   * Trade message in the format:
   * {
   *   channel: 'executions_cash_btcjpy',
   *   data: '{"created_at":1587056568,"id":297058474,"price":757584.0,"quantity":0.178,"taker_side":"sell"}',
   *   event: 'created'
   * }
   */
  _onTrade(msg) {
    try {
      var data = JSON.parse(msg.data);
    } catch (e) {
      return;
    }

    let remote_id = msg.channel.substr(msg.channel.lastIndexOf("_") + 1);

    let market = this._tradeSubs.get(remote_id);
    if (!market) return;

    let trade = new Trade({
      exchange: "Liquid",
      base: market.base,
      quote: market.quote,
      tradeId: data.id.toFixed(),
      unix: parseInt(data.created_at) * 1000,
      side: data.taker_side == "buy" ? "buy" : "sell",
      price: data.price.toFixed(),
      amount: data.quantity.toFixed(),
      buyOrderId: undefined,
      sellOrderId: undefined,
    });

    this.emit("trade", trade, market);
  }
}

module.exports = LiquidClient;
