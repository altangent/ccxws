const { EventEmitter } = require("events");
const semaphore = require("semaphore");
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
    this.sem = semaphore(3); // this can be overriden to allow more or less
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
          client.on("ticker", ticker => {
            this.emit("ticker", ticker);
          });
        }
      }

      if (marketObjectType === MarketObjectTypes.trade) {
        let subscribed = client.subscribeTrades(market);
        if (subscribed) {
          client.on("trade", trade => {
            this.emit("trade", trade);
          });
        }
      }

      if (marketObjectType === MarketObjectTypes.level2update) {
        let subscribed = client.subscribeLevel2Updates(market);
        if (subscribed) {
          client.on("l2update", l2update => {
            this.emit("l2update", l2update);
          });
        }
      }

      if (marketObjectType === MarketObjectTypes.level2snapshot) {
        let subscribed = client.subscribeLevel2Snapshots(market);
        if (subscribed) {
          client.on("l2snapshot", l2snapshot => {
            this.emit("l2snapshot", l2snapshot);
          });
        }
      }
    } catch (ex) {
      winston.error("subscribe failed " + ex.message);
    }
  }
}

module.exports = BasicMultiClient;
