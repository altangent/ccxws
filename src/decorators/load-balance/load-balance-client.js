const { AbstractClient } = require('../../abstract-client');
const { FillHolesStrategy } = require('./strategies');

const EnumAction = {
  ADD: 0x00,
  SUB: 0x01,
};

/**
 * LoadBalanceClient create clients on-the-fly with a maximum subscriptions
 */
class LoadBalanceClient extends AbstractClient {
  /**
   * @param {{ clientFactory: (clientOptions) => Client}, maxSubscriptions: number, strategy: (clientFactory) => Strategy }} options
   * @param {clientOptions: any} clientOptions
   */
  constructor(options, clientArgs) {
    super();
    this._options = options;
    this._options.clientArgs = clientArgs;
    this._strategy = typeof options.strategy === 'function' ? options.strategy(this._options) : new FillHolesStrategy(this._options);

    this._clients = new WeakMap();
  }

  static create(clientFactory, options) {
    return class extends LoadBalanceClient {
      constructor(...clientArgs) {
        super({ ...options, clientFactory }, clientArgs);
      }
    };
  }

  _resolve(action, market, fn) {
    const method = action === EnumAction.ADD ? 'take' : 'leave';
    const client = this._strategy[method](market.id);

    // Unsubscribe could be undefined if we doesnt subscribed yet.
    if (!client) {
      return false;
    }

    // On subscribe, if client is new, relay their events.
    // Destroy must handled Strategy when leaves all channels.
    if (action === EnumAction.ADD && !this._clients.has(client)) {
      this._clients.set(client, true);
      AbstractClient.relay(client, this);
    }

    return fn(client);
  }

  _subscribe(market, fn) {
    return this._resolve(EnumAction.ADD, market, fn);
  }

  _unsubscribe(market, fn) {
    return this._resolve(EnumAction.SUB, market, fn);
  }

  subscribeTicker(market) {
    return this._subscribe(market, client => client.subscribeTicker(market));
  }

  unsubscribeTicker(market) {
    return this._unsubscribe(market, client => client.unsubscribeTicker(market));
  }

  subscribeCandles(market) {
    return this._subscribe(market, client => client.subscribeCandles(market));
  }

  unsubscribeCandles(market) {
    return this._unsubscribe(market, client => client.unsubscribeCandles(market));
  }

  subscribeTrades(market) {
    return this._subscribe(market, client => client.subscribeTrades(market));  
  }

  unsubscribeTrades(market) {
    return this._unsubscribe(market, client => client.unsubscribeTrades(market));
  }
}


module.exports = {
  LoadBalanceClient
};
