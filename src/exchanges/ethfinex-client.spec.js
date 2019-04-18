const Ethfinex = require("./ethfinex-client");
jest.mock("winston", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.retryTimes(3);

let client;
let market = {
  id: "BTCUSD",
  base: "BTC",
  quote: "USD",
};

describe("EthfinexClient", () => {
  beforeAll(() => {
    client = new Ethfinex();
  });

  test("it should support tickers", () => {
    expect(client.hasTickers).toBeTruthy();
  });

  test("it should support trades", () => {
    expect(client.hasTrades).toBeTruthy();
  });

  test("it should not support level2 snapshots", () => {
    expect(client.hasLevel2Snapshots).toBeFalsy();
  });

  test("it should support level2 updates", () => {
    expect(client.hasLevel2Updates).toBeTruthy();
  });

  test("it should not support level3 snapshots", () => {
    expect(client.hasLevel3Snapshots).toBeFalsy();
  });

  test("it should support level3 updates", () => {
    expect(client.hasLevel3Updates).toBeTruthy();
  });

  test("should subscribe and emit ticker events", done => {
    client.subscribeTicker(market);
    client.on("ticker", (ticker, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/BTCUSD/);
      expect(ticker.fullId).toMatch("Ethfinex:BTC/USD");
      expect(ticker.timestamp).toBeGreaterThan(1531677480465);
      expect(typeof ticker.last).toBe("string");
      expect(typeof ticker.open).toBe("string");
      expect(typeof ticker.high).toBe("string");
      expect(typeof ticker.low).toBe("string");
      expect(typeof ticker.volume).toBe("string");
      expect(typeof ticker.change).toBe("string");
      expect(typeof ticker.changePercent).toBe("string");
      expect(typeof ticker.bid).toBe("string");
      expect(typeof ticker.bidVolume).toBe("string");
      expect(typeof ticker.ask).toBe("string");
      expect(typeof ticker.askVolume).toBe("string");
      expect(parseFloat(ticker.last)).toBeGreaterThan(0);
      expect(parseFloat(ticker.open)).toBeGreaterThan(0);
      expect(parseFloat(ticker.high)).toBeGreaterThan(0);
      expect(parseFloat(ticker.low)).toBeGreaterThan(0);
      expect(parseFloat(ticker.volume)).toBeGreaterThan(0);
      expect(ticker.quoteVolume).toBeUndefined();
      expect(isNaN(parseFloat(ticker.change))).toBeFalsy();
      expect(isNaN(parseFloat(ticker.changePercent))).toBeFalsy();
      expect(parseFloat(ticker.bid)).toBeGreaterThan(0);
      expect(parseFloat(ticker.bidVolume)).toBeGreaterThan(0);
      expect(parseFloat(ticker.ask)).toBeGreaterThan(0);
      expect(parseFloat(ticker.askVolume)).toBeGreaterThan(0);
      done();
    });
  });

  test("should subscribe and emit trade events", done => {
    client.subscribeTrades(market);
    client.on("trade", (trade, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/BTCUSD/);
      expect(trade.fullId).toMatch("Ethfinex:BTC/USD");
      expect(trade.exchange).toMatch("Ethfinex");
      expect(trade.base).toMatch("BTC");
      expect(trade.quote).toMatch("USD");
      expect(trade.tradeId).toBeGreaterThan(0);
      expect(trade.unix).toBeGreaterThan(1522540800000);
      expect(trade.side).toMatch(/buy|sell/);
      expect(typeof trade.price).toBe("string");
      expect(typeof trade.amount).toBe("string");
      expect(parseFloat(trade.price)).toBeGreaterThan(0);
      expect(parseFloat(trade.amount)).toBeGreaterThan(0);
      done();
    });
  }, 30000);

  test("should subscribe and emit level2 snapshot and updates", done => {
    let hasSnapshot = false;
    client.subscribeLevel2Updates(market);
    client.on("l2snapshot", (snapshot, market) => {
      hasSnapshot = true;
      expect(market).toBeDefined();
      expect(market.id).toMatch(/BTCUSD/);
      expect(snapshot.fullId).toMatch("Ethfinex:BTC/USD");
      expect(snapshot.exchange).toMatch("Ethfinex");
      expect(snapshot.base).toMatch("BTC");
      expect(snapshot.quote).toMatch("USD");
      expect(snapshot.sequenceId).toBeUndefined();
      expect(snapshot.timestampMs).toBeUndefined();
      expect(parseFloat(snapshot.asks[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.asks[0].size)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.asks[0].count)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.bids[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.bids[0].size)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.bids[0].count)).toBeGreaterThanOrEqual(0);
    });
    client.on("l2update", (update, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/BTCUSD/);
      expect(hasSnapshot).toBeTruthy();
      expect(update.fullId).toMatch("Ethfinex:BTC/USD");
      expect(update.exchange).toMatch("Ethfinex");
      expect(update.base).toMatch("BTC");
      expect(update.quote).toMatch("USD");
      expect(update.sequenceId).toBeUndefined();
      expect(update.timestampMs).toBeUndefined();
      let point = update.asks[0] || update.bids[0];
      expect(parseFloat(point.price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(point.size)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(point.count)).toBeGreaterThanOrEqual(0);
      done();
    });
  });

  test("should subscribe and emit level3 snapshot and updates", done => {
    let hasSnapshot = false;
    client.subscribeLevel3Updates(market);
    client.on("l3snapshot", (snapshot, market) => {
      hasSnapshot = true;
      expect(market).toBeDefined();
      expect(market.id).toMatch(/BTCUSD/);
      expect(snapshot.fullId).toMatch("Ethfinex:BTC/USD");
      expect(snapshot.exchange).toMatch("Ethfinex");
      expect(snapshot.base).toMatch("BTC");
      expect(snapshot.quote).toMatch("USD");
      expect(snapshot.sequenceId).toBeUndefined();
      expect(snapshot.timestampMs).toBeUndefined();
      expect(snapshot.asks[0].orderId).toBeGreaterThan(0);
      expect(parseFloat(snapshot.asks[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.asks[0].size)).toBeGreaterThanOrEqual(0);
      expect(snapshot.bids[0].orderId).toBeGreaterThan(0);
      expect(parseFloat(snapshot.bids[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.bids[0].size)).toBeGreaterThanOrEqual(0);
    });
    client.on("l3update", (update, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/BTCUSD/);
      expect(hasSnapshot).toBeTruthy();
      expect(update.fullId).toMatch("Ethfinex:BTC/USD");
      expect(update.exchange).toMatch("Ethfinex");
      expect(update.base).toMatch("BTC");
      expect(update.quote).toMatch("USD");
      expect(update.sequenceId).toBeUndefined();
      expect(update.timestampMs).toBeUndefined();
      let point = update.asks[0] || update.bids[0];
      expect(point.orderId).toBeGreaterThanOrEqual(0);
      expect(parseFloat(point.price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(point.size)).toBeGreaterThanOrEqual(0);
      done();
    });
  });

  test("should unsubscribe from tickers", () => {
    client.unsubscribeTicker(market);
  });

  test("should unsubscribe from trades", () => {
    client.unsubscribeTrades(market);
  });

  test("should unsubscribe from level2 updates", () => {
    client.unsubscribeLevel2Updates(market);
  });

  test("should unsubscribe from level3 updates", () => {
    client.unsubscribeLevel3Updates(market);
  });

  test("should close connections", done => {
    client.on("closed", done);
    client.close();
  });
});
