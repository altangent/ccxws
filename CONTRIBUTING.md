# Contributing to CCXWS

CCXWS is an open-source project that welcomes contributors of all skill levels. We ask that you read the contributing guide below to help everyone be on the same page. Welcome and don't be shy!

## Creating Issues

All are welcome to create an issue!

The project includes several templates that will assist with intake of information for exchange integration and resolving issues. We will do our best to reply as soon as possible and may ask for your assistance in reproducing issues. Some can be difficult to track down.

## Contributing Code

We have a few requests for code contributors to help keep things orderly!

1. Before creating a pull request you should create an issue, if one does not already exist, to track the change(s) you will be making. This creates a place for a broader discussion about the reason and intent of changes. Once an issue has been acknowledged, you can submit a pull request.

2. Like most open-source projects on GitHub, this project uses the [GitHub workflow](https://guides.github.com/introduction/flow/). Outside contributors to the project can create patches by forking the repository, creating a branch, and then submitting a pull request on GitHub. The pull request will be reviewed by the project maintainers. After the changes have been reviewed and the code passes CI, the code can be merged into the master branch. The review process will likely have a conversation and back and forth on changes that should be made to make the patch ready for merge.

3. To facilitate back and forth while you are developing, you can create a [_draft_ pull request](https://github.blog/2019-02-14-introducing-draft-pull-requests/) early in your development process. The draft pull request will allow discussion of code and architecture and will signal that the code is still a work in progress. We highly recommend this since it helps get eyes on code earlier in the process and makes coding more collaborative.

4. Commits in your pull requests they should be atomic and minimal. Please do not submit large single commits or mix minor changes with major changes. We may ask you to restructure your commits. Well structured commits allow each commit to be reviewed indpendently and should pass CI on their own.

Commit messages should follow the format:

```
area: general description of the change

Longer description of what changed and a description
of why the change is occuring and how it was fixed.

Reference issue numbers
```

Please wrap commit comments at 72 characters. [More information](https://chris.beams.io/posts/git-commit/) on writing good commit messages.

To facilitate clean commit messages and the review process you will likely need to use interactive rebase for commits.

```
git rebase -i <sha1-of-commit>^
```

You can then mark the commit that should change with `edit`, commit your changes, and continue the rebase. This may require you to force push to your branch. More information on [stackoverflow](https://stackoverflow.com/a/8825163).

## Adding Exchanges

Integrating a new exchange is challenging. Making CCXWS consistent across a variety of different socket strategies is no easy task. This section contains some tools and tips to help get an exchange integrated!

Our firs request is that we ask you to provide ample documentation. At a minimum:

- Please provide a general description of how the exchanges functions. It is extremely valuable when other developers try to figure out the nuances of each exchange and have a quick synopsis of how the exchange works.
- Please document example JSON that is used when parsing. This helps developers quickly reference what the parsing code is concretely doing.

### General Exchange Integration Process

- Create a new client file in `src/exchanges` that extends from `BasicClient` if possible
- Create client test suite in `__tests__/exchanges`
- Add export to `index.js`
- Add exchange to CI in `.github/workflows/node.yml`
- Add exchange details to `README.md`

### BasicClient

Each exchange is slightly different. The current iteration of CCXWS provides a basic class that allows for extension of common methods. Work is being done in a new issue to make this process simpler.

The `BasicClient` provides the following functionality:

1. Create the standard external interface used by all CCXWS clients
2. Provides `subscribe`/`unsubscribe` methods that
   1. Creates a socket if one doesn't exist
   2. Maintains a `Set` of markets subscribed to the particular feed (tickers, trades, etc). These sets are stored in protected variables (`_tickerSubs` `_tradesSubs`, `_level2UpdateSubs`, etc) which may be need to be referenced.
   3. Calls the corresponding `_sendSub*` method to send the request to the server
3. Control reconnection logic for the socket to resubscribe on failures.

The `BasicClient` abstract much of connection boilerplate and lets you focus on sending and receiving messages.

You can use the template below as a starting point for a new exchange. You will likely need to make many customizations to get things working smoothly. Refer to a list of common patterns below.

```javascript
const BasicClient = require("../basic-client");
const Ticker = require("../ticker");
const Trade = require("../trade");
const Level2Point = require("../level2-point");
const Level2Snapshot = require("../level2-snapshot");
const Level2Update = require("../level2-update");

class SampleClient extends BasicClient {
  constructor({ wssPath = "some-url", watcherMs } = {}) {
    super(wssPath, "Sample", undefined, watcherMs);

    this.hasTickers = true;
    this.hasTrades = true;
    this.hasLevel2Updates = true;
  }

  _sendSubTicker(remote_id) {
    this._wss.send(
      JSON.stringify({
        action: "subscribe",
        type: "ticker",
        channel: [remote_id],
      })
    );
  }

  _sendUnsubTicker() {
    this._wss.send(
      JSON.stringify({
        action: "unsubscribe",
        type: "ticker",
        channel: [remote_id],
      })
    );
  }

  _sendSubTrades() {
    this._wss.send(
      JSON.stringify({
        action: "subscribe",
        type: "trades",
        channel: [remote_id],
      })
    );
  }

  _sendUnsubTrades() {
    this._wss.send(
      JSON.stringify({
        action: "unsubscribe",
        type: "trades",
        channel: [remote_id],
      })
    );
  }

  _sendSubLevel2Updates() {
    this._wss.send(
      JSON.stringify({
        action: "subscribe",
        type: "orderbook",
        channel: [remote_id],
      })
    );
  }

  _sendUnsubLevel2Snapshots() {
    this._wss.send(
      JSON.stringify({
        action: "unsubscribe",
        type: "orderbook",
        channel: [remote_id],
      })
    );
  }

  _onMessage(raw) {
    let msg = JSON.parse(raw);

    // tickers
    if (msg.type === "ticker") {
      let market = this._tickerSubs.get(msg.symbol);
      if (!market) return;

      let ticker = this._constructTicker(msg, market);
      this.emit("ticker", ticker, market);
      return;
    }

    // trade
    if (msg.type === "trade") {
      let market = this._tradeSubs.get(msg.symbol);
      if (!market) return;

      let trade = this._constructTrade(msg, market);
      this.emit("trade", trade, market);
      return;
    }

    // l2 snapshot
    if (msg.type === "orderbook-snapshot") {
      let market = this._level2UpdateSubs.get(msg.symbol);
      if (!market) return;

      let snapshot = this._constructLevel2Snapshot(msg, market);
      this.emit("l2snapshot", snapshot, market);
      return;
    }

    // l2 snapshot
    if (msg.type === "orderbook-update") {
      let market = this._level2UpdateSubs.get(msg.symbol);
      if (!market) return;

      let snapshot = this._constructLevel2Update(msg, market);
      this.emit("l2snapshot", snapshot, market);
      return;
    }
  }

  _constructTicker(msg, market) {
    return new Ticker({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestamp: parseInt(timestamp),
      last: msg.trade_price,
      open: msg.opening_price,
      high: msg.high_price,
      low: msg.low_price,
      volume: msg.acc_trade_volume,
      quoteVolume: (acc_trade_volume * trade_price).toFixed(8),
      change: msg.change_price,
      changePercent: msg.change_rate,
    });
  }

  _constructTrade(datum, market) {
    return new Trade({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      tradeId: msg.sequential_id,
      side: datum.ask_bid === "bid" ? "buy" : "sell",
      unix: Number(msg.trade_timestamp),
      price: msg.trade_price,
      amount: msg.trade_volume,
    });
  }

  _constructLevel2Snapshot(msg, market) {
    let asks = msg.orderbook_units.map(p => new Level2Point(p.ask_price, p.ask_size));
    let bids = msg.orderbook_units.map(p => new Level2Point(p.bid_price, p.bid_size));
    return new Level2Snapshot({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestampMs: msg.timestamp,
      asks,
      bids,
    });
  }

  _constructLevel2Update(msg, market) {
    let asks = msg.orderbook_units.map(p => new Level2Point(p.ask_price, p.ask_size));
    let bids = msg.orderbook_units.map(p => new Level2Point(p.bid_price, p.bid_size));
    return new Level2Update({
      exchange: this._name,
      base: market.base,
      quote: market.quote,
      timestampMs: msg.timestamp,
      asks,
      bids,
    });
  }
}

module.exports = SampleClient;
```

### Common Patterns

Below are a number of common patterns that are used throughout the clients. There is work in progress to make this logic more composible. For now, we ask that you maintain consistency where possible to make future refactoring easier!

#### Rate limits

Many exchanges limit the number of subscriptions you can make in a given amount of time. There are several helpers that exist to limit the number of messages that can be sent.

The general pattern is that a general `_sendMessage` method is used to send all messages to the socket. The `flowcontrol/throttle` helper is used to throttle requests based on a configured frequency. One gotcha is that the helper must be cleared when the socket disconnects to prevent sending on a closed socket.

```javascript
  constructor(/** ... **/) {
    /** ... **/
    this._sendMessage = throttle(this._sendMessage.bind(this), socketThrottleMs);
  }

  _onClosing() {
    this._sendMessage.cancel();
    super._onClosing();
  }

  _sendMessage(msg) {
    this._wss.send(msg);
  }

  _sendSubTickers(remote_id) {
    this._sendMessage(/** construct appropriate message **/);
  }

  _sendSubTrades(remote_id) {
    this._sendMessage(/** construct appropriate message **/);
  }
```

Examples: [okex](/src/exchanges/okex-client.js), [bibox](/src/exchanges/bibox-client.js), [hitbtc](/src/exchanges/hitbtc-client.js)

#### Batched Requests

Many exchanges require sending the full list of markets that should be subscribed to. When this occurs you may need to defer sending the subscription for a period of time so there isn't thrashing. We can use the `florwcontrol/debouce` or `flowcontrol/batch` helper methods.

The general pattern is that `_sendSub*` method is wrapped with a `flowcontrol/debounce` or `flowcontrol/batch` helper. This helper will only call the underlying function after a duration of inactivity has elapsed. At that point, the `_sendSub*` method can be use the the full subscription `Set` or the batched arguments. One gotcha is taht the helper must be cleared when the socket disconnects to prevent sending on a closed socket.

Use `flowcontrol/debounce` when you use the subscription `Set`.

```javascript
  constructor(/** ... **/) {
    /** ... **/
    this._sendSubTrades = debounce(this._sendSubTrades.bind(this), 100);
  }

  _onClosing() {
    this._sendSubTrades_.cancel();
    super._onClosing();
  }

  _sendSubTrades() {
    let symbols = Array.from(this._tradeSubs.keys());
    this._wss.send(
      JSON.stringify({
        type: "trades",
        symbols,
      })
    );
  }
```

Refer to: [bithumb](/src/exchanges/bithumb-client.js)

Use `flowcontrol/batch` when you just want to batch all arguments in some debounce duration:

```javascript
  constructor(/** ... **/) {
    /** ... **/
    this._sendSubTrades = batch(this._sendSubTrades.bind(this));
  }

  _onClosing() {
    this._sendSubTrades_.cancel();
    super._onClosing();
  }

  _sendSubTrades(args) {
    const symbols = args.map(p => p[0]);
    this._wss.send(
      JSON.stringify({
        type: "trades",
        symbols,
      })
    );
  }
```

Refer to: [binance](/src/exchanges/binance-base.js)

#### Multiple Sockets

The basic client only supports a single socket. Some exchanges require each market to be their own socket. Some limit the number of subscriptions per socket.

Regardless of the reason, for exchanges that require multiple sockets connections you can implement `basic-multiclient.js`. This class uses `basic-client.js` under the covers. `basic-multi-client.js` creates a new `basic-client.js` implementation for each market that is connected to it. This has a lot of complexity and overhead and we are actively lookign to resolve this with a future refactor.

Refer to: [coinex](/src/exchanges/coinex-client.js), [cex](/src/exchanges/cex-client.js)

#### Sending Pings

Some exchanges require you to send a ping message periodically. The complexity here is that you need to only send ping messages when the socket is connected. We hook into the socket events in order to achieve that:

```javascript
  _beforeConnect() {
    this._wss.on("connected", this._startPing.bind(this));
    this._wss.on("disconnected", this._stopPing.bind(this));
    this._wss.on("closed", this._stopPing.bind(this));
  }

  _startPing() {
    clearInterval(this._pingInterval);
    this._pingInterval = setInterval(this._sendPing.bind(this), 15000);
  }

  _stopPing() {
    clearInterval(this._pingInterval);
  }

  _sendPing() {
    if (this._wss) {
      this._wss.send("ping");
    }
  }
```

Refer to: [okex](/src/exchanges/okex-client.js), [coinex](/src/exchanges/coinex-client.js)

#### Sending Pongs

Some exchange send ping messages and expect a pong messages. These can be handled in the message handler.

```javascript
  _sendPong(id) {
    this._wss.send(JSON.stringify({ pong: id }));
  }

  _onMessage(raw) {
    let msg = JSON.stringify(raw);

    if (msg.ping) {
      this._sendPong(msg.ping);
      return;
    }

    /** other stuff **/
  }
```

Refer to: [bibox](/src/exchanges/bibox-client.js)

#### Heartbeat

Heartbeats can be used by an exchange to indicate the socket is still alive. For exchanges that support this we can use the heartbeat to reset the connection watcher allowing for better dection of a dropped connection.

Some exchanges require explicitly subscribing to a heartbeat which can be done by watching for the `connected` event, . Others will automatically send the heartbeat. Either way, you can handle a heartbeat message in the `_onMessage` handler.

```javascript

  _beforeConnect() {
    this._wss.on("connected", () => this._sendHeartbeat());
  }

  _sendHeartbeat() {
    this._wss.send(/** some message **/);
  }

  _onMessage(msg) {
    const json = JSON.parse(msg);

    if (json.type === "heartbeat") {
      this._watcher.markAlive();
      return;
    }

    /** other stuff  **/
  }
```

Refer to: [ledgerx](/src/exchanges/ledgerx-client.js), [bittrex](/src/exchanges/bittrex-client.js)

#### Level2 Snapshot REST Requests

Many exchanges include a L2 snapshot over the websocket when you subscribe to the order book update stream. Some exchanges require you to fetch this information from a REST endpoint.

The general pattern here is to create a REST method that gets called whenever the `_sendSubLevel2Updates` message is sent. This can combined with throttling to prevent over subscribing to the remote server:

```javascript
  consructor(/** somt stuff **/) {
    this.requestSnapshot = true;
    this._requestLevel2Snapshot = throttle(this._requestLevel2Snapshot.bind(this), restThrottleMs);
  }

  _sendSubLevel2Updates(remote_id) {
    if (this.requestSnapshot) {
      this._requestLevel2Snapshot(this._level2UpdateSubs.get(remote_id));
    }
    this._wss.send(/** some socket message **/);
  }

  async _requestLevel2Snapshot(market) {
    try {
      let remote_id = market.id;
      let uri = `${this._restL2SnapshotPath}?symbol=${remote_id}`;
      let raw = await https.get(uri);
      let sequenceId = raw.lastUpdateId;
      let timestampMs = raw.E;
      let asks = raw.asks.map(p => new Level2Point(p[0], p[1]));
      let bids = raw.bids.map(p => new Level2Point(p[0], p[1]));
      let snapshot = new Level2Snapshot({
        exchange: this._name,
        base: market.base,
        quote: market.quote,
        sequenceId,
        timestampMs,
        asks,
        bids,
      });
      this.emit("l2snapshot", snapshot, market);
    } catch (ex) {
      this.emit("error", ex);
    }
  }
```

Refer to: [binance](/src/exchanges/binance-base.js), [bithumb](/src/exchanges/bithumb-client.js), [bittrex](/src/exchanges/bittrex-client.js), [kucoin](/src/exchanges/kucoin-client.js)

#### Authentication or Asynchronous Connections

Some exchanges require authentication before you can begin sending requests. This functionality is not part of the core library (yet). The general process idea is the `_onConnected` method is overriden and initiates the authorization or asynchronous request. Once the request is complete, the `super._onConnected()` method is invoked to initialize the socket.

Refer to: [cex](/src/exchanges/cex-client.js), [bittrex](/src/exchanges/bittrex-client.js), [kucoin](/src/exchanges/kucoin-client.js)

#### Preload Market Identifiers

Some exchanges use identifiers that must be loaded from the exchange at the time that the client is instantiated. These are usually loaded upfront and used during the subscription process from cached data.

```javascript
  constructor({ /** stuff **/ autoloadSymbolMaps = true } = {}) {
    /** stuff **/

    this.MARKET_IDS = new Map();
    if (autoloadSymbolMaps) {
      this.loadSymbolMaps().catch(err => this.emit("error", err));
    }
  }

  async loadSymbolMaps() {
    let result = await https.get(/** some uri **/);
    for (let symbol in result) {
      let id = result[symbol].id;
      this.MARKET_IDS.set(id, symbol);
    }
  }
```

Refer to: [poloniex](/src/exchanges/poloniex-client.js), [liquid](/src/exchanges/liquid-client.js), [kraken](/src/exchanges/kraken-client.js)

### Order Books

- Order books can be level 1 (top bid/ask), level 2 (volume aggregated by price), or level 3 (raw orders)
- Order books APIs may be snapshots (full order book), updates (changes since last update), or a may allow both snapshots and updates
- Depth APIs are aggregates of order books at set price intervals (0, 0.1, 0.01, etc). A depth API at the smallest granularity is indistinguishable from a raw level 2 order book
- Order book updates always need to start with an order book snapshot request. This makes order book maintenance simpler by broadcasting a snapshot event at the start of the update event stream.
- Some exchanges do not support querying the order book snapshot via the WebSocket API, in that rare case, we will execute a REST query for the orderbook snapshot, patterns below.

### Numerics vs Strings

CCXWS returns all numeric types as strings, with the exception of the unix timestamp. For reference, refer to the API documentation for [Ticker](https://github.com/altangent/ccxws#ticker), [Trade](https://github.com/altangent/ccxws#ticker), [Level2Point](https://github.com/altangent/ccxws#level2point), and [Level3Point](https://github.com/altangent/ccxws#level3point).

Numeric values are returned as strings to prevent data loss. JavaScript Numeric type is stored as an IEEE 754 floating point value. The maximum number of signicant digits is 15, meaning that large integers and floating point values will result in precision loss.

Many exchanges return API results with numeric values as strings already. In the event that an exchange does not return values as strings, you can take two options:

1. Convert numerics to strings with `.toFixed(8)`
2. Preprocess the raw message string and wrap numerics with double quotes prior to running `JSON.parse`

The former method is preferred if an exchange does not return values that overflow (refer to the number of digits being sent). The latter is required when data would overflow due to the exchange sending large numeric types.

Lastly, when adding an exchange's unit tests, ensure that you perform type assertions to guarantee that results are returned as strings.

## Testing and CI

Make sure you add a test file to `__tests__` for the client using the standard spec template.

You can run tests for an individual exchange with:

```bash
$(npm bin)/mocha __tests__/exchanges/hitbtc-client.spec.js
```

You can run all tests (which takes a while) via:

```bash
npm test
```

### Development Testing

It is often useful to create a `test.js` file (which is excluded from git) in the root of the application and directly exercise your code outside of unit tests
code. For example:

```javascript
let ccxws = require("./src");

// HitBTC
let market1 = { id: "BTCUSD", base: "BTC", quote: "USDT" };
let market2 = { id: "ETHBTC", base: "ETH", quote: "BTC" };
let client = new ccxws.hitbtc();

//////////////////////////////////

client.subscribeTicker(market);
client.on("ticker", console.log);

// client.subscribeTrades(market);
// client.on("trade", t => console.log(t));

// client.subscribeLevel2Snapshots(market);
// client.on("l2snapshot", console.log);

// client.subscribeLevel2Updates(market);
// client.on("l2update", console.log);
```
