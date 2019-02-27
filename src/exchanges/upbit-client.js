const semaphore = require("semaphore");
const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");


class UpbitClient extends BasicClient {
  constructor() {
    super("wss://api.upbit.com/websocket/v1", "Upbit");
    this._pingInterval = setInterval(this._sendPing.bind(this), 30000);
    this.on("connected", this._resetSemaphore.bind(this));

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = true;
  }

  _resetSemaphore() {
    this._sem = semaphore(5);
    this._hasSnapshot = new Set();
  }

  _sendPing() {
    if (this._wss) {
      this._wss.send(JSON.stringify({ event: "ping" }));
    }
  }

  _sendSubTicker() {

    let codes = Array.from(this._tickerSubs.keys());
    this._sem.take(() => {
      this._wss.send(
          JSON.stringify([{"ticket":"current"},{"type":"ticker","codes":codes}])
      );
    });
  }

  _sendUnsubTicker() {

    let codes = Array.from(this._tickerSubs.keys());
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify([{"ticket":"concluded"},{"type":"ticker","codes":codes}])
      );
    });
  }

  _sendSubTrades() {

    let codes = Array.from(this._tradeSubs.keys());
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify([{"ticket":"concluded"},{"type":"trade","codes":codes}])
      );
    });
  }

  _sendUnsubTrades() {
    
    let codes = Array.from(this._tradeSubs.keys());
    //since every pair has its own instance we can send an empty array
    this._wss.send(
      JSON.stringify([{"ticket":"concluded"},{"type":"trade","codes":codes}])
    );
  }

  _sendSubLevel2Updates() {

    let codes = Array.from(this._level2UpdateSubs.keys());
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify([{"ticket":"quotation"},{"type":"orderbook","codes":codes}])
      );
    });
  }

  _sendUnsubLevel2Updates() {
    
    let codes = Array.from(this._level2UpdateSubs.keys());
    this._wss.send(
      JSON.stringify([{"ticket":"quotation"},{"type":"orderbook","codes":codes}])
    );
  }

  _onMessage(raw) {

    try {
      let msgs = raw.toString('utf8');
      msgs = JSON.parse(msgs.replace(/:(\d+\.{0,1}\d+)(,|\})/g, ':"$1"$2'));

      if (Array.isArray(msgs)) {
        for (let msg of msgs) {
          this._processsMessage(msg);
        }
      } else {
        this._processsMessage(msgs);
      }
    } catch (ex) {
      //console.log(raw);
      //console.warn(`failed to parse json ${raw}`);
    }
  }

  _processsMessage(msg) {

      // clear semaphore
      if (!msg.type) {
        this._sem.leave();
        return;
      }
      

    // trades
    if (msg.type === 'trade') {
      let trade = this._constructTradesFromMessage(msg);
      this.emit("trade", trade);
      return;
    }

    // tickers
    if (msg.type === 'ticker') {
      let ticker = this._constructTicker(msg);
      this.emit("ticker", ticker);
      return;
    }

    // l2 updates
    if (msg.type === 'orderbook') {
      let remote_id = msg.code;
      if (msg.stream_type === 'SNAPSHOT') {
        let snapshot = this._constructLevel2Snapshot(msg);
        this.emit("l2snapshot", snapshot);
        this._hasSnapshot.add(remote_id);
      } else {
        let update = this._constructoL2Update(msg);
        this.emit("l2update", update);
      }
      return;
    }
  }

  _constructTicker(msg) {
    /*
{ type: 'ticker',
  code: 'KRW-BTC',
  opening_price: '3980000.00000000',
  high_price: '4017000.00000000',
  low_price: '3967000.00000000',
  trade_price: '3982000.0',
  prev_closing_price: '3981000.00000000',
  acc_trade_price: '10534309614.237530000',
  change: 'RISE',
  change_price: '1000.00000000',
  signed_change_price: '1000.00000000',
  change_rate: '0.0002511932',
  signed_change_rate: '0.0002511932',
  ask_bid: 'ASK',
  trade_volume: '0.01562134',
  acc_trade_volume: '2641.03667958',
  trade_date: '20190213',
  trade_time: '132020',
  trade_timestamp: '1550064020000',
  acc_ask_volume: '1232.55205784',
  acc_bid_volume: '1408.48462174',
  highest_52_week_price: '14149000.00000000',
  highest_52_week_date: '2018-02-20',
  lowest_52_week_price: '3562000.00000000',
  lowest_52_week_date: '2018-12-15',
  trade_status: null,
  market_state: 'ACTIVE',
  market_state_for_ios: null,
  is_trading_suspended: false,
  delisting_date: null,
  market_warning: 'NONE',
  timestamp: '1550064020393',
  acc_trade_price_24h: null,
  acc_trade_volume_24h: null,
  stream_type: 'SNAPSHOT' }
     */

    let { opening_price, trade_price, acc_bid_volume, acc_ask_volume, code, trade_volume, acc_trade_volume, change_rate, change_price, low_price, high_price, timestamp } = msg;
    
    let market = this._tickerSubs.get(code);
    return new Ticker({
      exchange: "Upbit",
      base: market.base,
      quote: market.quote,
      timestamp: parseInt(timestamp),
      last: trade_price,
      open: opening_price,
      high: high_price,
      low: low_price,
      volume: trade_volume,
      change: change_price,
      changePercent: change_rate,
      bid: undefined,
      ask: undefined,
      bidVolume: acc_bid_volume,
      quoteVolume: acc_trade_volume,
      askVolume: acc_ask_volume,
    });
  }

  _constructTradesFromMessage(datum) {
    /*
      {
       "type":"trade",
       "code":"KRW-BTC",
       "timestamp":1549443263262,
       "trade_date":"2019-02-06",
       "trade_time":"08:54:23",
       "trade_timestamp":1549443263000,
       "trade_price":3794000.0,
       "trade_volume":0.00833522,
       "ask_bid":"BID",
       "prev_closing_price":3835000.00000000,
       "change":"FALL","change_price":41000.00000000,
       "sequential_id":1549443263000001,
       "stream_type":"REALTIME"}
    */

    let { code, trade_timestamp, trade_price, trade_volume, ask_bid, sequential_id } = datum;
    let market = this._tradeSubs.get(code);
    let side = (ask_bid === 'BID') ? "buy" : "sell";

    return new Trade({
      exchange: "Upbit",
      base: market.base,
      quote: market.quote,
      tradeId: sequential_id,
      side: side,
      unix: parseInt(trade_timestamp),
      price: trade_price,
      amount: trade_volume,
    });
  }

  _constructLevel2Snapshot(msg) {
    /*
{ type: 'orderbook',
  code: 'KRW-BTT',
  timestamp: 1549465903782,
  total_ask_size: 1550925205.4196181,
  total_bid_size: 2900599205.9702206,
  orderbook_units:
   [ { ask_price: 1.04,
       bid_price: 1.03,
       ask_size: 185206052.57158336,
       bid_size: 354443748.7514278 },
...
     { ask_price: 1.13,
       bid_price: 0.94,
       ask_size: 198013382.3803366,
       bid_size: 267304509.61145836 } ],
  stream_type: 'SNAPSHOT' }
    */

    let remote_id = msg.code;
    let market = this._level2SnapshotSubs.get(remote_id) || this._level2UpdateSubs.get(remote_id);
    let asks = msg.orderbook_units.map(p => new Level2Point(p.ask_price, p.ask_size));
    let bids = msg.orderbook_units.map(p => new Level2Point(p.bid_price, p.bid_size));
    return new Level2Snapshot({
      exchange: "Upbit",
      base: market.base,
      quote: market.quote,
      timestampMs: parseInt(msg.timestamp),
      asks,
      bids,
    });
  }

  _constructoL2Update(msg) {
    /*
 { type: 'orderbook',
  code: 'KRW-BTT',
  timestamp: 1549465904344,
  total_ask_size: 1550925205.4196181,
  total_bid_size: 2900599205.9702206,
  orderbook_units:
   [ { ask_price: 1.04,
       bid_price: 1.03,
       ask_size: 185206052.57158336,
       bid_size: 354443748.7514278 },
...
     { ask_price: 1.13,
       bid_price: 0.94,
       ask_size: 198013382.3803366,
       bid_size: 267304509.61145836 } ],
  stream_type: 'REALTIME' }
    */

    let remote_id = msg.code;
    let market = this._level2SnapshotSubs.get(remote_id) || this._level2UpdateSubs.get(remote_id);
    let asks = msg.orderbook_units.map(p => new Level2Point(p.ask_price, p.ask_size));
    let bids = msg.orderbook_units.map(p => new Level2Point(p.bid_price, p.bid_size));
    return new Level2Update({
      exchange: "Upbit",
      base: market.base,
      quote: market.quote,
      timestampMs: parseInt(msg.timestamp),
      asks,
      bids,
    });
  }
}

module.exports = UpbitClient;
