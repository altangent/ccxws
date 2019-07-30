const BasicClient = require("../basic-client");
const winston = require("winston");
const semaphore = require("semaphore");
const { wait } = require("../util");
const https = require("../https");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");
const Level2Snapshot = require("../level2-snapshot");
const moment = require("moment");

class BitFlyerClient extends BasicClient {
  constructor() {
    super("wss://ws.lightstream.bitflyer.com/json-rpc", "BitFlyer");
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Updates = true;
    this.requestSnapshot = true;
    this._restSem = semaphore(1);
    this.REST_REQUEST_DELAY_MS = 250;
  }

  _sendSubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "subscribe",
        params: {
          channel: `lightning_ticker_${remote_id}`,
        },
      })
    );
  }

  _sendUnsubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "unsubscribe",
        params: {
          channel: `lightning_ticker_${remote_id}`,
        },
      })
    );
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "subscribe",
        params: {
          channel: `lightning_executions_${remote_id}`,
        },
      })
    );
  }

  _sendSubLevel2Updates(remote_id) {
    // this method is trigger on connections events... so safe to send snapshot request here
    if (this.requestSnapshot) this._requestLevel2Snapshot(this._level2UpdateSubs.get(remote_id));
    this._wss.send(
      JSON.stringify({
        method: "subscribe",
        params: {
          channel: `lightning_board_${remote_id}`,
        },
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "unsubscribe",
        params: {
          channel: `lightning_executions_${remote_id}`,
        },
      })
    );
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        method: "unsubscribe",
        params: {
          channel: `lightning_board_${remote_id}`,
        },
      })
    );
  }

  _onMessage(data) {
    let parsed = JSON.parse(data);
    if (!parsed.params || !parsed.params.channel || !parsed.params.message) return;
    let { channel, message } = parsed.params;

    if (channel.startsWith("lightning_ticker_")) {
      let remote_id = channel.substr("lightning_ticker_".length);
      let market = this._tickerSubs.get(remote_id);
      if (!market) return;

      let ticker = this._createTicker(message, market);
      this.emit("ticker", ticker, market);
      return;
    }

    // trades
    if (channel.startsWith("lightning_executions_")) {
      let remote_id = channel.substr("lightning_executions_".length);
      let market = this._tradeSubs.get(remote_id);
      if (!market) return;

      for (let datum of message) {
        let trade = this._createTrades(datum, market);
        this.emit("trade", trade, market);
      }
    }

    // orderbook
    if (channel.startsWith("lightning_board_")) {
      let remote_id = channel.substr("lightning_board_".length);
      let market = this._level2UpdateSubs.get(remote_id);
      if (!market) return;

      let update = this._createLevel2Update(message, market);
      this.emit("l2update", update, market);
    }
  }

  _createTicker(data, market) {
    let {
      timestamp,
      best_bid,
      best_ask,
      best_bid_size,
      best_ask_size,
      ltp,
      volume,
      volume_by_product,
    } = data;
    return new Ticker({
      exchange: "bitFlyer",
      base: market.base,
      quote: market.quote,
      timestamp: moment.utc(timestamp).valueOf(),
      last: ltp.toFixed(8),
      volume: volume.toFixed(8),
      quoteVolume: volume_by_product.toFixed(8),
      bid: best_bid.toFixed(8),
      bidVolume: best_bid_size.toFixed(8),
      ask: best_ask.toFixed(8),
      askVolume: best_ask_size.toFixed(8),
    });
  }

  _createTrades(datum, market) {
    let {
      size,
      side,
      exec_date,
      price,
      id,
      buy_child_order_acceptance_id,
      sell_child_order_acceptance_id,
    } = datum;

    side = side.toLowerCase();
    let unix = moment(exec_date).valueOf();

    return new Trade({
      exchange: "bitFlyer",
      base: market.base,
      quote: market.quote,
      tradeId: id.toFixed(),
      unix,
      side: side.toLowerCase(),
      price: price.toFixed(8),
      amount: size.toFixed(8),
      buyOrderId: buy_child_order_acceptance_id,
      sellOrderId: sell_child_order_acceptance_id,
    });
  }

  _createLevel2Update(msg, market) {
    let asks = msg.asks.map(p => new Level2Point(p.price.toFixed(8), p.size.toFixed(8)));
    let bids = msg.bids.map(p => new Level2Point(p.price.toFixed(8), p.size.toFixed(8)));

    return new Level2Update({
      exchange: "bitFlyer",
      base: market.base,
      quote: market.quote,
      asks,
      bids,
    });
  }

  async _requestLevel2Snapshot(market) {
    this._restSem.take(async () => {
      try {
        winston.info(`requesting snapshot for ${market.id}`);
        let remote_id = market.id;
        let uri = `https://api.bitflyer.com/v1/board?product_code=${remote_id}`;
        let raw = await https.get(uri);
        let asks = raw.asks.map(p => new Level2Point(p.price.toFixed(8), p.size.toFixed(8)));
        let bids = raw.bids.map(p => new Level2Point(p.price.toFixed(8), p.size.toFixed(8)));
        let snapshot = new Level2Snapshot({
          exchange: "bitFlyer",
          base: market.base,
          quote: market.quote,
          asks,
          bids,
        });
        this.emit("l2snapshot", snapshot, market);
      } catch (ex) {
        winston.warn(`failed to fetch snapshot for ${market.id} - ${ex}`);
        this._requestLevel2Snapshot(market);
      } finally {
        await wait(this.REST_REQUEST_DELAY_MS);
        this._restSem.leave();
      }
    });
  }
}

module.exports = BitFlyerClient;
