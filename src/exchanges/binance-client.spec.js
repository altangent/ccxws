const Binance = require("./binance-client");
jest.mock("winston", () => ({ info: jest.fn() }));

let client;
let market = {
  id: "ETHBTC",
  base: "ETH",
  quote: "BTC",
};

beforeAll(() => {
  client = new Binance();
});

test("it should support tickers", () => {
  expect(client.hasTickers).toBeTruthy();
});

test("it should support trades", () => {
  expect(client.hasTrades).toBeTruthy();
});

test("it should support level2 snapshots", () => {
  expect(client.hasLevel2Snapshots).toBeTruthy();
});

test("it should support level2 updates", () => {
  expect(client.hasLevel2Updates).toBeTruthy();
});

test("it should not support level3 snapshots", () => {
  expect(client.hasLevel3Snapshots).toBeFalsy();
});

test("it should not support level3 updates", () => {
  expect(client.hasLevel3Updates).toBeFalsy();
});

test("should subscribe and emit ticker events", done => {
  client.subscribeTicker(market);
  client.on("ticker", ticker => {
    expect(ticker.fullId).toMatch("Binance:ETH/BTC");
    expect(ticker.timestamp).toBeGreaterThan(1531677480465);
    expect(typeof ticker.last).toBe("string");
    expect(parseFloat(ticker.last)).toBeGreaterThan(0);
    expect(typeof ticker.dayHigh).toBe("string");
    expect(typeof ticker.dayLow).toBe("string");
    expect(typeof ticker.dayVolume).toBe("string");
    expect(typeof ticker.dayChange).toBe("string");
    expect(typeof ticker.dayChangePercent).toBe("string");
    expect(parseFloat(ticker.dayHigh)).toBeGreaterThan(0);
    expect(parseFloat(ticker.dayLow)).toBeGreaterThan(0);
    expect(parseFloat(ticker.dayVolume)).toBeGreaterThan(0);
    expect(parseFloat(ticker.dayChange)).toBeGreaterThan(0);
    expect(parseFloat(ticker.dayChangePercent)).toBeDefined();
    done();
  });
});

test(
  "should subscribe and emit trade events",
  done => {
    client.subscribeTrades(market);
    client.on("trade", trade => {
      expect(trade.fullId).toMatch("Binance:ETH/BTC");
      expect(trade.exchange).toMatch("Binance");
      expect(trade.base).toMatch("ETH");
      expect(trade.quote).toMatch("BTC");
      expect(trade.tradeId).toBeGreaterThan(0);
      expect(trade.unix).toBeGreaterThan(1522540800000);
      expect(trade.side).toMatch(/buy|sell/);
      expect(typeof trade.price).toBe("string");
      expect(typeof trade.amount).toBe("string");
      expect(parseFloat(trade.price)).toBeGreaterThan(0);
      expect(parseFloat(trade.amount)).toBeGreaterThan(0);
      done();
    });
  },
  30000
);

test("should subscribe and emit level2 snapshots", done => {
  client.subscribeLevel2Snapshots(market);
  client.on("l2snapshot", snapshot => {
    expect(snapshot.fullId).toMatch("Binance:ETH/BTC");
    expect(snapshot.exchange).toMatch("Binance");
    expect(snapshot.base).toMatch("ETH");
    expect(snapshot.quote).toMatch("BTC");
    expect(snapshot.sequenceId).toBeGreaterThan(0);
    expect(snapshot.timestampMs).toBeUndefined();
    expect(parseFloat(snapshot.asks[0].price)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(snapshot.asks[0].size)).toBeGreaterThanOrEqual(0);
    expect(snapshot.asks[0].count).toBeUndefined();
    expect(parseFloat(snapshot.bids[0].price)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(snapshot.bids[0].size)).toBeGreaterThanOrEqual(0);
    expect(snapshot.bids[0].count).toBeUndefined();
    done();
  });
});

test("should subscribe and emit level2 updates", done => {
  client.subscribeLevel2Updates(market);
  client.on("l2update", update => {
    expect(update.fullId).toMatch("Binance:ETH/BTC");
    expect(update.exchange).toMatch("Binance");
    expect(update.base).toMatch("ETH");
    expect(update.quote).toMatch("BTC");
    expect(update.sequenceId).toBeGreaterThan(0);
    expect(update.lastSequenceId).toBeGreaterThan(update.sequenceId);
    expect(parseFloat(update.asks[0].price)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(update.asks[0].size)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(update.bids[0].price)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(update.bids[0].size)).toBeGreaterThanOrEqual(0);
    done();
  });
});

test("should unsubscribe from tickers", () => {
  client.unsubscribeTicker(market);
});

test("should unsubscribe from trades", () => {
  client.unsubscribeTrades(market);
});

test("should unsubscribe from level2 snapshots", () => {
  client.unsubscribeLevel2Snapshots(market);
});

test("should unsubscribe from level2 updates", () => {
  client.unsubscribeLevel2Updates(market);
});

test("should close connections", done => {
  client.on("closed", done);
  client.close();
});
