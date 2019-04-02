const BasicClient = require("../basic-client");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");
const moment = require("moment");

class BitmexClient extends BasicClient {
  /**
    Documentation:
    https://www.bitmex.com/app/wsAPI
   */
  constructor() {
    super("wss://www.bitmex.com/realtime", "BitMEX");
    this.hasTrades = true;
    this.hasLevel2Updates = true;
    this.constructL2Price = true;
    this.l2PriceMap = new Map();
  }

  _sendSubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "subscribe",
        args: [`trade:${remote_id}`],
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

  _sendUnsubTrades(remote_id) {
    this._wss.send(
      JSON.stringify({
        op: "unsubscribe",
        args: [`trade:${remote_id}`],
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

    if (table === "trade") {
      if (action !== "insert") return;
      for (let datum of message.data) {
        let trade = this._constructTrades(datum);
        this.emit("trade", trade);
      }
      return;
    }

    if (table === "orderBookL2") {
      /**
        The partial action is sent when there is a new subscription. It contains
        the snapshot of data. Updates may arrive prior to the snapshot but can
        be discarded.

        Otherwise it will be an insert, update, or delete action. All three of
        those will be handles in l2update messages.
       */
      if (action === "partial") {
        let snapshot = this._constructLevel2Snapshot(message.data);
        this.emit("l2snapshot", snapshot);
      } else {
        let update = this._constructLevel2Update(message);
        this.emit("l2update", update);
      }
      return;
    }
  }

  _constructTrades(datum) {
    let { size, side, timestamp, price, trdMatchID } = datum;

    // Load the market
    let remote_id = datum.symbol;
    let market = this._tradeSubs.get(remote_id);

    // Handle race condition on unsubscribe where we may still
    // be processing data.
    if (!market) return;

    let unix = moment(timestamp).valueOf();
    return new Trade({
      market,
      exchange: "BitMEX",
      base: market.base,
      quote: market.quote,
      id: remote_id,
      tradeId: trdMatchID.replace(/-/g, ""),
      unix,
      side: side.toLowerCase(),
      price: price.toFixed(8),
      amount: size.toFixed(8),
      raw: datum, // attach the raw data incase it is needed in raw format
    });
  }

  /**
    Snapshot message are sent when an l2orderbook is subscribed to.
    This part is necessary to maintain a proper orderbook because
    BitMEX sends updates with a unique price key and does not
    include a price value. This code will maintain the price map
    so that update messages can be constructed with a price.
   */
  _constructLevel2Snapshot(data) {
    // Load the market
    let remote_id = data[0].symbol;
    let market = this._level2UpdateSubs.get(remote_id);

    // Handle race condition on unsubscribe where we may still
    // be processing data.
    if (!market) return;

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
      market,
      exchange: "BitMEX",
      base: market.base,
      quote: market.quote,
      id: remote_id,
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
  _constructLevel2Update(msg) {
    // get the data from the message
    let data = msg.data;
    let action = msg.action;

    // ge the market for the remote symbol
    let remote_id = data[0].symbol;
    let market = this._level2UpdateSubs.get(remote_id);

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
      if (datum.symbol !== remote_id) {
        throw new Error(`l2update symbol mismatch, expected ${remote_id}, got ${datum.symbol}`);
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
      market,
      exchange: "BitMEX",
      base: market.base,
      quote: market.quote,
      id: remote_id,
      asks,
      bids,
    });
  }
}

module.exports = BitmexClient;
