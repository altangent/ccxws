const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");
const Level3Point = require("../level3-point");
const Level3Snapshot = require("../level3-snapshot");
const Level3Update = require("../level3-update");

class BitfinexClient extends BasicClient {
  /**
   *
   * @param {Object} params
   * @param {Boolean} [params.enableEmptyHeartbeatEvents]       (optional, default false). if true, emits empty events for all channels on heartbeat events which includes the sequenceId.
   * @param {String} [params.tradeMessageType]                  (optional, defaults to "tu"). one of "tu", "te", or "all". determines whether to use trade channel events of type "te" or "tu", or all trade events. see https://blog.bitfinex.com/api/websocket-api-update/.
   *                                                            if you're using sequenceIds to validate websocket messages you will want to use "all" to receive every sequenceId
   */
  constructor({
    wssPath = "wss://api.bitfinex.com/ws/2",
    watcherMs,
    l2UpdateDepth = 250,
    enableEmptyHeartbeatEvents = false,
    tradeMessageType = "tu",
  } = {}) {
    super(wssPath, "Bitfinex", undefined, watcherMs);
    this._channels = {};

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Updates = true;
    this.hasLevel3Updates = true;
    this.l2UpdateDepth = l2UpdateDepth;
    this.enableEmptyHeartbeatEvents = enableEmptyHeartbeatEvents;
    this.tradeMessageType = tradeMessageType; // "te", "tu", or "all"
  }

  _onConnected() {
    // immediately send the config event to include sequence IDs in every message
    this._sendConfiguration();
    super._onConnected();
  }

  _sendConfiguration() {
    // see docs for "conf" flags. https://docs.bitfinex.com/docs/ws-general#configuration
    // combine multiple flags by summing their values
    // 65536 adds a sequence ID to each message
    // 32768 adds a Timestamp in milliseconds to each received event
    // 131072 Enable checksum for every book iteration. Checks the top 25 entries for each side of book. Checksum is a signed int. more info https://docs.bitfinex.com/docs/ws-websocket-checksum. it's sent in its own
    // separate event so we've disabled it
    this._wss.send(JSON.stringify({ event: "conf", flags: 65536 + 32768 }));
  }

  _sendSubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "subscribe",
        channel: "ticker",
        pair: remote_id,
      })
    );
  }

  _sendUnsubTicker(remote_id) {
    let chanId = this._findChannel("ticker", remote_id);
    this._sendUnsubscribe(chanId);
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "subscribe",
        channel: "trades",
        pair: remote_id,
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    let chanId = this._findChannel("trades", remote_id);
    this._sendUnsubscribe(chanId);
  }

  _sendSubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "subscribe",
        channel: "book",
        pair: remote_id,
        len: String(this.l2UpdateDepth), // len must be of type string, even though it's a number
      })
    );
  }

  _sendUnsubLevel2Updates(remote_id) {
    let chanId = this._findChannel("level2updates", remote_id);
    this._sendUnsubscribe(chanId);
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

  _sendUnsubLevel3Updates(remote_id) {
    let chanId = this._findChannel("level3updates", remote_id);
    this._sendUnsubscribe(chanId);
  }

  _sendUnsubscribe(chanId) {
    if (chanId) {
      this._wss.send(
        JSON.stringify({
          event: "unsubscribe",
          chanId: chanId,
        })
      );
    }
  }

  _findChannel(type, remote_id) {
    for (let chan of Object.values(this._channels)) {
      if (chan.pair === remote_id) {
        if (type === "trades" && chan.channel === "trades") return chan.chanId;
        if (type === "level2updates" && chan.channel === "book" && chan.prec !== "R0")
          return chan.chanId;
        if (type === "level3updates" && chan.channel === "book" && chan.prec === "R0")
          return chan.chanId;
      }
    }
  }
  _onHeartbeatMessage(msg, channel) {
    if (channel.channel === "ticker") {
      let market = this._tickerSubs.get(channel.pair);
      if (!market) return;

      this._onTickerHeartbeat(msg, market);
      return;
    }

    // trades
    if (channel.channel === "trades") {
      let market = this._tradeSubs.get(channel.pair);
      if (!market) return;

      this._onTradeMessageHeartbeat(msg, market);
      return;
    }

    // level3
    if (channel.channel === "book" && channel.prec === "R0") {
      let market = this._level3UpdateSubs.get(channel.pair);
      if (!market) return;

      if (Array.isArray(msg[1][0])) this._onLevel3Snapshot(msg, market);
      else this._onLevel3Update(msg, market);
      return;
    }

    // level2
    if (channel.channel === "book") {
      let market = this._level2UpdateSubs.get(channel.pair);
      if (!market) return;
      if (Array.isArray(msg[1][0])) this._onLevel2Snapshot(msg, market);
      else this._onLevel2Update(msg, market);
      return;
    }
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);
    // capture channel metadata
    if (msg.event === "subscribed") {
      this._channels[msg.chanId] = msg;
      return;
    }

    // lookup channel
    let channel = this._channels[msg[0]];
    if (!channel) return;

    // handle heartbeats
    if (msg[1 === "hb"]) {
      this._onHeartbeatMessage(msg, market);
      return;
    }

    if (channel.channel === "ticker") {
      let market = this._tickerSubs.get(channel.pair);
      if (!market) return;

      this._onTicker(msg, market);
      return;
    }

    // trades
    if (channel.channel === "trades") {
      let market = this._tradeSubs.get(channel.pair);
      if (!market) return;
      // handle tradeMessageType (constructor param) filtering
      // example trade update msg: [ 359491, 'tu' or 'te', [ 560287312, 1609712228656, 0.005, 33432 ], 6 ]
      // note: "tu" means it's got the tradeId, this is delayed by 1-2 seconds and includes tradeId.
      // "te" is the same but available immediately and without the tradeId
      let shouldHandleTradeEvent = false;
      const tradeEventType = msg[1];
      if (this.tradeMessageType === "all") {
        shouldHandleTradeEvent = true;
      } else if (this.tradeMessageType === "te" && tradeEventType === "te") {
        shouldHandleTradeEvent = true;
      } else if (this.tradeMessageType === "tu" && tradeEventType === "tu") {
        shouldHandleTradeEvent = true;
      }
      if (!shouldHandleTradeEvent) {
        return;
      }

      this._onTradeMessage(msg, market);
      return;
    }

    // level3
    if (channel.channel === "book" && channel.prec === "R0") {
      let market = this._level3UpdateSubs.get(channel.pair);
      if (!market) return;

      if (Array.isArray(msg[1][0])) this._onLevel3Snapshot(msg, market);
      else this._onLevel3Update(msg, market);
      return;
    }

    // level2
    if (channel.channel === "book") {
      let market = this._level2UpdateSubs.get(channel.pair);
      if (!market) return;
      if (Array.isArray(msg[1][0])) this._onLevel2Snapshot(msg, market);
      else this._onLevel2Update(msg, market);
      return;
    }
  }
  
  _onTickerHeartbeat(msg, market) {
    const sequenceId = Number(msg[2]);
    const timestampMs = msg[3];
    if (this.enableEmptyHeartbeatEvents === false) return;
      // handle heartbeat by emitting empty update w/sequenceId.
      // heartbeat msg: [ 198655, 'hb', 3, 1610920929093 ]
      let ticker = new Ticker({
        exchange: "Bitfinex",
        base: market.base,
        quote: market.quote,
        timestamp: timestampMs,
        sequenceId,
      });
      this.emit("ticker", ticker, market);
      return;
  }

  _onTicker(msg, market) {
    const sequenceId = Number(msg[2]);
    const timestampMs = msg[3];
    let msgBody = msg[1];
    let [bid, bidSize, ask, askSize, change, changePercent, last, volume, high, low] = msgBody;
    let open = last + change;
    let ticker = new Ticker({
      exchange: "Bitfinex",
      base: market.base,
      quote: market.quote,
      timestamp: timestampMs,
      sequenceId,
      last: last.toFixed(8),
      open: open.toFixed(8),
      high: high.toFixed(8),
      low: low.toFixed(8),
      volume: volume.toFixed(8),
      change: change.toFixed(8),
      changePercent: changePercent.toFixed(2),
      bid: bid.toFixed(8),
      bidVolume: bidSize.toFixed(8),
      ask: ask.toFixed(8),
      askVolume: askSize.toFixed(8),
    });
    this.emit("ticker", ticker, market);
  }

  _onTradeMessageHeartbeat(msg, market) {
    const timestampMs = msg[3];
    const sequenceId = Number(msg[2]);
    if (this.enableEmptyHeartbeatEvents === false) return;
    // handle heartbeat by emitting empty update w/sequenceId.
    // example trade heartbeat msg: [ 198655, 'hb', 3, 1610920929093 ]
    let trade = new Trade({
      exchange: "Bitfinex",
      base: market.base,
      quote: market.quote,
      timestamp: timestampMs,
      sequenceId,
    });
    this.emit("trade", trade, market);
    return;
  }

  _onTradeMessage(msg, market) {
    if (Array.isArray(msg[1])) {
      // handle the initial trades snapshot
      // trade snapshot example msg:
      /*
      [
        CHANNEL_ID,
        [
          [
            ID,
            MTS,
            AMOUNT,
            PRICE
          ],
          ...
        ],
        sequenceId,
        timestampMs
      ]
      */
     const sequenceId = Number(msg[2]);
      msg[1].forEach(thisTrade => {
        let [id, unix, amount, price] = thisTrade;

        let side = amount > 0 ? "buy" : "sell";
        price = price.toFixed(8);
        amount = Math.abs(amount).toFixed(8);
        let trade = new Trade({
          exchange: "Bitfinex",
          base: market.base,
          quote: market.quote,
          tradeId: id.toFixed(),
          sequenceId,
          unix: unix,
          side,
          price,
          amount,
        });
        this.emit("trade", trade, market);
      });
      return;
    }
    const sequenceId = Number(msg[3]);
    let [id, unix, amount, price] = msg[2];

    let side = amount > 0 ? "buy" : "sell";
    price = price.toFixed(8);
    amount = Math.abs(amount).toFixed(8);
    let trade = new Trade({
      exchange: "Bitfinex",
      base: market.base,
      quote: market.quote,
      tradeId: id.toFixed(),
      sequenceId,
      unix: unix,
      side,
      price,
      amount,
    });
    this.emit("trade", trade, market);
  }

  _onLevel2Snapshot(msg, market) {
    /*
    example msg:
      [
        646750,
        [
          [ 31115, 1, 1 ],
          [ 31114, 1, 0.31589592 ],
          ...
        ],
        1,
        1609794291015
      ]
  */
    let bids = [];
    let asks = [];
    const sequenceId = Number(msg[2]);
    const timestampMs = msg[3];
    for (let [price, count, size] of msg[1]) {
      let isBid = size > 0;
      let result = new Level2Point(price.toFixed(8), Math.abs(size).toFixed(8), count.toFixed(0));
      if (isBid) bids.push(result);
      else asks.push(result);
    }
    let result = new Level2Snapshot({
      exchange: "Bitfinex",
      base: market.base,
      quote: market.quote,
      sequenceId,
      timestampMs,
      bids,
      asks,
    });
    this.emit("l2snapshot", result, market);
  }

  _onLevel2UpdateHeartbeat(msg, market) {
    // example msg: [ 646750, [ 30927, 5, 0.0908 ], 19, 1609794565952 ]
    const sequenceId = Number(msg[2]);
    const timestampMs = msg[3];
    // handle heartbeat by emitting empty update w/sequenceId.
    // heartbeat msg: [ 169546, 'hb', 17, 1610921150321 ]
    // NOTE: for order book updates we don't check if enableEmptyHeartbeatEvents === true, because
    // an empty l2 update is 100% backward compatible so no harm done in emitting it
    let update = new Level2Update({
      exchange: "Bitfinex",
      base: market.base,
      quote: market.quote,
      sequenceId,
      timestampMs,
      asks: [],
      bids: [],
    });
    this.emit("l2update", update, market);
    return;
  }

  _onLevel2Update(msg, market) {
    // example msg: [ 646750, [ 30927, 5, 0.0908 ], 19, 1609794565952 ]
    let [price, count, size] = msg[1];
    const sequenceId = Number(msg[2]);
    const timestampMs = msg[3];

    if (!price.toFixed) return;
    let point = new Level2Point(price.toFixed(8), Math.abs(size).toFixed(8), count.toFixed(0));
    let asks = [];
    let bids = [];

    let isBid = size > 0;
    if (isBid) bids.push(point);
    else asks.push(point);

    let isDelete = count === 0;
    if (isDelete) point.size = (0).toFixed(8); // reset the size to 0, comes in as 1 or -1 to indicate bid/ask
    let update = new Level2Update({
      exchange: "Bitfinex",
      base: market.base,
      quote: market.quote,
      sequenceId,
      timestampMs,
      asks,
      bids,
    });
    this.emit("l2update", update, market);
  }

  _onLevel3Snapshot(msg, market) {
    /*
    example msg:
    [
      648087,
      [
        [ 55888179267, 31111, 0.05 ],
        [ 55895806791, 31111, 0.989 ],
        ...
      ],
      1,
      1609794565952
    ]
    */
    let bids = [];
    let asks = [];

    let orders = msg[1];
    const sequenceId = Number(msg[2]);
    const timestampMs = msg[3];

    for (let [orderId, price, size] of orders) {
      let point = new Level3Point(orderId.toFixed(), price.toFixed(8), Math.abs(size).toFixed(8));
      if (size > 0) bids.push(point);
      else asks.push(point);
    }
    let result = new Level3Snapshot({
      exchange: "Bitfinex",
      base: market.base,
      quote: market.quote,
      sequenceId,
      timestampMs,
      asks,
      bids,
    });
    this.emit("l3snapshot", result, market);
  }

  _onLevel3Update(msg, market) {
    // example msg: [ 648087, [ 55895794256, 31107, 0.07799627 ], 4, 1609794565952 ]
    let bids = [];
    let asks = [];

    let [orderId, price, size] = msg[1];
    const sequenceId = Number(msg[2]);
    const timestampMs = msg[3];

    if (msg[1] === "hb") {
      // handle heartbeat by emitting empty update w/sequenceId.
      // heartbeat msg: [ 169546, 'hb', 17, 1610921150321 ]
      // NOTE: for order book updates we don't check if enableEmptyHeartbeatEvents === true, because
      // an empty l3 update is 100% backward compatible so no harm done in emitting it
      let result = new Level3Update({
        exchange: "Bitfinex",
        base: market.base,
        quote: market.quote,
        sequenceId,
        timestampMs,
        asks: [],
        bids: [],
      });
      this.emit("l3update", result, market);
      return;
    }

    let point = new Level3Point(orderId.toFixed(), price.toFixed(8), Math.abs(size).toFixed(8));
    if (size > 0) bids.push(point);
    else asks.push(point);

    let result = new Level3Update({
      exchange: "Bitfinex",
      base: market.base,
      quote: market.quote,
      sequenceId,
      timestampMs,
      asks,
      bids,
    });
    this.emit("l3update", result, market);
  }
}

module.exports = BitfinexClient;
