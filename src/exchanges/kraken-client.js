const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");

class KrakenClient extends BasicClient {
  constructor() {
    super("wss://ws.kraken.com", "Kraken");

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Updates = true;
    this.hasLevel2Snapshots = false;

    this.debouceTimeoutHandles = new Map();
    this.debounceWait = 200;
    this.subscriptionLog = new Map();
  }

  _sendSubTicker() {

    let codes = Array.from(this._tickerSubs.keys());
    this._wss.send(JSON.stringify({
      "event": "subscribe",
      "pair": codes,
      "subscription": {
        "name": "ticker"
      }
    }));
  }

  _sendUnsubTicker(codes) {
    this._debounce("unsub-ticker", () => {
      this._wss.send(JSON.stringify({
        "event": "unsubscribe",
        "pair": [
          codes
        ],
        "subscription": {
          "name": "ticker"
        }
      }));
    });
  }

  _sendSubTrades() {
    this._debounce("sub-trades", () => {

      let codes = Array.from(this._tradeSubs.keys());
      this._wss.send(JSON.stringify({
        "event": "subscribe",
        "pair": codes,
        "subscription": {
          "name": "trade"
        }
      }));

    });
  }

  _sendUnsubTrades(codes) {
    this._debounce("sub-trades", () => {

      this._wss.send(JSON.stringify({
        "event": "unsubscribe",
        "pair": [
          codes
        ],
        "subscription": {
          "name": "trade"
        }
      }));

    });
  }

  _sendSubLevel2Updates() {
    this._debounce("sub-l2updates", () => {

      let codes = Array.from(this._level2UpdateSubs.keys());
      this._wss.send(JSON.stringify({
        "event": "subscribe",
        "pair": codes,
        "subscription": {
          "name": "book"
        }
      }));
    });
  }

  _sendUnsubLevel2Updates(codes) {
    this._debounce("unsub-l2updates", () => {
      this._wss.send(JSON.stringify({
        "event": "unsubscribe",
        "pair": [
          codes
        ],
        "subscription": {
          "name": "book"
        }
      }));
    });
  }

  _debounce(type, fn) {
    clearTimeout(this.debouceTimeoutHandles.get(type));
    this.debouceTimeoutHandles.set(type, setTimeout(fn, this.debounceWait));
  }

  _onMessage(raw) {
    //console.log(raw);
    //let msgs = raw.toString("utf8");
    let msgs = JSON.parse(raw.replace(/:(\d+\.{0,1}\d+)(,|\})/g, ':"$1"$2'));
    this._processsMessage(msgs);
  }

  _processsMessage(msg) {

    if (msg.event === "heartbeat") {
        return;
    }

    if (msg.event === "systemStatus") {
      return;
    }

    if (msg.event === "subscriptionStatus") {
        /* { channelID: '15',
          event: 'subscriptionStatus',
          pair: 'XBT/EUR',
          status: 'subscribed',
          subscription: { name: 'ticker' } }*/
        
        this.subscriptionLog.set(parseInt(msg.channelID), msg);
        return;
    }


    if(!Array.isArray(msg) || !this.subscriptionLog.get(msg[0])){
        return;
    }

    let sl = this.subscriptionLog.get(msg[0]);

    // tickers
    if (sl.subscription.name === "ticker") {
        let ticker = this._constructTicker(msg[1], sl.pair);
        this.emit("ticker", ticker);
        return;
    }

    // trades
    if (sl.subscription.name === "trade") {
      if(Array.isArray(msg[1])){
        msg[1].forEach(t => {
          let trade = this._constructTrade(t, sl.pair);
          this.emit("trade", trade);
        });
      }
      return;
    }

    //l2 updates
    if (sl.subscription.name === "book") {

      if(Array.isArray(msg[1].as) && Array.isArray(msg[1].bs)){
        let l2snapshot = this._constructLevel2Snapshot(msg[1], sl.pair);
        if(l2snapshot){
          this.emit("l2snapshot", l2snapshot);
        }
        return;
      }

      let l2update = this._constructLevel2Update(msg, sl.pair);
      if(l2update){
        this.emit("l2update", l2update);
      }
    }
    return;

  }

  _constructTicker(msg, code) {

    /*
      { a: [ '3343.70000', 1, '1.03031692' ],
        b: [ '3342.20000', 1, '1.00000000' ],
        c: [ '3343.70000', '0.01000000' ],
        v: [ '4514.26000539', '7033.48119179' ],
        p: [ '3357.13865', '3336.28299' ],
        t: [ 14731, 22693 ],
        l: [ '3308.40000', '3223.90000' ],
        h: [ '3420.00000', '3420.00000' ],
        o: [ '3339.40000', '3349.00000' ] }
    */

    let market = this._tickerSubs.get(code);

    return new Ticker({
      exchange: "Kraken",
      base: market.base,
      quote: market.quote,
      timestamp: Date.now(),
      last: undefined,
      open: msg.o[0],
      high: msg.h[0],
      low: msg.l[0],
      volume: msg.v[0],
      quoteVolume: undefined,
      change: undefined,
      changePercent: undefined,
      bid: msg.b[0],
      bidVolume: msg.b[2],
      ask: msg.a[0],
      askVolume: msg.a[2] 
    });
  }

  _constructTrade(datum, code) {
    /*
    [ '3363.20000', '0.05168143', '1551432237.079148', 'b', 'l', '' ]
    */

    let market = this._tradeSubs.get(code);
    let side = datum[3] === "b" ? "buy" : "sell";

    return new Trade({
      exchange: "Kraken",
      base: market.base,
      quote: market.quote,
      tradeId: undefined,
      side: side,
      unix: parseInt(parseFloat(datum[2])*1000),
      price: datum[0],
      amount: datum[1],
    });
  }

  _constructLevel2Update(msg, remote_id) {
    /* 
    Array = '3361.30000', '25.49061583', '1551438551.775384'
    [ 13, { a: [ [Array] ] }, { b: [ [Array], [Array] ] } ] 
    */

    let market = this._level2UpdateSubs.get(remote_id);

    let asks = [];
    let bids = [];

    let a, b;

    if(msg[1] && Array.isArray(msg[1].a))a = msg[1].a;
    if(msg[2] && Array.isArray(msg[2].a))a = msg[2].a;
    if(msg[1] && Array.isArray(msg[1].b))b = msg[1].b;
    if(msg[2] && Array.isArray(msg[2].b))b = msg[2].b;

    if(a)asks = a.map(p => new Level2Point(p[0], p[1]));
    if(b)bids = b.map(p => new Level2Point(p[0], p[1]));

    if(!asks.length && !bids.length)return;

    return new Level2Update({
      exchange: "Kraken",
      base: market.base,
      quote: market.quote,
      timestampMs: Date.now(),
      asks,
      bids,
    });
  }

  _constructLevel2Snapshot(msg, remote_id) {
    /*
  { as:
   [ [ '3361.30000', '25.57512297', '1551438550.367822' ],
     [ '3363.80000', '15.81228000', '1551438539.149525' ] ],
  bs:
   [ [ '3361.20000', '0.07234101', '1551438547.041624' ],
     [ '3357.60000', '1.75000000', '1551438516.825218' ] ] }
    */

    let market = this._level2SnapshotSubs.get(remote_id) || this._level2UpdateSubs.get(remote_id);
    if(!market)return;
    let asks = msg.as.map(p => new Level2Point(p[0], p[1]));
    let bids = msg.bs.map(p => new Level2Point(p[0], p[1]));
    return new Level2Snapshot({
      exchange: "Kraken",
      base: market.base,
      quote: market.quote,
      timestampMs: Date.now(),
      asks,
      bids,
    });
  }
}

module.exports = KrakenClient;
