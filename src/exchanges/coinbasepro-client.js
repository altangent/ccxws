const moment = require("moment");
const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");
const Level3Point = require("../level3-point");
const Level3Update = require("../level3-update");

class CoinbaseProClient extends BasicClient {
  constructor({ wssPath = "wss://ws-feed.pro.coinbase.com", watcherMs } = {}) {
    super(wssPath, "CoinbasePro", undefined, watcherMs);
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Spotshots = false;
    this.hasLevel2Updates = true;
    this.hasLevel3Updates = true;
  }

  _sendSubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        type: "subscribe",
        product_ids: [remote_id],
        channels: ["ticker"],
      })
    );
  }

  _sendUnsubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        type: "unsubscribe",
        product_ids: [remote_id],
        channels: ["ticker"],
      })
    );
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        type: "subscribe",
        product_ids: [remote_id],
        channels: ["matches"],
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        type: "unsubscribe",
        product_ids: [remote_id],
        channels: ["matches"],
      })
    );
  }

  _sendSubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        type: "subscribe",
        product_ids: [remote_id],
        channels: ["level2"],
      })
    );
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        type: "unsubscribe",
        product_ids: [remote_id],
        channels: ["level2"],
      })
    );
  }

  _sendSubLevel3Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        type: "subscribe",
        product_ids: [remote_id],
        channels: ["full"],
      })
    );
  }

  _sendUnsubLevel3Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        type: "unsubscribe",
        product_ids: [remote_id],
        channels: ["full"],
      })
    );
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);

    let { type, product_id } = msg;

    if (type === "ticker" && this._tickerSubs.has(product_id)) {
      let market = this._tickerSubs.get(product_id);
      let ticker = this._constructTicker(msg, market);
      this.emit("ticker", ticker, market);
    }

    if (type === "match" && this._tradeSubs.has(product_id)) {
      let market = this._tradeSubs.get(product_id);
      let trade = this._constructTrade(msg, market);
      this.emit("trade", trade, market);
    }

    if (type === "snapshot" && this._level2UpdateSubs.has(product_id)) {
      let market = this._level2UpdateSubs.get(product_id);
      let snapshot = this._constructLevel2Snapshot(msg, market);
      this.emit("l2snapshot", snapshot, market);
    }

    if (type === "l2update" && this._level2UpdateSubs.has(product_id)) {
      let market = this._level2UpdateSubs.get(product_id);
      let update = this._constructLevel2Update(msg, market);
      this.emit("l2update", update, market);
    }

    if (
      ["received", "open", "done", "match", "change"].includes(type) &&
      this._level3UpdateSubs.has(product_id)
    ) {
      let market = this._level3UpdateSubs.get(product_id);
      let update = this._constructLevel3Update(msg, market);
      this.emit("l3update", update, market);
      return;
    }
  }

  _constructTicker(msg, market) {
    let { price, volume_24h, open_24h, low_24h, high_24h, best_bid, best_ask, time } = msg;
    let change = parseFloat(price) - parseFloat(open_24h);
    let changePercent = ((parseFloat(price) - parseFloat(open_24h)) / parseFloat(open_24h)) * 100;
    return new Ticker({
      exchange: "CoinbasePro",
      base: market.base,
      quote: market.quote,
      timestamp: moment.utc(time).valueOf(),
      last: price,
      open: open_24h,
      high: high_24h,
      low: low_24h,
      volume: volume_24h,
      change: change.toFixed(8),
      changePercent: changePercent.toFixed(8),
      bid: best_bid,
      ask: best_ask,
    });
  }

  _constructTrade(msg, market) {
    let { trade_id, time, size, price, side, maker_order_id, taker_order_id } = msg;

    let unix = moment.utc(time).valueOf();

    maker_order_id = maker_order_id.replace(/-/g, "");
    taker_order_id = taker_order_id.replace(/-/g, "");

    let buyOrderId = side === "buy" ? maker_order_id : taker_order_id;
    let sellOrderId = side === "sell" ? maker_order_id : taker_order_id;

    return new Trade({
      exchange: "CoinbasePro",
      base: market.base,
      quote: market.quote,
      tradeId: trade_id.toFixed(),
      unix,
      side,
      price,
      amount: size,
      buyOrderId,
      sellOrderId,
    });
  }

  _constructLevel2Snapshot(msg, market) {
    let { bids, asks } = msg;
    bids = bids.map(([price, size]) => new Level2Point(price, size));
    asks = asks.map(([price, size]) => new Level2Point(price, size));

    return new Level2Snapshot({
      exchange: "CoinbasePro",
      base: market.base,
      quote: market.quote,
      bids,
      asks,
    });
  }

  _constructLevel2Update(msg, market) {
    let { changes } = msg;
    let asks = [];
    let bids = [];
    for (let [side, price, size] of changes) {
      let point = new Level2Point(price, size);
      if (side === "buy") bids.push(point);
      else asks.push(point);
    }

    return new Level2Update({
      exchange: "CoinbasePro",
      base: market.base,
      quote: market.quote,
      asks,
      bids,
    });
  }

  _constructLevel3Update(msg, market) {
    let timestampMs = moment(msg.time).valueOf();
    let sequenceId = msg.sequence;

    let asks = [];
    let bids = [];
    let point;

    switch (msg.type) {
      case "received":
        point = new Level3Point(msg.order_id.replace(/-/g, ""), msg.price, msg.size, {
          type: msg.type,
          side: msg.side,
          order_type: msg.order_type,
          funds: msg.funds,
        });
        break;
      case "open":
        point = new Level3Point(msg.order_id.replace(/-/g, ""), msg.price, msg.remaining_size, {
          type: msg.type,
          remaining_size: msg.remaining_size,
        });
        break;
      case "done":
        point = new Level3Point(msg.order_id.replace(/-/g, ""), msg.price, msg.remaining_size, {
          type: msg.type,
          reason: msg.reason,
          remaining_size: msg.remaining_size,
        });
        break;
      case "match":
        point = new Level3Point(msg.maker_order_id.replace(/-/g, ""), msg.price, msg.size, {
          type: msg.type,
          trade_id: msg.trade_id,
          maker_order_id: msg.maker_order_id.replace(/-/g, ""),
          taker_order_id: msg.taker_order_id.replace(/-/g, ""),
        });
        break;
      case "change":
        point = new Level3Point(msg.order_id.replace(/-/g, ""), msg.price, msg.new_size, {
          type: msg.type,
          new_size: msg.new_size,
          old_size: msg.old_size,
          new_funds: msg.new_funds,
          old_funds: msg.old_funds,
        });
        break;
    }

    if (msg.side === "sell") asks.push(point);
    else bids.push(point);

    return new Level3Update({
      exchange: "CoinbasePro",
      base: market.base,
      quote: market.quote,
      sequenceId,
      timestampMs,
      asks,
      bids,
    });
  }
}

module.exports = CoinbaseProClient;
