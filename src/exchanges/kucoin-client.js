
const BasicClient = require("../basic-client");
const BasicMultiClient = require("../basic-multiclient");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level3Point = require("../level3-point");
const Level2Update = require("../level2-update");
const Level2Snapshot = require("../level2-snapshot");
const Level3Update = require("../level3-update");
const SmartWss = require("../smart-wss");
const https = require("../https");
const Watcher = require("../watcher");
const semaphore = require("semaphore");
const { wait } = require("../util");
const winston = require("winston");

class KucoinClient extends BasicMultiClient {
  constructor() {
    super();

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
    this.hasLevel2Updates = true;
    this.hasLevel3Updates = true;
  }

  _createBasicClient() {
    return new KucoinSingleClient();
  }
}


class KucoinSingleClient extends BasicClient {
   constructor() {

    super();
    this._name = 'KuCoin';
    this._wss = undefined;
    this._reconnectDebounce = undefined;

    this._watcher = new Watcher(this, 30000);

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Snapshots = true;
    this.hasLevel2Updates = true;
    this.hasLevel3Updates = true;
    this._restSem = semaphore(1);
  }

////////////////////////////////////////////
  // PROTECTED
  /** Connect to the websocket stream by constructing a path from
   * the subscribed markets.
   */
  async _connect() {
    if (!this._wss) {

      let postData = JSON.stringify({})
      try{
        let raw = await https.post('https://api.kucoin.com/api/v1/bullet-public', postData);
        if(raw.data && raw.data.token){
          this._wssPath = "wss://push1-v2.kucoin.com/endpoint?token="+raw.data.token;
          this._wss = new SmartWss(this._wssPath);
          this._wss.on("open", this._onConnected.bind(this));
          this._wss.on("message", this._onMessage.bind(this));
          this._wss.on("disconnected", this._onDisconnected.bind(this));
          this._wss.connect();

        }
      }catch(e){
        console.log(e);
      }

    }
  }

  _connected() {
    this._requestLevel2Snapshots();
    this.emit("connected");
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

  ////////////////////////////////////////////
  // ABSTRACT

  _sendPing() {
    if (this._wss) {
      this._wss.send(JSON.stringify({
        "id":new Date().getTime(),
        "type":"ping"
      }));
    }
  }

  _sendSubTicker(remote_id) {
      this._wss.send(
        JSON.stringify({
          "id": new Date().getTime(),
          "type": "subscribe",
          "topic": "/market/snapshot:"+remote_id,
          "privateChannel": false,
          "response": true
      })
      );
  }

  _sendUnsubTicker(remote_id) {

      this._wss.send(
        JSON.stringify({
          "id": new Date().getTime(),
          "type": "unsubscribe",
          "topic": "/market/snapshot:"+remote_id,
          "privateChannel": false,
          "response": true
      })
      );
  }

  _sendSubTrades(remote_id) {

      this._wss.send(
        JSON.stringify({
          "id": new Date().getTime(),
          "type": "subscribe",
          "topic": "/market/match:"+remote_id,
          "privateChannel": false,
          "response": true
      })
      );
  }

  _sendUnsubTrades(remote_id) {
    
    this._wss.send(
      JSON.stringify({
        "id": new Date().getTime(),
        "type": "unsubscribe",
        "topic": "/market/match:"+remote_id,
        "privateChannel": false,
        "response": true
    })
    );
  }


  _sendSubLevel2Snapshots(remote_id) {

    let market = this._level2SnapshotSubs.get(remote_id);
    if(market){
        this._requestLevel2Snapshot(market);
    }

  }

  _sendSubLevel2Updates(remote_id) {

      let market = this._level2UpdateSubs.get(remote_id);
      this._requestLevel2Snapshot(market);
      
      this._wss.send(
        JSON.stringify({
          "id": new Date().getTime(),
          "type": "subscribe",
          "topic": "/market/level2:"+remote_id,
          "response": true
      })
      );
  }

  _sendUnsubLevel2Updates(remote_id) {
    
      this._wss.send(
        JSON.stringify({
          "id": new Date().getTime(),
          "type": "unsubscribe",
          "topic": "/market/level2:"+remote_id,
          "response": true
      })
      );
  }

  _sendSubLevel3Updates(remote_id) {

      this._wss.send(
        JSON.stringify({
          "id": new Date().getTime(),
          "type": "subscribe",
          "topic": "/market/level3:"+remote_id,
          "response": true
      })
      );
  }

  _sendUnsubLevel3Updates(remote_id) {
    
      this._wss.send(
        JSON.stringify({
          "id": new Date().getTime(),
          "type": "unsubscribe",
          "topic": "/market/level3:"+remote_id,
          "response": true
      })
      );
  }

  _onMessage(raw) {

    //console.log(raw);
    try {
      //let msgs = raw.toString('utf8');
      let msgs = JSON.parse(raw.replace(/:(\d+\.{0,1}\d+)(,|\})/g, ':"$1"$2'));
      
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
      
    if(!msg.topic || !msg.subject)return;

    // trades
    if (msg.subject === 'trade.l3match') {
      let trade = this._constructTradesFromMessage(msg.data);
      this.emit("trade", trade);
      return;
    }

    // tickers
    if (msg.subject === 'trade.snapshot') {
      let ticker = this._constructTicker(msg.data.data);
      //console.log(ticker);
      this.emit("ticker", ticker);
      return;
    }

    // l2 updates
    if (msg.subject === 'trade.l2update') {
        let update = this._constructL2Update(msg.data);
        this.emit("l2update", update);
      return;
    }

    // l3 updates
    if (msg.subject === 'trade.l3received') {
      let update = this._constructL3Update(msg.data);
      if(update){
        this.emit("l3update", update);
      }
    return;
  }

  }

  _constructTicker(msg) {
    /* [{trading: true,
        symbol: 'KCS-BTC',
        buy: 0.00011695,
        sell: 0.00011765,
        sort: 100,
        volValue: 72.03894324754921,
        baseCurrency: 'KCS',
        market: 'BTC',
        quoteCurrency: 'BTC',
        symbolCode: 'KCS-BTC',
        datetime: 1551264684445,
        high: 0.000119,
        vol: 617811.163979531,
        low: 0.0001148,
        changePrice: 0.00000178,
        changeRate: 0.0154,
        close: 0.00011696,
        lastTradedPrice: 0.00011696,
        board: 1,
        mark: 0,
        open: 0.00011518
        }]
     */

    let { symbol, high, low, datetime, vol, lastTradedPrice, changePrice, open, sell, buy } = msg;
    let changePercent = undefined;
    let _open = parseFloat(open);

    if(_open > 0){
      changePercent = ((parseFloat(lastTradedPrice) - _open) / _open) * 100;
      changePercent = changePercent.toFixed(8);
    }

    let market = this._tickerSubs.get(symbol);

    return new Ticker({
      exchange: "KuCoin",
      base: market.base,
      quote: market.quote,
      timestamp: parseFloat(datetime),
      last: lastTradedPrice,
      open: open,
      high: high,
      low: low,
      volume: vol,
      change: changePrice,
      changePercent: changePercent,
      bid: buy,
      ask: sell,
      bidVolume: undefined,
      quoteVolume: undefined,
      askVolume: undefined,
    });
  }

  _constructTradesFromMessage(datum) {
    /*
    { sequence: '1550467608360',
      symbol: 'KCS-BTC',
      side: 'buy',
      size: '302.200619100000000000000000',
      price: '0.00011773000000000000',
      takerOrderId: '5c7691885137b94b25d03727',
      time: '1551274376328051537',
      type: 'match',
      makerOrderId: '5c7691755137b94707e78e1e',
      tradeId: '5c769188ab93db7636aa2915' }
    */

    //console.log(datum);

    let { symbol, time, side, size, price, tradeId, makerOrderId, takerOrderId } = datum;
    let market = this._tradeSubs.get(symbol);

    if(time.length === 19){
      time = time.substring(0, 13);
    }

    return new Trade({
      exchange: "KuCoin",
      base: market.base,
      quote: market.quote,
      tradeId: tradeId,
      side: side,
      unix: parseInt(time),
      price: price,
      amount: size,
      buyOrderId: (side === 'buy')?makerOrderId:takerOrderId,
      sellOrderId: (side === 'sell')?makerOrderId:takerOrderId,
    });
  }

  _constructL3Update(msg) {
    /*{ sequence: '1550467702817',
     symbol: 'BTC-USDT',
     side: 'sell',
     size: '0.05007408',
     orderId: '5c76c5a4c788c6156bba818b',
     price: '3814.69999989000000000000',
     time: '1551287716429140299',
     type: 'open',
     remainSize: '0.05007408' }
    */

    //if(msg.type !== 'match')return;

    let remote_id = msg.symbol;
    let market = this._level3UpdateSubs.get(remote_id);

    let asks = (msg.side === 'sell')?[new Level3Point(msg.orderId, msg.price, msg.size)]:[];
    let bids = (msg.side === 'buy')?[new Level3Point(msg.orderId, msg.price, msg.size)]:[];

    return new Level3Update({
      exchange: "KuCoin",
      base: market.base,
      quote: market.quote,
      timestampMs: new Date().getTime(),
      asks,
      bids,
    });

  }

  _constructL2Update(msg) {
    /*{
    "sequenceStart":1545896669105,
    "sequenceEnd":1545896669106,
    "symbol":"BTC-USDT",
    "changes":{
      "asks":[["6","1","1545896669105"]],           //price, size, sequence
      "bids":[["4","1","1545896669106"]]
    }
  }
    */

    let remote_id = msg.symbol;
    let market = this._level2UpdateSubs.get(remote_id);
    let asks = msg.changes.asks.map(p => new Level2Point(p[0], p[1]));
    let bids = msg.changes.bids.map(p => new Level2Point(p[0], p[1]));
    return new Level2Update({
      exchange: "KuCoin",
      base: market.base,
      quote: market.quote,
      timestampMs: new Date().getTime(),
      asks,
      bids,
    });
  }

  _requestLevel2Snapshots() {
    if (this.requestSnapshot) {
      for (let market of this._level2UpdateSubs.values()) {
        this._requestLevel2Snapshot(market);
      }
    }
  }

  async _requestLevel2Snapshot(market) {
    this._restSem.take(async () => {
      try {
        winston.info(`requesting snapshot for ${market.id}`);
        let remote_id = market.id;
        let uri = `https://api.kucoin.com/api/v1/market/orderbook/level2_100?symbol=${remote_id}`;
        let raw = await https.get(uri);

        let asks = raw.data.asks.map(p => new Level2Point(p[0], p[1]));
        let bids = raw.data.bids.map(p => new Level2Point(p[0], p[1]));
        let snapshot = new Level2Snapshot({
          exchange: "KuCoin",
          base: market.base,
          quote: market.quote,
          asks,
          bids,
        });
        this.emit("l2snapshot", snapshot);
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

module.exports = KucoinClient;
