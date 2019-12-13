const semaphore = require("semaphore");
const { wait } = require("../util");
const https = require("../https");
const BasicClient = require("../basic-client");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");

class LiquidClient extends BasicClient {

  constructor() {
    super();

    this._name = "Liquid";
    this._wssPath = "wss://tap.liquid.com/app/LiquidTapClient";
    this.requestSnapshot = false;
    this.hasTrades = true;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = false;
  }

  //executions_cash_ channel ID's for liquid are all lowercase, e.g. "btyjpy"

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "pusher:subscribe",
        data: {
          channel: `executions_cash_${remote_id.toLowerCase()}`,
        }
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "pusher:unsubscribe",
        data: {
          channel: `executions_cash_${remote_id.toLowerCase()}`,
        }
      })
    );
  }

  /////////////////////////////////////////////

  _onMessage(raw) {
    try{
      var msg = JSON.parse(raw);
    }
    catch(e){
      return;
    }

    if(msg.channel){
      if(msg.channel.startsWith("executions_cash_") != -1){
        this._onTrade(msg);
        return;
      }
    }
  }

  _onTrade(msg) {
    try{
      var data = JSON.parse(msg.data);
    }
    catch(e){
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
      unix: parseInt(data.created_at),
      side: data.taker_side == "buy" ? "buy" : "sell",
      price: data.price,
      amount: data.quantity,
      buyOrderId: undefined,
      sellOrderId: undefined
    });

    this.emit("trade", trade, market);
  }
}

module.exports = LiquidClient;