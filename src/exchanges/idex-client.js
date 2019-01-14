const { EventEmitter } = require("events");
const winston = require("winston");
const { wait } = require("../util");
const https = require("../https");
const Ticker = require("../ticker");
const Trade = require("../trade");
const SmartWss = require("../smart-wss");
const Watcher = require("../watcher");
const axios = require('axios')

class IdexClient extends EventEmitter {
  constructor() {
    super();
    this._name = "Idex";
    this._tickerSubs = new Map();
    this._tickerLastMessage = {};
    this._tradeSubs = new Map();
    this._wss = undefined;
    this._reconnectDebounce = undefined;
    this._tickersDebounce = undefined;
    this._currencies = {};
    this._currencyDebounce = undefined;

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = false;
    this.hasLevel2Updates = false;
    this.hasLevel3Snapshots = false;
    this.hasLevel3Updates = false;

    this._watcher = new Watcher(this, 30000);
    this.REST_REQUEST_DELAY_MS = 250;

    this._get_currencies();
  }

  //////////////////////////////////////////////

  subscribeTrades(market) {
    this._subscribe(market, "subscribing to trades", this._tradeSubs);
  }

  unsubscribeTrades(market) {
    this._unsubscribe(market, "unsubscribing to trades", this._tradeSubs);
  }

  subscribeTicker(market) {
    let remote_id = market.id;
    if (!this._tickerSubs.has(remote_id)) {
      this._tickerSubs.set(remote_id, market);

      clearInterval(this._tickersDebounce);
      this._requestTickers();
      this._tickersDebounce = setInterval(function(){ this._requestTickers(); }.bind(this), 10000);
    }
  }

  unsubscribeTicker(market) {
    let remote_id = market.id;
    if (this._tickerSubs.has(remote_id)) {
      this._tickerSubs.delete(remote_id);
      this._tickerLastMessage[remote_id] = false;
      if(!this._tickerSubs.size){
          clearInterval(this._tickersDebounce);
      }
    }
  }

  reconnect() {
    winston.info("reconnecting");
    this._reconnect();
    this.emit("reconnected");
  }

  close() {
    this._close();
  }

  ////////////////////////////////////////////
  // PROTECTED

  _get_currencies(){

    //console.log('Get currencies Run!');

    axios.post('https://api.idex.market/returnCurrencies', {})
    .then((res) => {
        if(res.data){
            clearInterval(this._currencyDebounce);
            let that = this;
            Object.keys(res.data).forEach(function (key){
              that._currencies[res.data[key].address] = key;
            });
        }else{
          console.log("api.idex.market/returnCurrencies returned an empty result");
        }
    })
    .catch((error) => {
        this._currencyDebounce = setTimeout(function(){ this._get_currencies() }.bind(this), 10000);
        console.error(error)
    })

  }

  _subscribe(market, msg, map) {
    let remote_id = market.id.toLowerCase();
    if (!map.has(remote_id)) {
      winston.info(msg, this._name, remote_id);
      map.set(remote_id, market);
      this._reconnect();
      
    }
  }

  _unsubscribe(market, msg, map) {
    let remote_id = market.id.toLowerCase();
    if (map.has(remote_id)) {
      winston.info(msg, this._name, remote_id);
      map.delete(market);
      //this._reconnect();
    }
  }

  /**
   * Reconnects the socket after a debounce period
   * so that multiple calls don't cause connect/reconnect churn
   */
  _reconnect() {
    clearTimeout(this._reconnectDebounce);
    this._reconnectDebounce = setTimeout(() => {
      this._close();
      this._connect();
    }, 100);
  }

  /**
   * Close the underlying connction, which provides a way to reset the things
   */
  _close() {
    if (this._wss) {
      this._wss.close();
      this._wss = undefined;
      this.emit("closed");
    }
  }

  /** Connect to the websocket stream by constructing a path from
   * the subscribed markets.
   */
  _connect() {
    if (!this._wss) {

      let wssPath = "wss://v1.idex.market";

      this._wss = new SmartWss(wssPath);
      this._wss.on("message", this._onMessage.bind(this));
      this._wss.on("open", this._onConnected.bind(this));
      this._wss.on("disconnected", this._onDisconnected.bind(this));
      this._wss.connect();
    }
  }

  ////////////////////////////////////////////
  // ABSTRACT

  _onConnected() {

    this._wss.send(
      JSON.stringify({
        "method": "handshake",
        "payload": {
          "type": "client",
          "version": "2.0",
          "key": "17paIsICur8sA0OBqG6dH5G1rmrHNMwt4oNk4iX9"
        }
      })
    );
    
    this._watcher.start();
    this.emit("connected");
  }

  _onDisconnected() {
    this._watcher.stop();
    this.emit("disconnected");
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);


    if(msg.method === 'notifyTradesInserted'){
      
      for(let c = 0; msg.payload[c]; c++){
        let cbuy = this._currencies[msg.payload[c].tokenBuy];
        let csell = this._currencies[msg.payload[c].tokenSell];
        
        if(cbuy && csell){

            let market = this._tradeSubs.get((cbuy+"_"+csell).toLowerCase());
            if(!market){
                market = this._tradeSubs.get((csell+"_"+cbuy).toLowerCase());
            }
            
            if(market){
              if((msg.payload[c].type == 'sell' && csell == market.base) || (msg.payload[c].type == 'buy' && cbuy == market.base)){
                let trade = this._constructTrade(market, msg.payload[c]);
                this.emit("trade", trade);
              }
            }          
        }
      }

    }

  }

  _constructTicker(market, msg) {

    //lowestAsk: '0.000187006259818701',
    //highestBid: '0.00018303845498568',
    //let open = parseFloat(last) + parseFloat(change);
    return new Ticker({
      exchange: "Idex",
      base: market.base,
      quote: market.quote,
      timestamp: undefined,
      last: msg.last,
      open: undefined,
      high: msg.high,
      low: msg.low,
      volume: msg.baseVolume,
      quoteVolume: msg.quoteVolume,
      change: undefined,
      changePercent: msg.percentChange,
      bid: undefined,
      bidVolume: undefined,
      ask: undefined,
      askVolume: undefined,
    });
  }

  _constructTrade(market, data) {

    //let amount = (data.type === 'sell')?data.amountSell:data.amountBuy;
    let amount = data.amount;
    return new Trade({
      exchange: "Idex",
      base: market.base,
      quote: market.quote,
      tradeId: data.uuid,
      unix: data.timestamp,
      side: data.type,
      price: data.price,
      amount: amount,/*
      buyOrderId,
      sellOrderId,*/
    });
  }

  _requestTickers() {
      for (let market of this._tickerSubs.values()) {
        //console.log(market.id)
        this._requestTicker(market);
      }
  }

  async _requestTicker(market) {

        axios.post('https://api.idex.market/returnTicker', {
          "market": market.id
        })
        .then((res) => {
            if(res.data){
              if(!this._tickerLastMessage[market.id] || this._tickerLastMessage[market.id].quoteVolume !== res.data.quoteVolume){
                this._tickerLastMessage[market.id] = res.data;
                //console.log(this._tickerLastMessage[market.id]);
                let ticker = this._constructTicker(market, res.data);
                this.emit("ticker", ticker);
              }
            }
        })
        .catch((error) => {
          console.log(error)
        })

  }
}

module.exports = IdexClient;
