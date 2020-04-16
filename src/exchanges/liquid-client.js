const BasicClient = require("../basic-client");
const https = require("../https");
const Trade = require("../trade");
const Ticker = require("../ticker");

/**
 * Liquid client as implemented by:
 * https://developers.liquid.com/#public-channels
 */
class LiquidClient extends BasicClient {
  constructor({ autoloadSymbolMaps = true } = {}) {
    super();

    this._name = "Liquid";
    this._wssPath = "wss://tap.liquid.com/app/LiquidTapClient";
    this.requestSnapshot = false;
    this.hasTrades = true;
    this.hasTickers = true;

    this.productIdMap = new Map();
    if (autoloadSymbolMaps) {
      this.loadSymbolMaps().catch(err => this.emit("error", err));
    }
  }

  _beforeConnect() {
    this._wss.on("connected", this._startPing.bind(this));
    this._wss.on("disconnected", this._stopPing.bind(this));
    this._wss.on("closed", this._stopPing.bind(this));
  }

  _startPing() {
    clearInterval(this._pingInterval);
    this._pingInterval = setInterval(this._sendPing.bind(this), 60000);
  }

  _stopPing() {
    clearInterval(this._pingInterval);
  }

  _sendPing() {
    if (this._wss) {
      this._wss.send(JSON.stringify({ event: "pusher:ping", data: {} }));
    }
  }

  /**
   * Liquid endpoints brilliantly/s require you to include the product id
   * in addition to the market symbol. So we need a way to reference this.
   * Results from the products API look like:
   * {
      "id": 5,
      "product_type": "CurrencyPair",
      "code": "CASH",
      "name": "CASH Trading",
      "market_ask": "48203.05",
      "market_bid": "48188.15",
      "indicator": -1,
      "currency": "JPY",
      "currency_pair_code": "BTCJPY",
      "symbol": "¥",
      "fiat_minimum_withdraw": "1500.0",
      "pusher_channel": "product_cash_btcjpy_5",
      "taker_fee": "0.0",
      "maker_fee": "0.0",
      "low_market_bid": "47630.99",
      "high_market_ask": "48396.71",
      "volume_24h": "2915.627366519999999998",
      "last_price_24h": "48217.2",
      "last_traded_price": "48203.05",
      "last_traded_quantity": "1.0",
      "quoted_currency": "JPY",
      "base_currency": "BTC",
      "exchange_rate": "0.009398151671149725",
      "timestamp": "1576739219.195353100"
    },
   */
  async loadSymbolMaps() {
    let uri = "https://api.liquid.com/products";
    let results = await https.get(uri);
    for (let result of results) {
      this.productIdMap.set(result.currency_pair_code.toLowerCase(), result.id);
    }
  }

  _sendSubTicker(remote_id) {
    remote_id = remote_id.toLowerCase();
    const product_id = this.productIdMap.get(remote_id);
    this._wss.send(
      JSON.stringify({
        event: "pusher:subscribe",
        data: {
          channel: `product_cash_${remote_id}_${product_id}`,
        },
      })
    );
  }

  _sendUnsubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "pusher:unsubscribe",
        data: {
          channel: `product_cash_${remote_id.toLowerCase()}`,
        },
      })
    );
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "pusher:subscribe",
        data: {
          channel: `executions_cash_${remote_id.toLowerCase()}`,
        },
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        event: "pusher:unsubscribe",
        data: {
          channel: `executions_cash_${remote_id.toLowerCase()}`,
        },
      })
    );
  }

  /////////////////////////////////////////////

  _onMessage(raw) {
    try {
      var msg = JSON.parse(raw);
    } catch (e) {
      this.emit("error", e);
      return;
    }

    // success messages look like:
    // {
    //   channel: 'executions_cash_btcjpy',
    //   data: {},
    //   event: 'pusher_internal:subscription_succeeded'
    // }

    if (msg.channel) {
      if (msg.channel.startsWith("executions_cash_")) {
        this._onTrade(msg);
        return;
      }

      if (msg.channel.startsWith("product_cash_")) {
        this._onTicker(msg);
      }
    }
  }

  /**
   * Ticker message in the format:
   * {
   *   channel: 'product_cash_btcjpy_5',
   *   data: '{"base_currency":"BTC","btc_minimum_withdraw":null,"cfd_enabled":false,"code":"CASH","currency":"JPY","currency_pair_code":"BTCJPY","disabled":false,"fiat_minimum_withdraw":null,"high_market_ask":"772267.0","id":"5","indicator":-1,"last_event_timestamp":"1587066660.016599696","last_price_24h":"725777.0","last_traded_price":"764242.0","last_traded_quantity":"0.05805448","low_market_bid":"698763.0","margin_enabled":false,"market_ask":"764291.0","market_bid":"764242.0","name":" CASH Trading","perpetual_enabled":false,"product_type":"CurrencyPair","pusher_channel":"product_cash_btcjpy_5","quoted_currency":"JPY","symbol":"¥","tick_size":"1.0","timestamp":"1587066660.016599696","volume_24h":"20739.2916905799999999"}',
   *   event: 'updated'
   * }
   */
  _onTicker(msg) {
    let data;
    try {
      data = JSON.parse(msg.data);
    } catch (e) {
      return;
    }

    let remote_id = /(product_cash_)(\w+)_\d+/.exec(msg.channel)[2];
    let market = this._tickerSubs.get(remote_id);
    if (!market) return;

    let open = Number(data.last_price_24h);
    let close = Number(data.last_traded_price);
    let change = close - open;
    let changePercent = (change / open) * 100;

    let ticker = new Ticker({
      exchange: "Liquid",
      base: market.base,
      quote: market.quote,
      timestamp: Math.round(Number(data.timestamp) * 1000),
      last: data.last_traded_price,
      open: data.last_price_24h,
      high: undefined,
      low: undefined,
      volume: data.volume_24h,
      quoteVolume: undefined,
      change: change.toFixed(8),
      changePercent: changePercent.toFixed(2),
      bid: data.market_bid,
      bidVolume: undefined,
      ask: data.market_ask,
      askVolume: undefined,
    });

    this.emit("ticker", ticker, market);
  }

  /**
   * Trade message in the format:
   * {
   *   channel: 'executions_cash_btcjpy',
   *   data: '{"created_at":1587056568,"id":297058474,"price":757584.0,"quantity":0.178,"taker_side":"sell"}',
   *   event: 'created'
   * }
   */
  _onTrade(msg) {
    let data;
    try {
      data = JSON.parse(msg.data);
    } catch (e) {
      return;
    }

    let remote_id = msg.channel.substr(msg.channel.lastIndexOf("_") + 1);

    let market = this._tradeSubs.get(remote_id);
    if (!market) return;

    let trade = new Trade({
      exchange: "Liquid",
      base: market.base,
      quote: market.quote,
      tradeId: data.id.toFixed(),
      unix: parseInt(data.created_at) * 1000,
      side: data.taker_side == "buy" ? "buy" : "sell",
      price: data.price.toFixed(),
      amount: data.quantity.toFixed(),
      buyOrderId: undefined,
      sellOrderId: undefined,
    });

    this.emit("trade", trade, market);
  }
}

module.exports = LiquidClient;
