# Contributing to CCXWS

## Adding Exchanges

The following tips are useful when implementing exchanges:

### Clients
- Add client and the corresponding integration test fil to `src/exchanges` folder
- Client that support multiple market subscriptions on the same websocket should implement `base-client.js`, refer to `hitbtc-client.js`, `zb-client.js`, etc for some examples.
- `base-client.js` implements the correct external interface for CCXWS, reconnection logic, and dead connection logic for a single connection. This largely takes the heavy lifting of implementing an exchange out of your hands for exchanges that implement a decent multi-market per socket API.
- Some exchange only support a single market per socket. You can implement `basic-multiclient.js` which uses `basic-client.js` under the covers.  `basic-multi-client.js` creates a new `basic-client.js` implementation for each market that is connected to it. Refer to `coinex-client.js` or `cex-client.js`.
- The subscribe methods (`subsribeTrades`, `subscribeTicker`, etc) take a single market as the argument. The client should expect that a subscribe method will be called with many markets in quick succession. Some exchanges will drop the connection if too many messages are sent in quick succession.  You can use a semaphore to throttle the sending of messages. Refer to `hitbtc-client.js`, `okex-client.js` as examples of implementing semaphore.  Be sure to clear out semaphores on connection events!

### Order Books
- Order books can be level 1 (top bid/ask), level 2 (volume aggregated by price), or level 3 (raw orders)
- Order books APIs may be snapshots (full order book), updates (changes since last update), or a may allow both snapshots and updates
- Depth APIs are aggregates of order books at set price intervals (0, 0.1, 0.01, etc). A depth API at the smallest granularity is indistinguishable from a raw level 2 order book
- Order book updates always need to start with an order book snapshot request. This makes order book maintenance simpler by broadcasting a snapshot event at the start of the update event stream.
- Some exchanges do not support querying the order book snapshot via the WebSocket API, in that rare case, we will execute a REST query for the orderbook snapshot.

## Testing

Always add unit tests to validate the conditions of the You can run a specific test by running 

```bash
$(npm bin)/mocha src/exchanges/hitbtc-client.spec.js
```

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
