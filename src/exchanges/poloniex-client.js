const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");
const Level2Snapshot = require("../level2-snapshot");
const https = require("../https");

class PoloniexClient extends BasicClient {
  constructor({ autoloadSymbolMaps = true } = {}) {
    super("wss://api2.poloniex.com/", "Poloniex");
    this._idMap = new Map();
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Updates = true;
    this._subbedToTickers = false;
    this.on("connected", this._resetSubCount.bind(this));

    this.TICKERS_ID = 1002;
    this.MARKET_IDS = new Map();

    if (autoloadSymbolMaps) {
      this.loadSymbolMaps().catch(err => this.emit("error", err));
    }
  }

  /**
    Poloniex uses numeric identifiers for its markets.
    A static map of these markets can be obtained from:
    https://docs.poloniex.com/#currency-pair-ids

    We can use the ticker REST API as a mechanism to obtain
    the identifiers and create an index of id to symbol.
   */
  async loadSymbolMaps() {
    let uri = "https://poloniex.com/public?command=returnTicker";
    let result = await https.get(uri);
    for (let symbol in result) {
      let id = result[symbol].id;
      this.MARKET_IDS.set(id, symbol);
    }
  }

  _resetSubCount() {
    this._subCount = {};
    this._subbedToTickers = false;
  }

  _sendSubTicker() {
    if (this._subbedToTickers) return; // send for first request
    this._subbedToTickers = true;
    this._wss.send(
      JSON.stringify({
        command: "subscribe",
        channel: this.TICKERS_ID,
      })
    );
  }

  _sendUnsubTicker() {
    if (this._tickerSubs.size) return; // send when no more
    this._subbedToTickers = false;
    this._wss.send(
      JSON.stringify({
        command: "unsubscribe",
        channel: this.TICKERS_ID,
      })
    );
  }

  _sendSubTrades(remote_id) {
    this._sendSubscribe(remote_id);
  }

  _sendUnsubTrades(remote_id) {
    this._sendUnsubscribe(remote_id);
  }

  _sendSubLevel2Updates(remote_id) {
    this._sendSubscribe(remote_id);
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._sendUnsubscribe(remote_id);
  }

  _sendSubscribe(remote_id) {
    this._subCount[remote_id] = (this._subCount[remote_id] || 0) + 1; // increment market counter
    // if we have more than one sub, ignore the request as we're already subbed
    if (this._subCount[remote_id] > 1) return;

    this._wss.send(
      JSON.stringify({
        command: "subscribe",
        channel: remote_id,
      })
    );
  }

  _sendUnsubscribe(remote_id) {
    this._subCount[remote_id] -= 1; // decrement market count

    // if we still have subs, then leave channel open
    if (this._subCount[remote_id]) return;

    this._wss.send(
      JSON.stringify({
        command: "unsubscribe",
        channel: remote_id,
      })
    );
  }

  _onMessage(raw) {
    // different because messages are broadcast as joined updates
    // [148,540672082,[["o",1,"0.07313000","7.21110596"],["t","43781170",0,"0.07313000","0.00199702",1528900825]]]
    // we need to pick apart these messages and broadcast them accordingly

    let msg = JSON.parse(raw);
    let id = msg[0];
    let seq = msg[1];
    let updates = msg[2];

    // tickers
    if (id === this.TICKERS_ID && updates) {
      let remoteId = this.MARKET_IDS.get(updates[0]);
      let market = this._tickerSubs.get(remoteId);
      if (!market) return;

      let ticker = this._createTicker(updates, market);
      this.emit("ticker", ticker, market);
      return;
    }

    if (!updates) return;

    let bids = [];
    let asks = [];

    for (let update of updates) {
      switch (update[0]) {
        // when connection is first established it will send an 'info' packet
        // that can be used to map the "id" to the market_symbol
        case "i": {
          let remote_id = update[1].currencyPair;
          this._idMap.set(id, remote_id);

          // capture snapshot if we're subscribed to l2updates
          let market = this._level2UpdateSubs.get(remote_id);
          if (!market) continue;

          let snapshot = this._constructoLevel2Snapshot(seq, update[1], market);
          this.emit("l2snapshot", snapshot, market);
          break;
        }
        // trade events will stream-in after we are subscribed to the channel
        // and hopefully after the info packet has been sent
        case "t": {
          let market = this._tradeSubs.get(this._idMap.get(id));
          if (!market) continue;

          let trade = this._constructTradeFromMessage(update, market);
          this.emit("trade", trade, market);
          break;
        }

        case "o": {
          // only include updates if we are subscribed to the market
          let market = this._level2UpdateSubs.get(this._idMap.get(id));
          if (!market) continue;

          //[171, 280657226, [["o", 0, "0.00225182", "0.00000000"], ["o", 0, "0.00225179", "860.66363984"]]]
          //[171, 280657227, [["o", 1, "0.00220001", "0.00000000"], ["o", 1, "0.00222288", "208.47334089"]]]
          let point = new Level2Point(update[2], update[3]);
          if (update[1] === 0) asks.push(point);
          if (update[1] === 1) bids.push(point);

          break;
        }
      }
    }

    // check if we have bids/asks and construct order update message
    if (bids.length || asks.length) {
      let market = this._level2UpdateSubs.get(this._idMap.get(id));
      if (!market) return;

      let l2update = new Level2Update({
        exchange: "Poloniex",
        base: market.base,
        quote: market.quote,
        sequenceId: seq,
        asks,
        bids,
      });
      this.emit("l2update", l2update, market);
    }
  }

  _createTicker(update, market) {
    let [, last, ask, bid, percent, quoteVol, baseVol, , high, low] = update;
    let open = parseFloat(last) / (1 + parseFloat(percent));
    let dayChange = parseFloat(last) - open;
    return new Ticker({
      exchange: "Poloniex",
      base: market.base,
      quote: market.quote,
      timestamp: Date.now(),
      last,
      open: open.toFixed(8),
      high,
      low,
      volume: baseVol,
      quoteVolume: quoteVol,
      change: dayChange.toFixed(8),
      changePercent: percent,
      ask,
      bid,
    });
  }

  _constructTradeFromMessage(update, market) {
    let [, trade_id, side, price, size, unix] = update;

    side = side === 1 ? "buy" : "sell";
    unix = unix * 1000;
    trade_id = parseInt(trade_id);

    return new Trade({
      exchange: "Poloniex",
      base: market.base,
      quote: market.quote,
      tradeId: trade_id.toFixed(),
      side,
      unix,
      price,
      amount: size,
    });
  }

  _constructoLevel2Snapshot(seq, update, market) {
    let [asksObj, bidsObj] = update.orderBook;
    let asks = [];
    let bids = [];
    for (let price in asksObj) {
      asks.push(new Level2Point(price, asksObj[price]));
    }
    for (let price in bidsObj) {
      bids.push(new Level2Point(price, bidsObj[price]));
    }
    return new Level2Snapshot({
      exchange: "Poloniex",
      base: market.base,
      quote: market.quote,
      sequenceId: seq,
      asks,
      bids,
    });
  }
}

module.exports = PoloniexClient;
