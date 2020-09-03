const BasicClient = require("../basic-client");
const https = require("../https");
const Trade = require("../trade");
const Level3Point = require("../level3-point");
const Level3Update = require("../level3-update");
const Level3Snapshot = require("../level3-snapshot");

/**
 * LedgerX is defined in https://docs.ledgerx.com/reference#market-data-feed
 * This socket uses a unified stream for ALL market data. So we will leverage
 * subscription filtering to only reply with values that of are of interest.
 */
class LedgerXClient extends BasicClient {
  constructor({ wssPath = "wss://trade.ledgerx.com/api/ws?token=", apiKey, watcherMs } = {}) {
    super(wssPath + apiKey, "LedgerX", undefined, watcherMs);

    this.hasTrades = true;
    this.hasLevel3Updates = true;
    this.runId = 0;
    this.apiKey = apiKey;
  }

  _sendSubTrades() {}

  _sendUnsubTrades() {}

  _sendSubLevel3Updates(remote_id, market) {
    this._requestLevel3Snapshot(market);
  }

  _sendUnSubLevel3Updates() {}

  _onMessage(msg) {
    const json = JSON.parse(msg);

    if (json.type === "auth_success") {
      return;
    }

    if (json.type === "book_top") {
      return;
    }

    if (json.type === "exposure_reports") {
      return;
    }

    if (json.type === "open_positions_update") {
      return;
    }

    if (json.type === "collateral_balance_update") {
      return;
    }

    if (json.type === "heartbeat") {
      this._watcher.markAlive();

      // update the run_id if it's changed
      if (this.runId !== json.run_id) {
        this.runId = json.run_id;
      }
      return;
    }

    if (json.type === "action_report") {
      // insert event
      if (json.status_type === 200) {
        const market = this._level3UpdateSubs.get(json.contract_id.toFixed());
        if (!market) return;

        const update = this._constructL3Insert(json, market);
        this.emit("l3update", update, market, json);
        return;
      }

      // trade event
      if (json.status_type === 201) {
        if (this._tradeSubs.has(json.contract_id)) {
          const market = this._tradeSubs.get(json.contract_id.toFixed());
          const trade = this._constructTrade(json);
          this.emit("trade", trade, market, json);
        }

        if (this._level3UpdateSubs.has(json.contract_id)) {
          const market = this._level3UpdateSubs.get(json.contract_id.toFixed());
          if (!market) return;

          const update = this._constructL3Trade(json, market);
          this.emit("l3update", update, market, json);
        }

        return;
      }

      // cancel event
      if (json.status_type === 203) {
        const market = this._level3UpdateSubs.get(json.contract_id.toFixed());
        if (!market) return;

        const update = this._constructL3Cancel(json, market);
        this.emit("l3update", update, market, json);
        return;
      }
    }
  }

  /**
   * Obtains the orderbook via REST
   */
  async _requestLevel3Snapshot(market) {
    try {
      let uri = `https://trade.ledgerx.com/api/book-states/${market.id}?token=${this.apiKey}`;
      let { data } = await https.get(uri);
      let sequenceId = data.clock;
      let asks = [];
      let bids = [];
      for (let row of data.book_states) {
        let orderId = row.mid;
        let price = (row.price / 100).toFixed(2);
        let size = row.size.toFixed();
        let point = new Level3Point(orderId, price, size);
        if (row.is_ask) asks.push(point);
        else bids.push(point);
      }
      let snapshot = new Level3Snapshot({
        exchange: this._name,
        base: market.base,
        quote: market.quote,
        sequenceId,
        asks,
        bids,
      });
      this.emit("l3snapshot", snapshot, market);
    } catch (ex) {
      // TODO handle this properly
      this.emit("error", ex);
    }
  }

  /**
   {
      mid: 'f4c34b09de0b4064a33b7b46f8180022',
      filled_size: 5,
      size: 0,
      inserted_price: 0,
      updated_time: 1597173352257155800,
      inserted_size: 0,
      timestamp: 1597173352257176800,
      ticks: 78678024531551,
      price: 0,
      original_price: 16000,
      status_type: 201,
      order_type: 'customer_limit_order',
      status_reason: 52,
      filled_price: 16000,
      is_volatile: false,
      clock: 24823,
      vwap: 16000,
      is_ask: false,
      inserted_time: 1597173352257155800,
      type: 'action_report',
      original_size: 5,
      contract_id: 22204639
    }
    {
      mid: '885be81549974faf88e4430f6046513d',
      filled_size: 5,
      size: 0,
      inserted_price: 0,
      updated_time: 1597164994095326700,
      inserted_size: 0,
      timestamp: 1597173352258250800,
      ticks: 78678025605522,
      price: 0,
      original_price: 16000,
      status_type: 201,
      order_type: 'customer_limit_order',
      status_reason: 0,
      filled_price: 16000,
      is_volatile: false,
      clock: 24824,
      vwap: 16000,
      is_ask: true,
      inserted_time: 1597164994095326700,
      type: 'action_report',
      original_size: 10,
      contract_id: 22204639
    }
   */
  _constructTrade(msg, market) {
    return new Trade({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      tradeId: msg.mid,
      unix: Math.floor(msg.timestamp / 1e6),
      side: msg.is_ask ? "sell" : "buy",
      price: msg.filled_price.toFixed(8),
      amount: msg.filled_price.toFixed(8),
    });
  }

  /**
   {
      inserted_time: 1597176131501325800,
      timestamp: 1597176131501343700,
      filled_size: 0,
      ticks: 81457268698527,
      size: 1000,
      contract_id: 22202469,
      filled_price: 0,
      inserted_price: 165100,
      inserted_size: 1000,
      vwap: 0,
      is_volatile: true,
      mid: 'eecd8297c1dc42f1985f67c909540631',
      original_price: 165100,
      order_type: 'customer_limit_order',
      updated_time: 1597176131501325800,
      original_size: 1000,
      status_type: 200,
      status_reason: 0,
      type: 'action_report',
      price: 165100,
      clock: 260,
      is_ask: false
    }
   */
  _constructL3Insert(msg, market) {
    let price = (msg.price / 100).toFixed(8);
    let size = msg.inserted_size.toFixed(8);
    let point = new Level3Point(msg.mid, price, size, {
      order_type: msg.order_type,
      status_type: msg.status_type,
      status_reason: msg.status_reason,
      is_volatile: msg.is_volatile,
      timestamp: msg.timestamp,
      ticks: msg.ticks,
      inserted_time: msg.inserted_time,
      updated_time: msg.updated_time,
      original_price: msg.original_price,
      original_size: msg.original_size,
      inserted_price: msg.inserted_price,
      inserted_size: msg.inserted_size,
      filled_price: msg.filled_price,
      filled_size: msg.filled_size,
      price: msg.price,
      size: msg.size,
      vwap: msg.vwap,
    });

    let asks = [];
    let bids = [];

    if (msg.is_ask) asks.push(point);
    else bids.push(point);

    return new Level3Update({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      sequenceId: msg.clock,
      timestampMs: Math.floor(msg.inserted_time / 1e6),
      rundId: this.runId,
      asks,
      bids,
    });
  }

  /**
  {
      mid: '885be81549974faf88e4430f6046513d',
      filled_size: 5,
      size: 0,
      inserted_price: 0,
      updated_time: 1597164994095326700,
      inserted_size: 0,
      timestamp: 1597173352258250800,
      ticks: 78678025605522,
      price: 0,
      original_price: 16000,
      status_type: 201,
      order_type: 'customer_limit_order',
      status_reason: 0,
      filled_price: 16000,
      is_volatile: false,
      clock: 24824,
      vwap: 16000,
      is_ask: true,
      inserted_time: 1597164994095326700,
      type: 'action_report',
      original_size: 10,
      contract_id: 22204639
    }
  */
  _constructL3Trade(msg, market) {
    let price = (msg.original_price / 100).toFixed(8);
    let size = (msg.original_size - msg.filled_size).toFixed(8);
    let point = new Level3Point(msg.mid, price, size, {
      order_type: msg.order_type,
      status_type: msg.status_type,
      status_reason: msg.status_reason,
      is_volatile: msg.is_volatile,
      timestamp: msg.timestamp,
      ticks: msg.ticks,
      inserted_time: msg.inserted_time,
      updated_time: msg.updated_time,
      original_price: msg.original_price,
      original_size: msg.original_size,
      inserted_price: msg.inserted_price,
      inserted_size: msg.inserted_size,
      filled_price: msg.filled_price,
      filled_size: msg.filled_size,
      price: msg.price,
      size: msg.size,
      vwap: msg.vwap,
    });

    let asks = [];
    let bids = [];

    if (msg.is_ask) asks.push(point);
    else bids.push(point);

    return new Level3Update({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      sequenceId: msg.clock,
      timestampMs: Math.floor(msg.inserted_time / 1e6),
      runId: this.runId,
      asks,
      bids,
    });
  }

  /**
   {
      inserted_time: 1597176853952381700,
      timestamp: 1597176857137740800,
      filled_size: 0,
      ticks: 82182905095242,
      size: 0,
      contract_id: 22204631,
      filled_price: 0,
      inserted_price: 0,
      inserted_size: 0,
      vwap: 0,
      is_volatile: true,
      mid: 'b623fdd6fae14fcbbcb9ab3b6b9b3771',
      original_price: 51300,
      order_type: 'customer_limit_order',
      updated_time: 1597176853952381700,
      original_size: 1,
      status_type: 203,
      status_reason: 0,
      type: 'action_report',
      price: 0,
      clock: 506,
      is_ask: false
    }
   */
  _constructL3Cancel(msg, market) {
    let price = (msg.original_price / 100).toFixed(8);
    let size = (0).toFixed(8);
    let point = new Level3Point(msg.mid, price, size, {
      order_type: msg.order_type,
      status_type: msg.status_type,
      status_reason: msg.status_reason,
      is_volatile: msg.is_volatile,
      timestamp: msg.timestamp,
      ticks: msg.ticks,
      inserted_time: msg.inserted_time,
      updated_time: msg.updated_time,
      original_price: msg.original_price,
      original_size: msg.original_size,
      inserted_price: msg.inserted_price,
      inserted_size: msg.inserted_size,
      filled_price: msg.filled_price,
      filled_size: msg.filled_size,
      price: msg.price,
      size: msg.size,
      vwap: msg.vwap,
    });

    let asks = [];
    let bids = [];

    if (msg.is_ask) asks.push(point);
    else bids.push(point);

    return new Level3Update({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      sequenceId: msg.clock,
      timestampMs: Math.floor(msg.inserted_time / 1e6),
      runId: this.runId,
      asks,
      bids,
    });
  }
}

module.exports = LedgerXClient;
