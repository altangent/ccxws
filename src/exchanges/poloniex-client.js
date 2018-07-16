const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");
const Level2Snapshot = require("../level2-snapshot");

const TICKERS_ID = 1002;
const MARKET_IDS = {
  7: "BTC_BCN",
  8: "BTC_BELA",
  10: "BTC_BLK",
  12: "BTC_BTCD",
  13: "BTC_BTM",
  14: "BTC_BTS",
  15: "BTC_BURST",
  20: "BTC_CLAM",
  24: "BTC_DASH",
  25: "BTC_DGB",
  27: "BTC_DOGE",
  28: "BTC_EMC2",
  31: "BTC_FLDC",
  32: "BTC_FLO",
  38: "BTC_GAME",
  40: "BTC_GRC",
  43: "BTC_HUC",
  50: "BTC_LTC",
  51: "BTC_MAID",
  58: "BTC_OMNI",
  61: "BTC_NAV",
  63: "BTC_NEOS",
  64: "BTC_NMC",
  69: "BTC_NXT",
  73: "BTC_PINK",
  74: "BTC_POT",
  75: "BTC_PPC",
  83: "BTC_RIC",
  89: "BTC_STR",
  92: "BTC_SYS",
  97: "BTC_VIA",
  98: "BTC_XVC",
  99: "BTC_VRC",
  100: "BTC_VTC",
  104: "BTC_XBC",
  108: "BTC_XCP",
  112: "BTC_XEM",
  114: "BTC_XMR",
  116: "BTC_XPM",
  117: "BTC_XRP",
  121: "USDT_BTC",
  122: "USDT_DASH",
  123: "USDT_LTC",
  124: "USDT_NXT",
  125: "USDT_STR",
  126: "USDT_XMR",
  127: "USDT_XRP",
  129: "XMR_BCN",
  130: "XMR_BLK",
  131: "XMR_BTCD",
  132: "XMR_DASH",
  137: "XMR_LTC",
  138: "XMR_MAID",
  140: "XMR_NXT",
  148: "BTC_ETH",
  149: "USDT_ETH",
  150: "BTC_SC",
  151: "BTC_BCY",
  153: "BTC_EXP",
  155: "BTC_FCT",
  158: "BTC_RADS",
  160: "BTC_AMP",
  162: "BTC_DCR",
  163: "BTC_LSK",
  166: "ETH_LSK",
  167: "BTC_LBC",
  168: "BTC_STEEM",
  169: "ETH_STEEM",
  170: "BTC_SBD",
  171: "BTC_ETC",
  172: "ETH_ETC",
  173: "USDT_ETC",
  174: "BTC_REP",
  175: "USDT_REP",
  176: "ETH_REP",
  177: "BTC_ARDR",
  178: "BTC_ZEC",
  179: "ETH_ZEC",
  180: "USDT_ZEC",
  181: "XMR_ZEC",
  182: "BTC_STRAT",
  183: "BTC_NXC",
  184: "BTC_PASC",
  185: "BTC_GNT",
  186: "ETH_GNT",
  187: "BTC_GNO",
  188: "ETH_GNO",
  189: "BTC_BCH",
  190: "ETH_BCH",
  191: "USDT_BCH",
  192: "BTC_ZRX",
  193: "ETH_ZRX",
  194: "BTC_CVC",
  195: "ETH_CVC",
  196: "BTC_OMG",
  197: "ETH_OMG",
  198: "BTC_GAS",
  199: "ETH_GAS",
  200: "BTC_STORJ",
};

class PoloniexClient extends BasicClient {
  constructor() {
    super("wss://api2.poloniex.com/", "Poloniex");
    this._idMap = new Map();
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Updates = true;
    this.on("connected", this._resetSubCount.bind(this));
  }

  _resetSubCount() {
    this._subCount = {};
  }

  _sendSubTicker() {
    if (this._tickerSubs.size > 1) return; // send for first request
    this._wss.send(
      JSON.stringify({
        command: "subscribe",
        channel: TICKERS_ID,
      })
    );
  }

  _sendUnsubTicker() {
    if (this._tickerSubs.size) return; // send when no more
    this._wss.send(
      JSON.stringify({
        command: "unsubscribe",
        channel: TICKERS_ID,
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
    if (id === 1002 && updates) {
      let remoteId = MARKET_IDS[updates[0]];
      if (this._tickerSubs.has(remoteId)) {
        let ticker = this._createTicker(remoteId, updates);
        this.emit("ticker", ticker);
      }
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

          if (this._level2UpdateSubs.has(remote_id)) {
            let snapshot = this._constructoLevel2Snapshot(seq, update[1]);
            this.emit("l2snapshot", snapshot);
          }

          break;
        }
        // trade events will stream-in after we are subscribed to the channel
        // and hopefully after the info packet has been sent
        case "t": {
          if (this._tradeSubs.has(this._idMap.get(id))) {
            let trade = this._constructTradeFromMessage(id, update);
            this.emit("trade", trade);
          }
          break;
        }

        case "o": {
          if (this._level2UpdateSubs.has(this._idMap.get(id))) {
            //[171, 280657226, [["o", 0, "0.00225182", "0.00000000"], ["o", 0, "0.00225179", "860.66363984"]]]
            //[171, 280657227, [["o", 1, "0.00220001", "0.00000000"], ["o", 1, "0.00222288", "208.47334089"]]]
            let point = new Level2Point(update[2], update[3]);
            if (update[1] === 0) asks.push(point);
            if (update[1] === 1) bids.push(point);
          }
          break;
        }
      }
    }

    // check if we have bids/asks and construct order update message
    if (bids.length || asks.length) {
      let market = this._level2UpdateSubs.get(this._idMap.get(id));
      let l2update = new Level2Update({
        exchange: "Poloniex",
        base: market.base,
        quote: market.quote,
        sequenceId: seq,
        asks,
        bids,
      });
      this.emit("l2update", l2update);
    }
  }

  _createTicker(remoteId, update) {
    let [, last, ask, bid, percent, quoteVol, baseVol, , high, low] = update;
    let market = this._tickerSubs.get(remoteId);
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

  _constructTradeFromMessage(id, update) {
    let [, trade_id, side, price, size, unix] = update;

    // figure out the market symbol
    let remote_id = this._idMap.get(id);
    if (!remote_id) return;

    let market = this._tradeSubs.get(remote_id);

    side = side === 1 ? "buy" : "sell";
    unix = unix * 1000;
    trade_id = parseInt(trade_id);

    return new Trade({
      exchange: "Poloniex",
      base: market.base,
      quote: market.quote,
      tradeId: trade_id,
      side,
      unix,
      price,
      amount: size,
    });
  }

  _constructoLevel2Snapshot(seq, update) {
    let market = this._level2UpdateSubs.get(update.currencyPair);
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
