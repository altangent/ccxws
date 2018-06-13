const BasicClient = require("../basic-client");
const Trade = require("../trade");

class BitfinexClient extends BasicClient {
  constructor() {
    super("wss://api.bitfinex.com/ws", "Bitfinex");
    this._chanIds = {};

    this.hasTrades = true;
    this.hasLevel2Spotshots = false;
    this.hasLevel2Updates = true;
    this.hasLevel3Updates = true;
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

  _sendSubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "subscribe",
        channel: "book",
        pair: remote_id,
        length: "100",
      })
    );
  }

  _sendSubLevel3Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "subscribe",
        channel: "book",
        pair: remote_id,
        prec: "R0",
        length: "100",
      })
    );
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);

    // capture channel metadata
    if (msg.event === "subscribed") {
      this._chanIds[msg.chanId] = msg;
      return;
    }

    // lookup channel
    let channel = this._chanIds[msg[0]];
    if (!channel) return;

    // trades
    if (channel.channel === "trades" && msg[1] === "tu") {
      this._onTradeMessage(msg, channel);
      return;
    }

    // level3
    if (channel.channel === "book" && channel.prec === "R0") {
      if (Array.isArray(msg[1])) this._onLevel3Snapshot(msg, channel);
      else this._onLevel3Update(msg, channel);
      return;
    }

    // level2
    if (channel.channel === "book") {
      if (Array.isArray(msg[1])) this._onLevel2Snapshot(msg, channel);
      else this._onLevel2Update(msg, channel);
      return;
    }
  }

  _onTradeMessage(msg) {
    let [chanId, , , id, unix, price, amount] = msg;
    let remote_id = this._chanIds[chanId].pair;
    let market = this._tradeSubs.get(remote_id);

    let trade = new Trade({
      exchange: "Bitfinex",
      base: market.base,
      quote: market.quote,
      tradeId: id,
      unix,
      price,
      amount,
    });
    this.emit("trade", trade);
  }

  _onLevel2Snapshot(msg) {
    let remote_id = this._chanIds[msg[0]].pair;
    let market = this._level2UpdateSubs.get(remote_id); // this message will be coming from an l2update
    let bids = [];
    let asks = [];
    for (let val of msg[1]) {
      let result = {
        price: val[0],
        size: Math.abs(val[2]),
        count: val[1],
      };
      if (val[2] > 0) bids.push(result);
      else asks.push(result);
    }
    let result = {
      exchange: "Bitfinex",
      base: market.base,
      quote: market.quote,
      bids,
      asks,
    };
    this.emit("l2snapshot", result);
  }

  _onLevel2Update(msg) {
    let remote_id = this._chanIds[msg[0]].pair;
    let market = this._level2UpdateSubs.get(remote_id);
    let update = {
      exchange: "Bitfinex",
      base: market.base,
      quote: market.quote,
      price: msg[1],
      size: Math.abs(msg[3]),
      side: msg[3] > 0 ? "bid" : "ask",
      count: msg[2],
    };
    this.emit("l2update", update);
  }

  _onLevel3Snapshot(msg, channel) {
    let remote_id = channel.pair;
    let market = this._level3UpdateSubs.get(remote_id); // this message will be coming from an l2update
    let results = msg[1].map(p => ({
      order_id: p[0],
      side: p[2] > 0 ? "bid" : "ask",
      price: p[1],
      size: Math.abs(p[2]),
    }));
    let result = {
      exchange: "Bitfinex",
      base: market.base,
      quote: market.quote,
      changes: results,
    };
    this.emit("l3snapshot", result);
  }

  _onLevel3Update(msg, channel) {
    let remote_id = channel.pair;
    let market = this._level3UpdateSubs.get(remote_id);
    let result = {
      exchange: "Bitfinex",
      base: market.base,
      quote: market.quote,
      order_id: msg[1],
      side: msg[3] > 0 ? "bid" : "ask",
      price: msg[2],
      size: Math.abs(msg[3]),
    };
    this.emit("l3update", result);
  }
}

module.exports = BitfinexClient;
