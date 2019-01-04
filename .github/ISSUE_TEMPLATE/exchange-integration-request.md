---
name: Exchange integration request
about: Suggest addition of an exchange

---

Please provide as much information as possible to make the addition of the exchange easier:

**Exchange URL**
Provide the URL to the exchange

**Exchange API URL**
Provide the URL for the documentation of the exchange's realtime API

**Additional information about Websocket connection**


---

Refer to [Contributing Guide](https://github.com/altangent/ccxws/blob/master/CONTRIBUTING.md) for additional information.

- Create client in `src/exchanges` that follows CCXWS library interface (refer to README)
- Create client test suite in `src/exchanges` to validate subscribe/unsubscribe methods and that data parsing is correct
- Add a lowercase export to `index.js`
- Implement subscribe to tickers sending logic
   - must support calling subscribe multiple times in a row with different markets
- Implement subscribe to trades
  - must support calling multiple times in a row with different markets
- Implement subscribe to orderbooks/depth
  - should default to highest limit and highest resolution interval
  - determine if exchange supports snapshots, updates, or both
  - if exchange supports broadcasting depth updates, CCXWS should initiate a snapshot request when subscribe for a market is called and broadcast a snapshot event
