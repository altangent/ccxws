const { AbstractClient } = require('../abstract-client');

const EnumDirection = {
  ADD: 0x00,
  SUB: 0x01,
};

class ClientWithCounter extends AbstractClient {
  constructor(client) {
    super();
    this._client = client;
    this._counter = 0;

    // Relay events from original client
    AbstractClient.relay(this._client, this);
  }

  _checkCounter(direction, isOk) {
    if (isOk) {
      const n = (direction === EnumDirection.ADD) ? 1 : -1;
      this._counter = this._counter + n;
    }
    if (this._counter <= 0) {
      // Remove relay listeners before close.
      AbstractClient.destroy(this);
      this._client.close();
    }
  }

  getCounter() {
    return this._counter;
  }

  subscribeTicker(market) {
    return this._checkCounter(EnumDirection.ADD, this._client.subscribeTicker(market));
  }

  unsubscribeTicker(market) {
    return this._checkCounter(EnumDirection.SUB, this._client.unsubscribeTicker(market));
  }

  subscribeCandles(market) {
    return this._checkCounter(EnumDirection.ADD, this._client.subscribeCandles(market));
  }

  unsubscribeCandles(market) {
    return this._checkCounter(EnumDirection.SUB, this._client.unsubscribeCandles(market));
  }

  subscribeTrades(market) {
    return this._checkCounter(EnumDirection.ADD, this._client.subscribeTrades(market));
  }

  unsubscribeTrades(market) {
    return this._checkCounter(EnumDirection.SUB, this._client.unsubscribeTrades(market));
  }

  subscribeLevel2Snapshots(market) {
    return this._checkCounter(EnumDirection.ADD, this._client.subscribeLevel2Snapshots(market));
  }

  unsubscribeLevel2Snapshots(market) {
    return this._checkCounter(EnumDirection.SUB, this._client.unsubscribeLevel2Snapshots(market));
  }

  subscribeLevel2Updates(market) {
    return this._checkCounter(EnumDirection.ADD, this._client.subscribeLevel2Updates(market));
  }

  unsubscribeLevel2Updates(market) {
    return this._checkCounter(EnumDirection.SUB, this._client.unsubscribeLevel2Updates(market));
  }

  subscribeLevel3Updates(market) {
    return this._checkCounter(EnumDirection.ADD, this._client.subscribeLevel3Updates(market));
  }

  unsubscribeLevel3Updates(market) {
    return this._checkCounter(EnumDirection.SUB, this._client.unsubscribeLevel3Updates(market));
  }
}

module.exports = {
  ClientWithCounter,
};
