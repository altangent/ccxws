const { EventEmitter } = require("events");
const MarketObjectTypes = require("./enums");
const winston = require("winston");

class BasicMultiClient extends EventEmitter {
  constructor(singleClientType) {
    super();
    this._clients = new Map();

    this.singleClientType = singleClientType;
  }

  subscribeTicker(market) {
    this._subscribe(market, this._clients, MarketObjectTypes.ticker, "subscribing to ticker");
  }

  unsubscribeTicker(market) {
    if (this._clients.has(market.id)) {
      this._clients.get(market.id).unsubscribeTicker(market);
    }
  }

  subscribeTrades(market) {
    this._subscribe(market, this._clients, MarketObjectTypes.trade, "subscribing to trades");
  }

  unsubscribeTrades(market) {
    if (this._clients.has(market.id)) {
      this._clients.get(market.id).unsubscribeTrades(market);
    }
  }

  subscribeLevel2Updates(market) {
    this._subscribe(
      market,
      this._clients,
      MarketObjectTypes.l2update,
      "subscribing to level 2 snapshots"
    );
  }

  unsubscribeLevel2Updates(market) {
    if (this._clients.has(market.id)) {
      this._clients.get(market.id).unsubscribeLevel2Updates(market);
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
      client = new this.singleClientType();
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

    if (marketObjectType === MarketObjectTypes.l2update) {
      winston.info(msg, this._name, remote_id);

      client.subscribeLevel2Updates(market);

      client.on("l2snapshot", l2snapshot => {
        this.emit("l2snapshot", l2snapshot);
      });

      client.on("l2update", l2update => {
        this.emit("l2update", l2update);
      });
    }
  }
}

module.exports = BasicMultiClient;
