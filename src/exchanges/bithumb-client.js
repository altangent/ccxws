const moment = require("moment");
const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");
const Level2Snapshot = require("../level2-snapshot");
const https = require("../https");
const { debounce } = require("../flowcontrol/debounce");
const { throttle } = require("../flowcontrol/throttle");

class BithumbClient extends BasicClient {
  constructor({ wssPath = "wss://pubwss.bithumb.com/pub/ws", watcherMs } = {}) {
    super(wssPath, "Bithumb", undefined, watcherMs);
    this._restL2SnapshotPath = "https://api.bithumb.com/public/orderbook";
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Updates = true;
    this.remoteIdMap = new Map();

    this.restThrottleMs = 50;

    this._requestLevel2Snapshot = throttle(this._requestLevel2Snapshot.bind(this), this.restThrottleMs); // prettier-ignore
    this._sendSubTicker = debounce(this._sendSubTicker.bind(this));
    this._sendSubTrades = debounce(this._sendSubTrades.bind(this));
    this._sendSubLevel2Updates = debounce(this._sendSubLevel2Updates.bind(this));
  }

  _sendSubTicker() {
    let symbols = Array.from(this._tickerSubs.keys());
    this._wss.send(
      JSON.stringify({
        type: "ticker",
        symbols,
        tickTypes: ["24H"],
      })
    );
  }

  _sendUnsubTicker() {}

  _sendSubTrades() {
    let symbols = Array.from(this._tradeSubs.keys());
    this._wss.send(
      JSON.stringify({
        type: "transaction",
        symbols,
      })
    );
  }

  _sendUnsubTrades() {}

  _sendSubLevel2Updates() {
    let symbols = Array.from(this._level2UpdateSubs.keys());
    for (let symbol of symbols) {
      this._requestLevel2Snapshot(this._level2UpdateSubs.get(symbol));
    }
    this._wss.send(
      JSON.stringify({
        type: "orderbookdepth",
        symbols,
      })
    );
  }

  _sendUnsubLevel2Updates() {}

  _onMessage(raw) {
    let msg = JSON.parse(raw);

    // console.log(raw);

    // tickers
    if (msg.type === "ticker") {
      let remoteId = msg.content.symbol;
      let market = this._tickerSubs.get(remoteId);
      if (!market) return;

      let ticker = this._constructTicker(msg.content, market);
      this.emit("ticker", ticker, market);
      return;
    }

    // trades
    if (msg.type === "transaction") {
      for (let datum of msg.content.list) {
        let remoteId = datum.symbol;
        let market = this._tradeSubs.get(remoteId);
        if (!market) return;

        let trade = this._constructTrade(datum, market);
        this.emit("trade", trade, market);
      }
      return;
    }

    // l2pudate
    if (msg.type === "orderbookdepth") {
      let remoteId = msg.content.list[0].symbol;
      let market = this._level2UpdateSubs.get(remoteId);
      if (!market) return;

      let update = this._constructL2Update(msg, market);
      this.emit("l2update", update, market);
      return;
    }
  }

  /**
    {
      "type":"ticker",
      "content":{
        "tickType":"24H",
        "date":"20200814",
        "time":"063809",
        "openPrice":"13637000",
        "closePrice":"13714000",
        "lowPrice":"13360000",
        "highPrice":"13779000",
        "value":"63252021221.2101",
        "volume":"4647.44384349",
        "sellVolume":"2372.30829641",
        "buyVolume":"2275.03363265",
        "prevClosePrice":"13601000",
        "chgRate":"0.56",
        "chgAmt":"77000",
        "volumePower":"95.89",
        "symbol":"BTC_KRW"
      }
    }
   */
  _constructTicker(data, market) {
    let timestamp = moment.parseZone(data.date + data.time + "+09:00", "YYYYMMDDhhmmssZ").valueOf();
    return new Ticker({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestamp,
      last: data.closePrice,
      open: data.openPrice,
      high: data.highPrice,
      low: data.lowPrice,
      volume: data.volume,
      quoteVolume: data.value,
      change: data.chgAmt,
      changePercent: data.chgRate,
    });
  }

  /**
   {
     "type":"transaction",
     "content":
     {
       "list":
       [
         {
          "buySellGb":"1",
          "contPrice":"485900",
          "contQty":"0.196",
          "contAmt":"95236.400",
          "contDtm":"2020-08-14 06:28:41.621909",
          "updn":"dn",
          "symbol":"ETH_KRW"
        },
        {
          "buySellGb":"2",
          "contPrice":"486400",
          "contQty":"5.4277",
          "contAmt":"2640033.2800",
          "contDtm":"2020-08-14 06:28:42.453539",
          "updn":"up",
          "symbol":"ETH_KRW"
        }
      ]
    }
  }
   */
  _constructTrade(datum, market) {
    let unix = moment.parseZone(datum.contDtm + "+09:00", "YYYY-MM-DD hh:mm:ss.SSSSSS").valueOf();
    let side = datum.buySellGb == 1 ? "buy" : "sell";
    let price = datum.contPrice;
    let amount = datum.contQty;
    return new Trade({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      side,
      unix,
      price,
      amount,
    });
  }

  /**
   {
      "type": "orderbookdepth",
      "content": {
        "list": [
          {
            "symbol": "BTC_KRW",
            "orderType": "ask",
            "price": "13811000",
            "quantity": "0",
            "total": "0"
          },
          {
            "symbol": "BTC_KRW",
            "orderType": "ask",
            "price": "13733000",
            "quantity": "0.0213",
            "total": "1"
          },
          {
            "symbol": "BTC_KRW",
            "orderType": "bid",
            "price": "6558000",
            "quantity": "0",
            "total": "0"
          },
          {
            "symbol": "BTC_KRW",
            "orderType": "bid",
            "price": "13728000",
            "quantity": "0.0185",
            "total": "1"
          }
        ],
        "datetime": "1597355189967132"
      }
    }
   */
  _constructL2Update(msg, market) {
    let timestampMs = Math.trunc(Number(msg.content.datetime) / 1000);

    let asks = [];
    let bids = [];

    for (let data of msg.content.list) {
      let point = new Level2Point(data.price, data.quantity, data.total);
      if (data.orderType === "bid") bids.push(point);
      else asks.push(point);
    }

    return new Level2Update({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestampMs,
      asks,
      bids,
      datetime: msg.content.datetime,
    });
  }

  async _requestLevel2Snapshot(market) {
    let failed = false;
    try {
      let remote_id = market.id;
      let uri = `${this._restL2SnapshotPath}/${remote_id}`;
      let raw = await https.get(uri);
      let timestampMs = Number(raw.data.timestamp);
      let asks = raw.data.asks.map(p => new Level2Point(p.price, p.quantity));
      let bids = raw.data.bids.map(p => new Level2Point(p.price, p.quantity));
      let snapshot = new Level2Snapshot({
        exchange: this._name,
        base: market.base,
        quote: market.quote,
        timestampMs,
        asks,
        bids,
      });
      this.emit("l2snapshot", snapshot, market);
    } catch (ex) {
      this.emit("error", ex);
      failed = true;
    } finally {
      if (failed) this._requestLevel2Snapshot(market);
    }
  }
}

module.exports = BithumbClient;
