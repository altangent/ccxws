const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");

class BitbankClient extends BasicClient {
  constructor({
    wssPath = "wss://stream.bitbank.cc/socket.io/?EIO=3&transport=websocket",
    watcherMs,
  } = {}) {
    super(wssPath, "bitbank", undefined, watcherMs);

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
    this.hasLevel2Updates = true;
  }

  _sendSubTicker(remote_id) {
    this._wss.send(`42["join-room", "ticker_${remote_id}"]`);
  }

  _sendUnsubTicker(remote_id) {
    this._wss.send(`42["left-room", "ticker_${remote_id}"]`);
  }

  _sendSubTrades(remote_id) {
    this._wss.send(`42["join-room", "transactions_${remote_id}"]`);
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(`42["left-room", "transactions_${remote_id}"]`);
  }

  _sendSubLevel2Snapshots(remote_id) {
    this._wss.send(`42["join-room", "depth_whole_${remote_id}"]`);
  }

  _sendUnsubLevel2Snapshots(remote_id) {
    this._wss.send(`42["left-room", "depth_whole_${remote_id}"]`);
  }

  _sendSubLevel2Updates(remote_id) {
    this._wss.send(`42["join-room", "depth_diff_${remote_id}"]`);
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._wss.send(`42["left-room", "depth_diff_${remote_id}"]`);
  }

  _subscribe(market, map, sendFn) {
    let remote_id = market.id;
    this._connect(remote_id);
    if (!map.has(remote_id)) {
      map.set(remote_id, market);

      // perform the subscription if we're connected
      // and if not, then we'll reply on the _onConnected event
      // to send the signal to our server!
      if (this._wss && this._wss.isConnected) {
        sendFn(remote_id, market);
      }
      return true;
    }
    return false;
  }

  _connect(remote_id) {
    if (!this._wss) {
      this._wss = this._wssFactory(this._wssPath);
      this._wss.on("error", this._onError.bind(this));
      this._wss.on("connecting", this._onConnecting.bind(this));
      this._wss.on("connected", this._onConnected.bind(this));
      this._wss.on("disconnected", this._onDisconnected.bind(this));
      this._wss.on("closing", this._onClosing.bind(this));
      this._wss.on("closed", this._onClosed.bind(this));
      this._wss.on("message", msg => {
        try {
          this._onMessage(remote_id, msg);
        } catch (ex) {
          this._onError(ex);
        }
      });
      if (this._beforeConnect) this._beforeConnect();
      this._wss.connect();
    }
  }

  _onMessage(remote_id, raw) {
    let ep = parseInt(raw.slice(0, 1)); // engine.io-protocol
    let sp; // socket.io-protocol
    let content;

    if (ep === 4) {
      sp = parseInt(raw.slice(1, 2));
      if (sp === 2) {
        content = raw.slice(2);
      }
    }
    if (!(ep === 4 && sp === 2)) {
      return;
    }
    let msg = JSON.parse(content)[1]["message"]["data"];
    let room = JSON.parse(content)[1]["room_name"];

    // tickers
    if (room.startsWith("ticker_")) {
      const id = room.replace("ticker_", "");
      let market = this._tickerSubs.get(id);
      if (!market) return;

      let ticker = this._constructTicker(msg, market);
      this.emit("ticker", ticker, market);

      return;
    }

    // trade
    if (room.startsWith("transactions_")) {
      const id = room.replace("transactions_", "");
      for (let tx of msg.transactions) {
        let market = this._tradeSubs.get(id);
        if (!market) return;

        let trade = this._constructTradesFromMessage(tx, market);
        this.emit("trade", trade, market);
      }
      return;
    }

    // l2 snapshot
    if (room.startsWith("depth_whole_")) {
      const id = room.replace("depth_whole_", "");
      let market = this._level2SnapshotSubs.get(id);
      if (!market) return;

      let snapshot = this._constructLevel2Snapshot(msg, market);
      this.emit("l2snapshot", snapshot, market);
      return;
    }

    // l2 update
    if (room.startsWith("depth_diff_")) {
      const id = room.replace("depth_diff_", "");
      let market = this._level2UpdateSubs.get(id);
      if (!market) return;

      let update = this._constructLevel2Updates(msg, market);
      this.emit("l2update", update, market);
      return;
    }
  }

  _constructTicker(msg, market) {
    let { last, timestamp, sell, vol, buy, high, low } = msg;

    return new Ticker({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestamp: timestamp,
      last: last,
      high: high,
      low: low,
      volume: vol,
      bid: sell,
      ask: buy,
    });
  }

  _constructTradesFromMessage(msg, market) {
    let { side, executed_at, amount, price, transaction_id } = msg;

    return new Trade({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      side: side.toLowerCase(),
      unix: executed_at,
      price: price,
      amount: amount,
      tradeId: transaction_id.toFixed(),
    });
  }

  _constructLevel2Snapshot(msg, market) {
    let asks = msg.asks.map(p => new Level2Point(p[0], p[1]));
    let bids = msg.bids.map(p => new Level2Point(p[0], p[1]));

    return new Level2Snapshot({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestampMs: msg.timestamp,
      asks,
      bids,
    });
  }

  _constructLevel2Updates(msg, market) {
    let asks = msg.a.map(p => new Level2Point(p[0], p[1]));
    let bids = msg.b.map(p => new Level2Point(p[0], p[1]));

    return new Level2Update({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestampMs: msg.t,
      asks,
      bids,
    });
  }
}
module.exports = BitbankClient;
