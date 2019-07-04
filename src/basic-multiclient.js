const { EventEmitter } = require("events");
const semaphore = require("semaphore");
const MarketObjectTypes = require("./enums");
const winston = require("winston");
const { wait } = require("./util");

class BasicMultiClient extends EventEmitter {
  constructor() {
    super();
    this._clients = new Map();

    this.hasTickers = false;
    this.hasCandles = false;
    this.hasTrades = false;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = false;
    this.hasLevel3Updates = false;
    this.throttleMs = 250;
    this.sem = semaphore(3); // this can be overriden to allow more or less
  }

  async reconnect() {
    for (let client of this._clients.values()) {
      (await client).reconnect();
      await wait(this.throttleMs); // delay the reconnection throttling
    }
  }

  async close(emitClosed = true) {
    for (let client of this._clients.values()) {
      (await client).close();
    }

    if (emitClosed) this.emit("closed");
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

  async unsubscribeTicker(market) {
    if (!this.hasTickers) return;
    if (this._clients.has(market.id)) {
      (await this._clients.get(market.id)).unsubscribeTicker(market);
    }
  }

  subscribeCandle(market) {
    if (!this.hasCandles) return;
    this._subscribe(market, this._clients, MarketObjectTypes.candle, "subscribing to candle");
  }

  async unsubscribeCandle(market) {
    if (!this.hasCandles) return;
    if (this._clients.has(market.id)) {
      (await this._clients.get(market.id)).unsubscribeCandle(market);
    }
  }

  subscribeTrades(market) {
    if (!this.hasTrades) return;
    this._subscribe(market, this._clients, MarketObjectTypes.trade, "subscribing to trades");
  }

  async unsubscribeTrades(market) {
    if (!this.hasTrades) return;
    if (this._clients.has(market.id)) {
      (await this._clients.get(market.id)).unsubscribeTrades(market);
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

  async unsubscribeLevel2Updates(market) {
    if (!this.hasLevel2Updates) return;
    if (this._clients.has(market.id)) {
      (await this._clients.get(market.id)).unsubscribeLevel2Updates(market);
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

  async unsubscribeLevel2Snapshots(market) {
    if (!this.hasLevel2Snapshots) return;
    if (this._clients.has(market.id)) {
      (await this._clients.get(market.id)).unsubscribeLevel2Snapshots(market);
    }
  }

  _createBasicClientThrottled(clientArgs) {
    return new Promise(resolve => {
      this.sem.take(() => {
        let client = this._createBasicClient(clientArgs);
        client._connect(); // manually perform a connection instead of waiting for a subscribe call
        // construct a function so we can remove it...
        let clearSem = () => {
          this.sem.leave();
          client.removeListener("connected", clearSem);
          resolve(client);
        };
        client.on("connected", clearSem);
      });
    });
  }

  async _subscribe(market, map, marketObjectType) {
    try {
      let remote_id = market.id,
        client = null;

      // construct a client
      if (!map.has(remote_id)) {
        let clientArgs = { auth: this.auth, market: market };
        client = this._createBasicClientThrottled(clientArgs);
        // we MUST store the promise in here otherwise we will stack up duplicates
        map.set(remote_id, client);
      }

      // wait for client to be made!
      client = await map.get(remote_id);

      if (marketObjectType === MarketObjectTypes.ticker) {
        let subscribed = client.subscribeTicker(market);
        if (subscribed) {
          client.on("ticker", (ticker, market) => {
            this.emit("ticker", ticker, market);
          });
        }
      }

      if (marketObjectType === MarketObjectTypes.candle) {
        let subscribed = client.subscribeCandle(market);
        if (subscribed) {
          client.on("candle", (candle, market) => {
            this.emit("candle", candle, market);
          });
        }
      }

      if (marketObjectType === MarketObjectTypes.trade) {
        let subscribed = client.subscribeTrades(market);
        if (subscribed) {
          client.on("trade", (trade, market) => {
            this.emit("trade", trade, market);
          });
        }
      }

      if (marketObjectType === MarketObjectTypes.level2update) {
        let subscribed = client.subscribeLevel2Updates(market);
        if (subscribed) {
          client.on("l2update", (l2update, market) => {
            this.emit("l2update", l2update, market);
          });
          client.on("l2snapshot", (l2snapshot, market) => {
            this.emit("l2snapshot", l2snapshot, market);
          });
        }
      }

      if (marketObjectType === MarketObjectTypes.level2snapshot) {
        let subscribed = client.subscribeLevel2Snapshots(market);
        if (subscribed) {
          client.on("l2snapshot", (l2snapshot, market) => {
            this.emit("l2snapshot", l2snapshot, market);
          });
        }
      }
    } catch (ex) {
      winston.error("subscribe failed " + ex.message);
    }
  }
}

module.exports = BasicMultiClient;
