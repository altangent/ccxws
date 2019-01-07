const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");
const Level2Snapshot = require("../level2-snapshot");

const TICKERS_ID = 1002;
const MARKET_IDS = {
  7: "BTC_BCN",
  14: "BTC_BTS",
  15: "BTC_BURST",
  20: "BTC_CLAM",
  25: "BTC_DGB",
  27: "BTC_DOGE",
  24: "BTC_DASH",
  38: "BTC_GAME",
  43: "BTC_HUC",
  50: "BTC_LTC",
  51: "BTC_MAID",
  58: "BTC_OMNI",
  61: "BTC_NAV",
  64: "BTC_NMC",
  69: "BTC_NXT",
  75: "BTC_PPC",
  89: "BTC_STR",
  92: "BTC_SYS",
  97: "BTC_VIA",
  100: "BTC_VTC",
  108: "BTC_XCP",
  114: "BTC_XMR",
  116: "BTC_XPM",
  117: "BTC_XRP",
  112: "BTC_XEM",
  148: "BTC_ETH",
  150: "BTC_SC",
  155: "BTC_FCT",
  162: "BTC_DCR",
  163: "BTC_LSK",
  167: "BTC_LBC",
  168: "BTC_STEEM",
  170: "BTC_SBD",
  171: "BTC_ETC",
  174: "BTC_REP",
  177: "BTC_ARDR",
  178: "BTC_ZEC",
  182: "BTC_STRAT",
  184: "BTC_PASC",
  185: "BTC_GNT",
  189: "BTC_BCH",
  192: "BTC_ZRX",
  194: "BTC_CVC",
  196: "BTC_OMG",
  198: "BTC_GAS",
  200: "BTC_STORJ",
  201: "BTC_EOS",
  204: "BTC_SNT",
  207: "BTC_KNC",
  210: "BTC_BAT",
  213: "BTC_LOOM",
  221: "BTC_QTUM",
  232: "BTC_BNT",
  229: "BTC_MANA",
  246: "BTC_FOAM",
  236: "BTC_BCHABC",
  238: "BTC_BCHSV",
  248: "BTC_NMR",
  249: "BTC_POLY",
  250: "BTC_LPT",
  121: "USDT_BTC",
  216: "USDT_DOGE",
  122: "USDT_DASH",
  123: "USDT_LTC",
  124: "USDT_NXT",
  125: "USDT_STR",
  126: "USDT_XMR",
  127: "USDT_XRP",
  149: "USDT_ETH",
  219: "USDT_SC",
  218: "USDT_LSK",
  173: "USDT_ETC",
  175: "USDT_REP",
  180: "USDT_ZEC",
  217: "USDT_GNT",
  191: "USDT_BCH",
  220: "USDT_ZRX",
  203: "USDT_EOS",
  206: "USDT_SNT",
  209: "USDT_KNC",
  212: "USDT_BAT",
  215: "USDT_LOOM",
  223: "USDT_QTUM",
  234: "USDT_BNT",
  231: "USDT_MANA",
  129: "XMR_BCN",
  132: "XMR_DASH",
  137: "XMR_LTC",
  138: "XMR_MAID",
  140: "XMR_NXT",
  181: "XMR_ZEC",
  166: "ETH_LSK",
  169: "ETH_STEEM",
  172: "ETH_ETC",
  176: "ETH_REP",
  179: "ETH_ZEC",
  186: "ETH_GNT",
  190: "ETH_BCH",
  193: "ETH_ZRX",
  195: "ETH_CVC",
  197: "ETH_OMG",
  199: "ETH_GAS",
  202: "ETH_EOS",
  205: "ETH_SNT",
  208: "ETH_KNC",
  211: "ETH_BAT",
  214: "ETH_LOOM",
  222: "ETH_QTUM",
  233: "ETH_BNT",
  230: "ETH_MANA",
  224: "USDC_BTC",
  243: "USDC_DOGE",
  244: "USDC_LTC",
  242: "USDC_STR",
  226: "USDC_USDT",
  241: "USDC_XMR",
  240: "USDC_XRP",
  225: "USDC_ETH",
  245: "USDC_ZEC",
  235: "USDC_BCH",
  247: "USDC_FOAM",
  237: "USDC_BCHABC",
  239: "USDC_BCHSV",
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
