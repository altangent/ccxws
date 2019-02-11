const BasicClient = require("../basic-client");
const BasicMultiClient = require("../basic-multiclient");
const Watcher = require("../watcher");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");

class FatbtcClient extends BasicMultiClient {
  constructor() {
    super();

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = true;
  }

  _createBasicClient() {
    return new FatbtcSingleClient();
  }
}

class FatbtcSingleClient extends BasicClient {
  constructor() {
    super("wss://www.fatbtc.us/websocket", "Fatbtc");
    this._watcher = new Watcher(this, 15 * 60 * 1000);
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = true;
    this.hasLevel3Updates = false;
  }

  _sendSubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        key: 'kline_'+remote_id+'_1min', 
        ts: Math.floor(Date.now() / 1000)
      })
    );
  }

  _sendUnsubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        key: 'kline_'+remote_id+'_1min_cancel', 
        ts: Math.floor(Date.now() / 1000)
      })
    );
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        key: 'trades_'+remote_id+'_0', 
        ts: Math.floor(Date.now() / 1000)
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        key: 'trades_'+remote_id+'_0_cancel', 
        ts: Math.floor(Date.now() / 1000)
      })
    );
  }

  _sendSubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        key: 'depth_'+remote_id+'_0', 
        ts: Math.floor(Date.now() / 1000)
      })
    );
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        key: 'depth_'+remote_id+'_0_cancel', 
        ts: Math.floor(Date.now() / 1000)
      })
    );
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);

   // console.log(msg);


    let method = msg.key;
    let params = msg.data;

    // if params is not defined, then this is a response to an event that we don't care about (like the initial connection event)
    if (!params) return;

    if (method.startsWith("kline_")) {
      let marketId = params.symbol.toUpperCase();
      if (this._tickerSubs.has(marketId)) {
        let market = this._tickerSubs.get(marketId);

        if(Array.isArray(params.datas)){
          
          params.datas.forEach(function(_kline) {
            let ticker = this._constructTicker(_kline, market);
            if(ticker){
              this.emit("ticker", ticker);
            }
          }.bind(this));

        }

      }
    }
    
    if (method.startsWith("trades_")) {
      let marketId = params.symbol.toUpperCase();
      if (this._tradeSubs.has(marketId)) {
        
        let market = this._tradeSubs.get(marketId);
        if(Array.isArray(params.trades)){

          params.trades.forEach(function(_trade) {
            let trade = this._constructTrade(_trade, market);
            if(trade){
              this.emit("trade", trade);
            }
          }.bind(this));

        }
      }
    }

    if (method.startsWith("depth_")){
      let marketId = params.symbol.toUpperCase();
      if (this._level2UpdateSubs.has(marketId)) {
        let market = this._level2UpdateSubs.get(marketId);

        let update = this._constructLevel2Update(params, market);
        if(update){
          this.emit("l2update", update);
        }
        
      }
    }
  }

  _constructTicker(rawTick, market) {
    /*
    //Timestamp, opening price, highest price, lowest price, closing price, number of transactions, number of transactions, turnover
    { datas: [ [ 1549879380, 275.61, 275.61, 275.61, 275.61, 0, 0, 0 ] ],
      msg: 'success',
      status: 1,
      symbol: 'ltcfcny',
      timestamp: 1549879389017,
      type: '1min' }
    */

    let last = rawTick[4];
    let open = rawTick[1];
    
    let change = parseFloat(last) - parseFloat(open);
    let changePercent =
      ((parseFloat(last) - parseFloat(open)) / parseFloat(open)) * 100;

    return new Ticker({
      exchange: "Fatbtc",
      base: market.base,
      quote: market.quote,
      timestamp: rawTick[0] * 1000,
      last: last,
      open: open,
      high: rawTick[2],
      low: rawTick[3],
      volume: undefined,
      quoteVolume: undefined,
      change: change,
      changePercent: changePercent,
    });
  }

  _constructTrade(rawTrade, market) {
/*
    { msg: 'success',
    status: 1,
    symbol: 'ltcfcny',
    timestamp: 1549814486222,
    trades:
     [ { price: 292.67,
         taker: 'buy',
         timestamp: 1549814310640,
         upOrDown: 1,
         volume: 1.02 } ] }
*/

    let { timestamp, taker, price, volume } = rawTrade;

    return new Trade({
      exchange: "Fatbtc",
      base: market.base,
      quote: market.quote,
      tradeId: undefined,
      unix: timestamp,
      side: taker,
      price: price,
      amount: volume,
    });
  }

  _constructLevel2Update(rawUpdate, market) {
    let { bids, asks } = rawUpdate,
      structuredBids = bids ? bids.map(p => new Level2Point(p[0], p[1])) : [],
      structuredAsks = asks ? asks.map(p => new Level2Point(p[0], p[1])) : [];

    return new Level2Update({
      exchange: "Fatbtc",
      base: market.base,
      quote: market.quote,
      bids: structuredBids,
      asks: structuredAsks,
    });
  }
}

module.exports = FatbtcClient;
