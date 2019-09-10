const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");
const Level2Snapshot = require("../level2-snapshot");
const https = require("../https");
const UUID = require("uuid/v4");
const semaphore = require("semaphore");
const { wait } = require("../util");

class KucoinClient extends BasicClient {
  constructor() {
    super(undefined, "KuCoin");

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = true;
    this._pingIntervalTime = 50000;
  }

  _beforeConnect() {
    this._wss.prependListener("connected", this._resetSemaphore.bind(this));
    this._wss.on("connected", this._startPing.bind(this));
    this._wss.on("disconnected", this._stopPing.bind(this));
    this._wss.on("closed", this._stopPing.bind(this));
  }

  _resetSemaphore() {
    this._sem = semaphore(1);
  }

  _startPing() {
    clearInterval(this._pingInterval);
    this._pingInterval = setInterval(this._sendPing.bind(this), this._pingIntervalTime);
  }

  _stopPing() {
    clearInterval(this._pingInterval);
  }

  _sendPing() {
    if (this._wss) {
      this._wss.send(
        JSON.stringify({
          id: new Date().getTime(),
          type: "ping",
        })
      );
    }
  }

  async _connect() {
    if (!this._wss) {
      try {
        let raw = await https.post("https://openapi-v2.kucoin.com/api/v1/bullet-public");

        if (raw.data && raw.data.token) {
          const { token, instanceServers } = raw.data;
          const { endpoint, pingInterval } = instanceServers[0];
          this._connectId = UUID();
          this._pingIntervalTime = pingInterval;
          this._wssPath = `${endpoint}?token=${token}&connectId=${this._connectId}`;
          this._wss = this._wssFactory(this._wssPath);
          this._wss.on("error", this._onError.bind(this));
          this._wss.on("connecting", this._onConnecting.bind(this));
          this._wss.on("connected", this._onConnected.bind(this));
          this._wss.on("disconnected", this._onDisconnected.bind(this));
          this._wss.on("closing", this._onClosing.bind(this));
          this._wss.on("closed", this._onClosed.bind(this));
          this._wss.on("message", msg => {
            try {
              this._onMessage(msg);
            } catch (ex) {
              this._onError(ex);
            }
          });
          if (this._beforeConnect) this._beforeConnect();
          this._wss.connect();
        }
      } catch (ex) {
        this._onError(ex);
      }
    }
  }

  _sendSubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        id: new Date().getTime(),
        type: "subscribe",
        topic: "/market/snapshot:" + remote_id,
        privateChannel: false,
        response: true,
      })
    );
  }

  _sendUnsubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        id: new Date().getTime(),
        type: "unsubscribe",
        topic: "/market/snapshot:" + remote_id,
        privateChannel: false,
        response: true,
      })
    );
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        id: new Date().getTime(),
        type: "subscribe",
        topic: "/market/match:" + remote_id,
        privateChannel: false,
        response: true,
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        id: new Date().getTime(),
        type: "unsubscribe",
        topic: "/market/match:" + remote_id,
        privateChannel: false,
        response: true,
      })
    );
  }

  _sendSubLevel2Updates(remote_id) {
    let market = this._level2UpdateSubs.get(remote_id);
    this._requestLevel2Snapshot(market);

    this._wss.send(
      JSON.stringify({
        id: new Date().getTime(),
        type: "subscribe",
        topic: "/market/level2:" + remote_id,
        response: true,
      })
    );
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        id: new Date().getTime(),
        type: "unsubscribe",
        topic: "/market/level2:" + remote_id,
        response: true,
      })
    );
  }

  _onMessage(raw) {
    let replaced = raw.replace(/:(\d+\.{0,1}\d+)(,|\})/g, ':"$1"$2');
    try {
      let msgs = JSON.parse(replaced);

      if (Array.isArray(msgs)) {
        for (let msg of msgs) {
          this._processMessage(msg);
        }
      } else {
        this._processMessage(msgs);
      }
    } catch (ex) {
      this._onError(ex);
    }
  }

  _processMessage(msg) {
    if (!msg.topic || !msg.subject) return;

    // trades
    if (msg.subject === "trade.l3match") {
      this._processTrades(msg);
      return;
    }

    // tickers
    if (msg.subject === "trade.snapshot") {
      this._processTicker(msg);
      return;
    }

    // l2 updates
    if (msg.subject === "trade.l2update") {
      this._processL2Update(msg);
      return;
    }
  }

  _processTrades(msg) {
    let { symbol, time, side, size, price, tradeId, makerOrderId, takerOrderId } = msg.data;
    let market = this._tradeSubs.get(symbol);
    if (!market) {
      return;
    }

    if (time.length === 19) {
      time = time.substring(0, 13);
    }

    let trade = new Trade({
      exchange: "KuCoin",
      base: market.base,
      quote: market.quote,
      tradeId: tradeId,
      side: side,
      unix: parseInt(time),
      price: price,
      amount: size,
      buyOrderId: side === "buy" ? makerOrderId : takerOrderId,
      sellOrderId: side === "sell" ? makerOrderId : takerOrderId,
    });

    this.emit("trade", trade, market);
  }

  _processTicker(msg) {
    console.log(msg);
    let {
      symbol,
      high,
      low,
      datetime,
      vol,
      lastTradedPrice,
      changePrice,
      changeRate,
      open,
      sell,
      buy,
    } = msg.data.data;
    let market = this._tickerSubs.get(symbol);

    if (!market) {
      return;
    }

    let ticker = new Ticker({
      exchange: "KuCoin",
      base: market.base,
      quote: market.quote,
      timestamp: parseFloat(datetime),
      last: lastTradedPrice,
      open: open,
      high: high,
      low: low,
      volume: vol,
      change: changePrice.toFixed(8),
      changePercent: changeRate.toFixed(2),
      bid: buy,
      ask: sell,
      bidVolume: undefined,
      quoteVolume: undefined,
      askVolume: undefined,
    });

    this.emit("ticker", ticker, market);
  }

  _processL2Update(msg) {
    const { symbol, changes } = msg.data;
    let market = this._level2UpdateSubs.get(symbol);

    if (!market) {
      return;
    }

    let asks = changes.asks.map(p => new Level2Point(p[0], p[1]));
    let bids = changes.bids.map(p => new Level2Point(p[0], p[1]));
    let l2Update = new Level2Update({
      exchange: "KuCoin",
      base: market.base,
      quote: market.quote,
      timestampMs: new Date().getTime(),
      asks,
      bids,
    });
    this.emit("l2update", l2Update, market);
  }

  async _requestLevel2Snapshot(market) {
    this._sem.take(async () => {
      try {
        let remote_id = market.id;
        let uri = `https://api.kucoin.com/api/v1/market/orderbook/level2_100?symbol=${remote_id}`;
        let raw = await https.get(uri);

        let asks = raw.data.asks.map(p => new Level2Point(p[0], p[1]));
        let bids = raw.data.bids.map(p => new Level2Point(p[0], p[1]));
        let snapshot = new Level2Snapshot({
          exchange: "KuCoin",
          base: market.base,
          quote: market.quote,
          asks,
          bids,
        });
        this.emit("l2snapshot", snapshot);
      } catch (ex) {
        this._requestLevel2Snapshot(market);
      } finally {
        await wait(this.REST_REQUEST_DELAY_MS);
        this._sem.leave();
      }
    });
  }
}

module.exports = KucoinClient;
