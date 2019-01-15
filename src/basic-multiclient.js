const { EventEmitter } = require("events");
const MarketObjectTypes = require("./enums");
const winston = require("winston");

class BasicMultiClient extends EventEmitter {
  constructor() {
    super();
    this._clients = new Map();

    this.hasTickers = false;
    this.hasTrades = false;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = false;
    this.hasLevel3Updates = false;
  }

  ////// ABSTRACT
  _createBasicClient() {
    throw new Error("not implemented");
  }

  ////// PROTECTED

  subscribeTicker(market) {
    if (!this.hasTickers) return;
    this._subscribe(market, this._clients, MarketObjectTypes.ticker, "subscribing to ticker");
  }

  unsubscribeTicker(market) {
    if (!this.hasTickers) return;
    if (this._clients.has(market.id)) {
      this._clients.get(market.id).unsubscribeTicker(market);
    }
  }

  subscribeTrades(market) {
    if (!this.hasTrades) return;
    this._subscribe(market, this._clients, MarketObjectTypes.trade, "subscribing to trades");
  }

  unsubscribeTrades(market) {
    if (!this.hasTrades) return;
    if (this._clients.has(market.id)) {
      this._clients.get(market.id).unsubscribeTrades(market);
    }
  }

  subscribeLevel2Updates(market) {
    if (!this.hasLevel2Updates) return;
    this._subscribe(
      market,
      this._clients,
      MarketObjectTypes.level2update,
      "subscribing to level 2 updates"
    );
  }

  unsubscribeLevel2Updates(market) {
    if (!this.hasLevel2Updates) return;
    if (this._clients.has(market.id)) {
      this._clients.get(market.id).unsubscribeLevel2Updates(market);
    }
  }

  subscribeLevel2Snapshots(market) {
    if (!this.hasLevel2Snapshots) return;
    this._subscribe(
      market,
      this._clients,
      MarketObjectTypes.level2snapshot,
      "subscribing to level 2 snapshots"
    );
  }

  unsubscribeLevel2Snapshots(market) {
    if (!this.hasLevel2Snapshots) return;
    if (this._clients.has(market.id)) {
      this._clients.get(market.id).unsubscribeLevel2Snapshots(market);
    }
  }

  close(emitClosed = true) {
    this._clients.forEach(c => {
      c.close();
    });

    if (emitClosed) this.emit("closed");
  }

  _subscribe(market, map, marketObjectType, msg) {
    let remote_id = market.id,
      client = null;

    if (!map.has(remote_id)) {
      let clientArgs = { auth: this.auth, market: market };
      client = this._createBasicClient(clientArgs);
      map.set(remote_id, client);
    } else {
      client = map.get(remote_id);
    }

    if (marketObjectType === MarketObjectTypes.ticker) {
      winston.info(msg, this._name, remote_id);

      client.subscribeTicker(market);

      client.on("ticker", ticker => {
        this.emit("ticker", ticker);
      });
    }

    if (marketObjectType === MarketObjectTypes.trade) {
      winston.info(msg, this._name, remote_id);

      client.subscribeTrades(market);

      client.on("trade", trade => {
        this.emit("trade", trade);
      });
    }

    if (marketObjectType === MarketObjectTypes.level2update) {
      winston.info(msg, this._name, remote_id);

      client.subscribeLevel2Updates(market);

      client.on("l2update", l2update => {
        this.emit("l2update", l2update);
      });
    }

    if (marketObjectType === MarketObjectTypes.level2snapshot) {
      winston.info(msg, this._name, remote_id);

      client.subscribeLevel2Snapshots(market);

      client.on("l2snapshot", l2snapshot => {
        this.emit("l2snapshot", l2snapshot);
      });
    }
  }
}

module.exports = BasicMultiClient;
