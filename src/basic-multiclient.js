const { EventEmitter } = require("events");
const semaphore = require("semaphore");
const { MarketObjectTypes } = require("./enums");
const { wait } = require("./util");

class BasicMultiClient extends EventEmitter {
  constructor() {
    super();
    this._clients = new Map();

    this.hasTickers = false;
    this.hasTrades = false;
    this.hasCandles = false;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = false;
    this.hasLevel3Snapshots = false;
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

  async close() {
    for (let client of this._clients.values()) {
      (await client).close();
    }
  }

  ////// ABSTRACT
  _createBasicClient() {
    throw new Error("not implemented");
  }

  ////// PROTECTED

  subscribeTicker(market) {
    if (!this.hasTickers) return;
    this._subscribe(market, this._clients, MarketObjectTypes.ticker);
  }

  async unsubscribeTicker(market) {
    if (!this.hasTickers) return;
    if (this._clients.has(market.id)) {
      (await this._clients.get(market.id)).unsubscribeTicker(market);
    }
  }

  subscribeCandles(market) {
    if (!this.hasCandles) return;
    this._subscribe(market, this._clients, MarketObjectTypes.candle);
  }

  async unsubscribeCandles(market) {
    if (!this.hasCandles) return;
    if (this._clients.has(market.id)) {
      (await this._clients.get(market.id)).unsubscribeCandles(market);
    }
  }

  subscribeTrades(market) {
    if (!this.hasTrades) return;
    this._subscribe(market, this._clients, MarketObjectTypes.trade);
  }

  async unsubscribeTrades(market) {
    if (!this.hasTrades) return;
    if (this._clients.has(market.id)) {
      (await this._clients.get(market.id)).unsubscribeTrades(market);
    }
  }

  subscribeLevel2Updates(market) {
    if (!this.hasLevel2Updates) return;
    this._subscribe(market, this._clients, MarketObjectTypes.level2update);
  }

  async unsubscribeLevel2Updates(market) {
    if (!this.hasLevel2Updates) return;
    if (this._clients.has(market.id)) {
      (await this._clients.get(market.id)).unsubscribeLevel2Updates(market);
    }
  }

  subscribeLevel2Snapshots(market) {
    if (!this.hasLevel2Snapshots) return;
    this._subscribe(market, this._clients, MarketObjectTypes.level2snapshot);
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
        client.on("connecting", () => this.emit("connecting", clientArgs.market));
        client.on("connected", () => this.emit("connected", clientArgs.market));
        client.on("disconnected", () => this.emit("disconnected", clientArgs.market));
        client.on("reconnecting", () => this.emit("reconnecting", clientArgs.market));
        client.on("closing", () => this.emit("closing", clientArgs.market));
        client.on("closed", () => this.emit("closed", clientArgs.market));
        client.on("error", err => this.emit("error", err, clientArgs.market));
        let clearSem = async () => {
          await wait(this.throttleMs);
          this.sem.leave();
          resolve(client);
        };
        client.once("connected", clearSem);
        client._connect();
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
        let subscribed = client.subscribeCandles(market);
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
      this.emit("error", ex, market);
    }
  }
}

module.exports = BasicMultiClient;
