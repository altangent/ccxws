const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Update = require("../level2-update");
const Level2Snapshot = require("../level2-snapshot");

const TICKERS_ID = 1002;
const MARKET_IDS = {
  177: "BTC_ARDR",
  253: "BTC_ATOM",
  210: "BTC_BAT",
  189: "BTC_BCH",
  236: "BTC_BCHABC",
  238: "BTC_BCHSV",
  7: "BTC_BCN",
  232: "BTC_BNT",
  14: "BTC_BTS",
  15: "BTC_BURST",
  20: "BTC_CLAM",
  194: "BTC_CVC",
  24: "BTC_DASH",
  162: "BTC_DCR",
  25: "BTC_DGB",
  27: "BTC_DOGE",
  201: "BTC_EOS",
  171: "BTC_ETC",
  148: "BTC_ETH",
  155: "BTC_FCT",
  246: "BTC_FOAM",
  38: "BTC_GAME",
  198: "BTC_GAS",
  185: "BTC_GNT",
  251: "BTC_GRIN",
  43: "BTC_HUC",
  207: "BTC_KNC",
  167: "BTC_LBC",
  213: "BTC_LOOM",
  250: "BTC_LPT",
  163: "BTC_LSK",
  50: "BTC_LTC",
  51: "BTC_MAID",
  229: "BTC_MANA",
  61: "BTC_NAV",
  64: "BTC_NMC",
  248: "BTC_NMR",
  69: "BTC_NXT",
  196: "BTC_OMG",
  58: "BTC_OMNI",
  184: "BTC_PASC",
  249: "BTC_POLY",
  75: "BTC_PPC",
  221: "BTC_QTUM",
  174: "BTC_REP",
  170: "BTC_SBD",
  150: "BTC_SC",
  204: "BTC_SNT",
  168: "BTC_STEEM",
  200: "BTC_STORJ",
  89: "BTC_STR",
  182: "BTC_STRAT",
  92: "BTC_SYS",
  97: "BTC_VIA",
  100: "BTC_VTC",
  108: "BTC_XCP",
  112: "BTC_XEM",
  114: "BTC_XMR",
  116: "BTC_XPM",
  117: "BTC_XRP",
  178: "BTC_ZEC",
  192: "BTC_ZRX",
  211: "ETH_BAT",
  190: "ETH_BCH",
  233: "ETH_BNT",
  195: "ETH_CVC",
  202: "ETH_EOS",
  172: "ETH_ETC",
  199: "ETH_GAS",
  186: "ETH_GNT",
  208: "ETH_KNC",
  214: "ETH_LOOM",
  166: "ETH_LSK",
  230: "ETH_MANA",
  197: "ETH_OMG",
  222: "ETH_QTUM",
  176: "ETH_REP",
  205: "ETH_SNT",
  169: "ETH_STEEM",
  179: "ETH_ZEC",
  193: "ETH_ZRX",
  254: "USDC_ATOM",
  235: "USDC_BCH",
  237: "USDC_BCHABC",
  239: "USDC_BCHSV",
  224: "USDC_BTC",
  243: "USDC_DOGE",
  225: "USDC_ETH",
  247: "USDC_FOAM",
  252: "USDC_GRIN",
  244: "USDC_LTC",
  242: "USDC_STR",
  226: "USDC_USDT",
  241: "USDC_XMR",
  240: "USDC_XRP",
  245: "USDC_ZEC",
  255: "USDT_ATOM",
  212: "USDT_BAT",
  191: "USDT_BCH",
  234: "USDT_BNT",
  121: "USDT_BTC",
  122: "USDT_DASH",
  216: "USDT_DOGE",
  203: "USDT_EOS",
  173: "USDT_ETC",
  149: "USDT_ETH",
  217: "USDT_GNT",
  209: "USDT_KNC",
  215: "USDT_LOOM",
  218: "USDT_LSK",
  123: "USDT_LTC",
  231: "USDT_MANA",
  124: "USDT_NXT",
  223: "USDT_QTUM",
  175: "USDT_REP",
  219: "USDT_SC",
  206: "USDT_SNT",
  125: "USDT_STR",
  126: "USDT_XMR",
  127: "USDT_XRP",
  180: "USDT_ZEC",
  220: "USDT_ZRX",
  129: "XMR_BCN",
  132: "XMR_DASH",
  137: "XMR_LTC",
  138: "XMR_MAID",
  140: "XMR_NXT",
  181: "XMR_ZEC",
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
