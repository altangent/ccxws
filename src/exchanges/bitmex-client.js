const BasicClient = require("../basic-client");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");
const Ticker = require("../ticker");
const { CandlePeriod } = require("../enums");
const moment = require("moment");
const Candle = require("../candle");

class BitmexClient extends BasicClient {
  /**
    Documentation:
    https://www.bitmex.com/app/wsAPI
   */
  constructor({ wssPath = "wss://www.bitmex.com/realtime", watcherMs } = {}) {
    super(wssPath, "BitMEX", undefined, watcherMs);
    this.hasTickers = true;
    this.hasTrades = true;
    this.hasCandles = true;
    this.hasLevel2Updates = true;
    this.candlePeriod = CandlePeriod._1m;
    this.constructL2Price = true;
    this.l2PriceMap = new Map();

    /**
     * Keyed from remote_id, market.id
     * */
    this.tickerMap = new Map();
  }

  _sendSubTicker(remote_id) {
    this._sendSubQuote(remote_id);
    this._sendSubTrades(remote_id);
  }

  _sendUnsubTicker(remote_id) {
    this._sendUnsubQuote(remote_id);
    // if we're still subscribed to trades for this symbol, don't unsub
    if (!this._tradeSubs.has(remote_id)) {
      this._sendUnsubTrades(remote_id);
    }
    this._deleteTicker(remote_id);
  }

  _sendSubQuote(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "subscribe",
        args: [`quote:${remote_id}`],
      })
    );
  }

  _sendUnsubQuote(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "unsubscribe",
        args: [`quote:${remote_id}`],
      })
    );
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "subscribe",
        args: [`trade:${remote_id}`],
      })
    );
  }

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "unsubscribe",
        args: [`trade:${remote_id}`],
      })
    );
  }

  _sendSubCandles(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "subscribe",
        args: [`tradeBin${candlePeriod(this.candlePeriod)}:${remote_id}`],
      })
    );
  }

  _sendUnsubCandles(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "unsubscribe",
        args: [`tradeBin${candlePeriod(this.candlePeriod)}:${remote_id}`],
      })
    );
  }

  _sendSubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "subscribe",
        args: [`orderBookL2:${remote_id}`],
      })
    );
  }

  _sendUnsubLevel2Updates(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "unsubscribe",
        args: [`orderBookL2:${remote_id}`],
      })
    );
  }

  _onMessage(msgs) {
    let message = JSON.parse(msgs);
    let { table, action } = message;

    if (table === "quote") {
      this._onQuoteMessage(message);
      return;
    }

    if (table === "trade") {
      if (action !== "insert") return;

      for (let datum of message.data) {
        let remote_id = datum.symbol;

        // trade
        let market = this._tradeSubs.get(remote_id);
        if (market) {
          let trade = this._constructTrades(datum, market);
          this.emit("trade", trade, market);
        }

        // ticker
        market = this._tickerSubs.get(remote_id);
        if (market) {
          const ticker = this._constructTickerForTrade(datum, market);
          if (this._isTickerReady(ticker)) {
            this.emit("ticker", ticker, market);
          }
        }
      }
      return;
    }

    // candles
    if (table && table.startsWith("tradeBin")) {
      for (let datum of message.data) {
        let remote_id = datum.symbol;
        let market = this._candleSubs.get(remote_id);
        if (!market) continue;

        const candle = this._constructCandle(datum);
        this.emit("candle", candle, market);
      }
      return;
    }

    if (table === "orderBookL2") {
      /**
        From testing, we've never encountered non-uniform markets in a single
        message broadcast and will assume uniformity (though we will validate
        in the construction methods).
       */
      let remote_id = message.data[0].symbol;
      let market = this._level2UpdateSubs.get(remote_id);

      if (!market) return;

      /**
        The partial action is sent when there is a new subscription. It contains
        the snapshot of data. Updates may arrive prior to the snapshot but can
        be discarded.

        Otherwise it will be an insert, update, or delete action. All three of
        those will be handles in l2update messages.
       */
      if (action === "partial") {
        let snapshot = this._constructLevel2Snapshot(message.data, market);
        this.emit("l2snapshot", snapshot, market);
      } else {
        let update = this._constructLevel2Update(message, market);
        this.emit("l2update", update, market);
      }
      return;
    }
  }

  _constructTrades(datum, market) {
    let { size, side, timestamp, price, trdMatchID } = datum;
    let unix = moment(timestamp).valueOf();
    return new Trade({
      exchange: "BitMEX",
      base: market.base,
      quote: market.quote,
      id: market.id,
      tradeId: trdMatchID.replace(/-/g, ""),
      unix,
      side: side.toLowerCase(),
      price: price.toFixed(8),
      amount: size.toFixed(8),
      raw: datum, // attach the raw data incase it is needed in raw format
    });
  }

  /**
   {
      table: 'tradeBin1m',
      action: 'insert',
      data: [
        {
          timestamp: '2020-08-12T20:33:00.000Z',
          symbol: 'XBTUSD',
          open: 11563,
          high: 11563,
          low: 11560,
          close: 11560.5,
          trades: 158,
          volume: 157334,
          vwap: 11562.0303,
          lastSize: 4000,
          turnover: 1360824337,
          homeNotional: 13.60824337,
          foreignNotional: 157334
        }
      ]
    }
   */
  _constructCandle(datum) {
    let ts = moment(datum.timestamp).valueOf();
    return new Candle(
      ts,
      datum.open.toFixed(8),
      datum.high.toFixed(8),
      datum.low.toFixed(8),
      datum.close.toFixed(8),
      datum.volume.toFixed(8)
    );
  }

  /**
    Snapshot message are sent when an l2orderbook is subscribed to.
    This part is necessary to maintain a proper orderbook because
    BitMEX sends updates with a unique price key and does not
    include a price value. This code will maintain the price map
    so that update messages can be constructed with a price.
   */
  _constructLevel2Snapshot(data, market) {
    let asks = [];
    let bids = [];
    for (let datum of data) {
      // Construct the price lookup map for all values supplied here.
      // Per the documentation, the id is a unique value for the
      // market and the price.
      if (this.constructL2Price) {
        this.l2PriceMap.set(datum.id, datum.price.toFixed(8));
      }

      // build the data point
      let point = new Level2Point(datum.price.toFixed(8), datum.size.toFixed(8), undefined, {
        id: datum.id,
      });

      // add the datapoint to the asks or bids depending if its sell or bid side
      if (datum.side === "Sell") asks.push(point);
      else bids.push(point);
    }

    // asks arrive in descending order (best ask last)
    // ccxws standardizes so that best bid/ask are array index 0
    asks = asks.reverse();

    return new Level2Snapshot({
      exchange: "BitMEX",
      base: market.base,
      quote: market.quote,
      id: market.id,
      asks,
      bids,
    });
  }

  /**
    Update messages will arrive as either insert, update, or delete
    messages. The data payload appears to be uniform for a market.
    This code will do the heavy lifting on remapping the pricing
    structure. BitMEX sends hte updates without a price and instead
    include a unique identifer for the asset and the price.

    Insert:
      {
        table: 'orderbookL2'
        action: 'insert'
        data: [{ symbol: 'XBTUSD', id: 8799198150, side: 'Sell', size: 1, price: 8018.5 }]
      }

    Update:
      {
        table: 'orderBookL2',
        action: 'update',
        data: [ { symbol: 'XBTUSD', id: 8799595600, side: 'Sell', size: 258136 } ]
      }

    Delete:
      {
        table: 'orderBookL2',
        action: 'delete',
        data: [ { symbol: 'XBTUSD', id: 8799198650, side: 'Sell' } ]
      }

    We will standardize these to the CCXWS format:
      - Insert and update will have price and size
      - Delete will have a size of 0.
   */
  _constructLevel2Update(msg, market) {
    // get the data from the message
    let data = msg.data;
    let action = msg.action;

    let asks = [];
    let bids = [];

    for (let datum of data) {
      let price;
      let size;

      /**
        In our testing, we've always seen message uniformity in the symbols.
        For performance reasons we're going to batch these into a single
        response. But if we have a piece of data that doesn't match the symbol
        we want to throw an error instead of polluting the orderbook with
        bad data.
      */
      if (datum.symbol !== market.id) {
        throw new Error(`l2update symbol mismatch, expected ${market.id}, got ${datum.symbol}`);
      }

      // Find the price based on the price identifier
      if (this.constructL2Price) {
        switch (action) {
          // inserts will contain the price, we need to set these in the map
          // we can also directly use the price value
          case "insert":
            price = datum.price.toFixed(8);
            this.l2PriceMap.set(datum.id, price);
            break;
          // update will require us to look up the price from the map
          case "update":
            price = this.l2PriceMap.get(datum.id);
            break;
          // price will require us to look up the price from the map
          // we also will want to delete the map value since it's
          // no longer needed
          case "delete":
            price = this.l2PriceMap.get(datum.id);
            this.l2PriceMap.delete(datum.id);
            break;
        }
      }

      // Find the size
      switch (action) {
        case "insert":
        case "update":
          size = datum.size.toFixed(8);
          break;
        case "delete":
          size = (0).toFixed(8);
          break;
      }

      if (!price) {
        // eslint-disable-next-line no-console
        console.warn("unknown price", datum);
      }

      // Construct the data point
      let point = new Level2Point(price, size, undefined, { type: action, id: datum.id });

      // Insert into ask or bid
      if (datum.side === "Sell") asks.push(point);
      else bids.push(point);
    }

    // asks arrive in descending order (best ask last)
    // ccxws standardizes so that best bid/ask are array index 0
    asks = asks.reverse();

    return new Level2Update({
      exchange: "BitMEX",
      base: market.base,
      quote: market.quote,
      id: market.id,
      asks,
      bids,
    });
  }

  /**
   * Updates a ticker for a quote update. From
   * testing, quote broadcasts are sorted from oldest to newest and are
   * for a single market. The parent message looks like below and
   * the last object in the array is provided to this method.
   * {
        table: 'quote',
        action: 'insert',
        data: [
          {
            timestamp: '2020-04-17T16:05:57.560Z',
            symbol: 'XBTUSD',
            bidSize: 689279,
            bidPrice: 7055,
            askPrice: 7055.5,
            askSize: 927374
          },
          {
            timestamp: '2020-04-17T16:05:58.016Z',
            symbol: 'XBTUSD',
            bidSize: 684279,
            bidPrice: 7055,
            askPrice: 7055.5,
            askSize: 927374
          }
        ]
      }
   */
  _onQuoteMessage(msg) {
    const data = msg.data;
    const lastQuote = data[data.length - 1];
    const remote_id = lastQuote.symbol;
    const market = this._tickerSubs.get(remote_id);
    if (market) {
      const ticker = this._constructTickerForQuote(lastQuote, market);
      if (this._isTickerReady(ticker)) {
        this.emit("ticker", ticker, market);
      }
    }
  }

  /**
   * Constructs a ticker from a single quote data
    {
      timestamp: '2020-04-17T16:05:58.016Z',
      symbol: 'XBTUSD',
      bidSize: 684279,
      bidPrice: 7055,
      askPrice: 7055.5,
      askSize: 927374
    }
   * @param {*} datum
   * @param {*} market
   */
  _constructTickerForQuote(datum, market) {
    const ticker = this._getTicker(market);
    ticker.ask = datum.askPrice.toFixed();
    ticker.askVolume = datum.askSize.toFixed();
    ticker.bid = datum.bidPrice.toFixed();
    ticker.bidVolume = datum.bidSize.toFixed();
    ticker.timestamp = new Date(datum.timestamp).valueOf();
    return ticker;
  }

  /**
   * Updates a ticker for the market based on the trade informatio
      {
        timestamp: '2020-04-17T16:39:53.324Z',
        symbol: 'XBTUSD',
        side: 'Buy',
        size: 20,
        price: 7062,
        tickDirection: 'ZeroPlusTick',
        trdMatchID: 'e6101cc7-844e-25d2-e4a5-7e71d04439e3',
        grossValue: 283200,
        homeNotional: 0.002832,
        foreignNotional: 20
      }
   * @param {*} data
   * @param {*} market
   */
  _constructTickerForTrade(data, market) {
    const ticker = this._getTicker(market);
    ticker.last = data.price.toFixed();
    ticker.timestamp = new Date(data.timestamp).valueOf();
    return ticker;
  }

  /**
   * Creates a blank ticker for the specified market. The Ticker class is optimized
   * to maintain a consistent shape to prevent shape transitions and reduce garbage.
   * @param {*} market
   */
  _createTicker(market) {
    return new Ticker({
      exchange: "BitMEX",
      base: market.base,
      quote: market.quote,
    });
  }

  /**
   * Retrieves a ticker for the market or constructs one if it doesn't exist
   * @param {string} market
   */
  _getTicker(market) {
    const remote_id = market.id;
    let ticker = this.tickerMap.get(remote_id);
    if (!ticker) {
      ticker = this._createTicker(market);
      this.tickerMap.set(remote_id, ticker);
    }
    return ticker;
  }

  /**
   * Deletes cached ticker data after unsubbing from ticker.
   */
  _deleteTicker(remote_id) {
    delete this.tickerMap.delete(remote_id);
  }

  /**
   * Returns true when all required information is available
   * in the ticker. Because the ticker is built from multiple stream
   * testing will break if a ticker is prematurely emitted that does
   * not contain all of the required data.
   * @param {*} ticker
   */
  _isTickerReady(ticker) {
    return ticker.last && ticker.bid && ticker.ask;
  }
}

function candlePeriod(period) {
  switch (period) {
    case CandlePeriod._1m:
      return "1m";
    case CandlePeriod._5m:
      return "5m";
    case CandlePeriod._1h:
      return "1h";
    case CandlePeriod._1d:
      return "1d";
  }
}

module.exports = BitmexClient;
