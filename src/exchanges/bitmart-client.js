const semaphore = require("semaphore");
const BasicClient = require("../basic-client");
const BasicMultiClient = require("../basic-multiclient");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");

class BitmartClient extends BasicMultiClient {
  constructor() {
    super();

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = true;
  }

  _createBasicClient() {
    return new BitmartSingleClient();
  }
}


class BitmartSingleClient extends BasicClient {
  constructor() {
    super("wss://openws.bitmart.com", "Bitmart");
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

  _sendSubTicker(remote_id) {
    this._sem.take(() => {
      this._wss.send(
          JSON.stringify({"subscribe":"price","symbol":remote_id})
      );
    });
  }

  _sendUnsubTicker(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({"unsubscribe":"price","symbol":remote_id})
      );
    });
  }

  _sendSubTrades(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({"subscribe":"trade","symbol":remote_id,"precision":6})
      );
    });
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({"unsubscribe":"trade","symbol":remote_id})
    );
  }

  _sendSubLevel2Updates(remote_id) {
    this._sem.take(() => {
      this._wss.send(
        JSON.stringify({"subscribe":"order","symbol":remote_id,"precision":6})
      );
    });
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({"unsubscribe":"order","symbol":remote_id})
    );
  }

  _onMessage(raw) {

    try {
      let msgs;
      if(typeof raw === "string"){
        msgs = JSON.parse(raw.replace(/:(\d+\.{0,1}\d+)(,|\})/g, ':"$1"$2'));
      }

      if(!msgs)return;
      
      if (Array.isArray(msgs)) {
        for (let msg of msgs) {
          this._processsMessage(msg);
        }
      } else {
        this._processsMessage(msgs);
      }
    } catch (ex) {
      console.log(ex);
      console.warn(`failed to parse json ${ex.message}`);
    }
  }

  _processsMessage(msg) {

      // clear semaphore
      if (!msg.subscribe) {
        this._sem.leave();
        return;
      }
      

    // trades
    if (msg.subscribe === 'trade') {
      if (Array.isArray(msg.data.trades)) {
        for (let _trade of msg.data.trades) {
          let trade = this._constructTradesFromMessage(_trade, msg.symbol);
          if(trade){
            this.emit("trade", trade);
          }
        }
      }
      return;
    }

    // tickers
    if (msg.subscribe === 'price') {
      let ticker = this._constructTicker(msg);
      if(ticker){
        this.emit("ticker", ticker);
      }
      return;
    }

    // l2 updates
    if (msg.subscribe === 'depth') {
      let update = this._constructoL2Update(msg);
      if(update){
        this.emit("l2update", update);
      }
      return;
    }
  }

  _constructTicker(msg) {
    /*{
    "subscribe":"price",
    "symbol":"BMX_ETH",
    "data":{
        "open_price":"0.000109",
        "highest_price":"0.000122",
        "lowest_price":"0.000094",
        "volume":"2396.650514",
        "current_price":"0.000112",
        "fluctuation":"+0.0275",
        "rate":"0.05 USD",
        "timestamp":1532033149669
    }}
     */

    let { open_price, volume, current_price, lowest_price, highest_price, timestamp, fluctuation } = msg.data;
    
    let market = this._tickerSubs.get(msg.symbol);
    if(!market)return false;

    return new Ticker({
      exchange: "Bitmart",
      base: market.base,
      quote: market.quote,
      timestamp: parseInt(timestamp),
      last: current_price,
      open: open_price,
      high: highest_price,
      low: lowest_price,
      volume: volume,
      change: fluctuation,
      changePercent: undefined,
      bid: undefined,
      ask: undefined,
      bidVolume: undefined,
      quoteVolume: undefined,
      askVolume: undefined,
    });
  }

  _constructTradesFromMessage(datum, code) {
    /*
{ subscribe: 'trade',
  precision: 6,
  symbol: 'BMX_BTC',
  data:
   { trades:
      [   
        { side: 'sell',
          amount: '0.00053645',
          price: '0.00000343',
          count: '156.4',
          time: 1549523884618 },
        { side: 'buy',
          amount: '0.00145947',
          price: '0.00000343',
          count: '425.5',
          time: 1549523881264 }
   ] } }
    */

    let { side, amount, price, time } = datum;
    let market = this._tradeSubs.get(code);

    if(!market)return false;

    return new Trade({
      exchange: "Bitmart",
      base: market.base,
      quote: market.quote,
      tradeId: undefined,
      side: side,
      unix: parseInt(time),
      price: price,
      amount: amount,
    });
  }


  _constructoL2Update(msg) {
    /*
{
    "subscribe":"depth",
    "symbol":"BMX_ETH",
    "precision":6,
    "data":{
        "buys":[
            {
                "amount":"30657.00",
                "total":"30657.00",
                "price":"0.000111",
                "count":"1"
            },
        ],
        "sells":[
            {
                "amount":"7734.95",
                "total":"7734.95",
                "price":"0.000113",
                "count":"3"
            },
        ]
    }
}
    */

    let remote_id = msg.symbol;
    let market = this._level2SnapshotSubs.get(remote_id) || this._level2UpdateSubs.get(remote_id);
    if(!market)return false;
    
    let asks = msg.data.sells.map(p => new Level2Point(p.price, p.amount, p.count));
    let bids = msg.data.buys.map(p => new Level2Point(p.price, p.amount, p.count));
    return new Level2Update({
      exchange: "Bitmart",
      base: market.base,
      quote: market.quote,
      timestampMs: undefined,
      asks,
      bids,
    });
  }
}

module.exports = BitmartClient;
