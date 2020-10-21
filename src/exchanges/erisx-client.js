const moment = require("moment");
const BasicClient = require("../basic-client");
const Trade = require("../trade");
const Level3Point = require("../level3-point");
const Level3Snapshot = require("../level3-snapshot");
const Level3Update = require("../level3-update");
const jwt = require("../jwt");

/**
 * ErisX has limited market data and presently only supports trades and
 * level3 order books. It requires authenticating with a token to view
 * the market data, which is performed on initial connection. ErisX also
 * requires a unique "correlationId" for each request sent to the server.
 * Requests are limited to 40 per second.
 */
class ErisXClient extends BasicClient {
  constructor({
    wssPath = "wss://trade-api.erisx.com/",
    watcherMs = 600000,
    apiKey,
    apiSecret,
  } = {}) {
    super(wssPath, "ErisX", undefined, watcherMs);

    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.hasTrades = true;
    this.hasLevel3Updates = true;
    this._messageId = 0;
  }

  _onConnected() {
    this._sendAuthentication();
  }

  _sendAuthentication() {
    this._wss.send(
      JSON.stringify({
        correlation: this._nextId(),
        type: "AuthenticationRequest",
        token: this._createToken(),
      })
    );
  }

  _nextId() {
    return (++this._messageId).toString();
  }

  _createToken() {
    const payload = {
      iat: Date.now(),
      sub: this.apiKey,
    };
    return jwt.hs256(payload, this.apiSecret);
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        correlation: this._nextId(),
        type: "MarketDataSubscribe",
        symbol: remote_id,
        tradeOnly: true,
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        correlation: this._nextId(),
        type: "MarketDataUnsubscribe",
        symbol: remote_id,
        tradeOnly: true,
      })
    );
  }

  _sendSubLevel3Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        correlation: this._nextId(),
        type: "MarketDataSubscribe",
        symbol: remote_id,
      })
    );
  }

  _sendUnsubLevel2Snapshots(remote_id) {
    this._wss.send(
      JSON.stringify({
        correlation: this._nextId(),
        type: "MarketDataUnsubscribe",
        symbol: remote_id,
      })
    );
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);

    // authentication
    if (msg.type === "AuthenticationResult") {
      if (msg.success) {
        super._onConnected();
      } else {
        this.emit("error", new Error("Authentication failed"));
      }
      return;
    }

    // logout
    if (msg.type === "Logout") {
      this.emit("error", new Error("Session has been logged out"));
      return;
    }

    // unsolicited
    if (msg.type === "OFFLINE") {
      this.emit("error", new Error("Exchange is offline"));
      return;
    }

    // status
    if (msg.type === "INFO_MESSAGE") {
      return;
    }

    // trade
    if (msg.type === "MarketDataIncrementalRefreshTrade") {
      let market = this._tradeSubs.get(msg.symbol);
      if (!market) return;

      const trades = this._constructTrades(msg, market);
      for (const trade of trades) {
        this.emit("trade", trade, market);
      }
      return;
    }

    // l3
    if (msg.type === "MarketDataIncrementalRefresh") {
      let market = this._level3UpdateSubs.get(msg.symbol);
      if (!market) return;

      // snapshot
      if (msg.endFlag === null) {
        const snapshot = this._constructLevel3Snapshot(msg, market);
        this.emit("l3snapshot", snapshot, market);
      }
      // update
      else {
        const update = this._constructLevel3Update(msg, market);
        this.emit("l3update", update, market);
      }
      return;
    }
  }

  /**
   {
      "correlation": "15978410832102",
      "type": "MarketDataIncrementalRefreshTrade",
      "symbol": "LTC/USD",
      "sendingTime": "20200819-12:44:50.896",
      "trades": [{
        "updateAction": "NEW",
        "price": 64.2,
        "currency": "LTC",
        "tickerType": "PAID",
        "transactTime": "20200819-12:44:50.872994129",
        "size": 2.0,
        "symbol": "LTC/USD",
        "numberOfOrders": 1
      }],
      "endFlag":  "END_OF_TRADE"
    }
   */
  _constructTrades(msg, market) {
    return msg.trades.map(p => this._constructTrade(p, market));
  }

  /**
   {
      "updateAction": "NEW",
      "price": 64.2,
      "currency": "LTC",
      "tickerType": "PAID",
      "transactTime": "20200819-12:44:50.872994129",
      "size": 2.0,
      "symbol": "LTC/USD",
      "numberOfOrders": 1
   }
   */
  _constructTrade(msg, market) {
    const timestamp = moment.utc(msg.transactTime, "YYYYMMDD-hh:mm:ss.SSSSSSSSS");
    const unix = timestamp.valueOf();
    const tradeId = msg.transactTime.replace(/[-:.]/g, "");
    const amount = msg.size.toFixed(8);
    const price = msg.price.toFixed(8);
    return new Trade({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      tradeId,
      unix,
      price,
      amount,
      raw: msg,
    });
  }

  /**
   {
      "correlation": "4",
      "type": "MarketDataIncrementalRefresh",
      "symbol": "BTC/USD",
      "sendingTime": "20201007-17:37:40.588",
      "bids": [
          {
              "id": "1000000fd05b8",
              "updateAction": "NEW",
              "price": 10632.2,
              "amount": 1.6,
              "symbol": "BTC/USD"
          },
          {
              "id": "1000000fd05a0",
              "updateAction": "NEW",
              "price": 10629.4,
              "amount": 1.6,
              "symbol": "BTC/USD"
          },
          {
              "id": "1000000fc7402",
              "updateAction": "NEW",
              "price": 10623.4,
              "amount": 0.99,
              "symbol": "BTC/USD"
          }
      ],
      "offers": [
          {
              "id": "1000000fd0522",
              "updateAction": "NEW",
              "price": 10633.5,
              "amount": 1.6,
              "symbol": "BTC/USD"
          },
          {
              "id": "1000000fd05b7",
              "updateAction": "NEW",
              "price": 10637,
              "amount": 1.6,
              "symbol": "BTC/USD"
          },
          {
              "id": "1000000fc7403",
              "updateAction": "NEW",
              "price": 10638.4,
              "amount": 0.99,
              "symbol": "BTC/USD"
          }
      ],
      "transactTime": "20201007-17:37:40.587917127",
      "endFlag": null
    }
   */
  _constructLevel3Snapshot(msg, market) {
    const timestampMs = moment.utc(msg.transactTime, "YYYYMMDD-hh:mm:ss.SSSSSSSSS").valueOf();
    const asks = msg.offers.map(
      p => new Level3Point(p.id, p.price.toFixed(8), p.amount.toFixed(8), { type: p.updateAction })
    );
    const bids = msg.bids.map(
      p => new Level3Point(p.id, p.price.toFixed(8), p.amount.toFixed(8), { type: p.updateAction })
    );
    return new Level3Snapshot({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestampMs,
      asks,
      bids,
    });
  }

  /**
   {
      "correlation": "4",
      "type": "MarketDataIncrementalRefresh",
      "symbol": "BTC/USD",
      "sendingTime": "20201007-17:37:42.931",
      "bids": [
          {
              "id": "1000000fc7402",
              "updateAction": "NEW",
              "price": 10625,
              "amount": 0.99,
              "symbol": "BTC/USD"
          }
      ],
      "offers": [],
      "transactTime": "20201007-17:37:42.930970367",
      "endFlag": "END_OF_EVENT"
    }
   */
  _constructLevel3Update(msg, market) {
    const timestampMs = moment.utc(msg.transactTime, "YYYYMMDD-hh:mm:ss.SSSSSSSSS").valueOf();
    let asks = msg.bids.map(
      p => new Level3Point(p.id, p.price.toFixed(8), p.amount.toFixed(8), { type: p.updateAction })
    );
    let bids = msg.offers.map(
      p => new Level3Point(p.id, p.price.toFixed(8), p.amount.toFixed(8), { type: p.updateAction })
    );
    return new Level3Update({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestampMs,
      asks,
      bids,
    });
  }
}

module.exports = ErisXClient;
