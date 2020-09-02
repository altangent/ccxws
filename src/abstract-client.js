const { EventEmitter } = require('events');

const CHANNELS = [
  'connecting',
  'connected',
  'disconnected',
  'reconnecting',
  'closing',
  'closed',
  'error',
  'trade',
  'ticker',
  'candle',
  'l2update',
  'l2snapshot',
];

/**
 * AbstractClient will expose all the methods that need to be populated by specific implementations.
 * Also it have some utils and should had the repeated code across clients.
 */
class AbstractClient extends EventEmitter {
  static relay(source, dest, channels = CHANNELS) {
    for (const channel of channels) {
      source.on(channel, (...args) => dest.emit(channel, ...args));
    }
  }

  static destroy(source, channels = CHANNELS) {
    for (const channel of channels) {
      source.removeAllListeners(channel);
    }
  }

  subscribeTicker(market) {
    throw new TypeError(`Not implemented. Market: ${JSON.stringify(market)}`);
  }

  unsubscribeTicker(market) {
    throw new TypeError(`Not implemented. Market: ${JSON.stringify(market)}`);
  }

  subscribeCandles(market) {
    throw new TypeError(`Not implemented. Market: ${JSON.stringify(market)}`);
  }

  unsubscribeCandles(market) {
    throw new TypeError(`Not implemented. Market: ${JSON.stringify(market)}`);
  }

  subscribeTrades(market) {
    throw new TypeError(`Not implemented. Market: ${JSON.stringify(market)}`);
  }

  unsubscribeTrades(market) {
    throw new TypeError(`Not implemented. Market: ${JSON.stringify(market)}`);
  }

  subscribeLevel2Snapshots(market) {
    throw new TypeError(`Not implemented. Market: ${JSON.stringify(market)}`);
  }

  unsubscribeLevel2Snapshots(market) {
    throw new TypeError(`Not implemented. Market: ${JSON.stringify(market)}`);
  }

  subscribeLevel2Updates(market) {
    throw new TypeError(`Not implemented. Market: ${JSON.stringify(market)}`);
  }

  unsubscribeLevel2Updates(market) {
    throw new TypeError(`Not implemented. Market: ${JSON.stringify(market)}`);
  }

  subscribeLevel3Updates(market) {
    throw new TypeError(`Not implemented. Market: ${JSON.stringify(market)}`);
  }

  unsubscribeLevel3Updates(market) {
    throw new TypeError(`Not implemented. Market: ${JSON.stringify(market)}`);
  }
}

module.exports = {
  CHANNELS,
  AbstractClient,
};
