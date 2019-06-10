const Bitstamp = require("./bitstamp-client");
jest.mock("winston", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.retryTimes(3);

let client;
let market = {
  id: "btcusd",
  base: "BTC",
  quote: "USD",
};

describe("BitstampClient", () => {
  beforeAll(() => {
    client = new Bitstamp();
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

  test("should subscribe and emit trade events", done => {
    client.subscribeTrades(market);
    client.on("trade", (trade, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/btcusd/);
      expect(trade.fullId).toMatch("Bitstamp:BTC/USD");
      expect(trade.exchange).toMatch("Bitstamp");
      expect(trade.base).toMatch("BTC");
      expect(trade.quote).toMatch("USD");
      expect(trade.tradeId).toBeGreaterThan(0);
      expect(trade.unix).toBeGreaterThan(1522540800000);
      expect(trade.unix).toBeLessThanOrEqual(Date.now());
      expect(trade.side).toMatch(/buy|sell/);
      expect(typeof trade.price).toBe("string");
      expect(typeof trade.amount).toBe("string");
      expect(parseFloat(trade.price)).toBeGreaterThan(0);
      expect(parseFloat(trade.amount)).toBeGreaterThan(0);
      done();
    });
  }, 60000);

  test("should unsubscribe from trade events", () => {
    client.unsubscribeTrades(market);
  });

  test("should subscribe and emit level2 snapshots", done => {
    client.subscribeLevel2Snapshots(market);
    client.on("l2snapshot", (snapshot, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/btcusd/);
      expect(snapshot.fullId).toMatch("Bitstamp:BTC/USD");
      expect(snapshot.exchange).toMatch("Bitstamp");
      expect(snapshot.base).toMatch("BTC");
      expect(snapshot.quote).toMatch("USD");
      expect(snapshot.sequenceId).toBeUndefined();
      expect(snapshot.timestampMs).toBeGreaterThan(0);
      expect(parseFloat(snapshot.asks[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.asks[0].size)).toBeGreaterThanOrEqual(0);
      expect(snapshot.asks[0].count).toBeUndefined();
      expect(parseFloat(snapshot.bids[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.bids[0].size)).toBeGreaterThanOrEqual(0);
      expect(snapshot.bids[0].count).toBeUndefined();
      done();
    });
  });

  test("should unsubscribe from level2 snapshot", () => {
    client.unsubscribeLevel2Snapshots(market);
  });

  test("should subscribe and emit level2 updates", done => {
    let hasSnapshot = false;
    let hasUpdate = false;
    client.subscribeLevel2Updates(market);
    client.on("l2snapshot", (snapshot, market) => {
      hasSnapshot = true;
      expect(market).toBeDefined();
      expect(market.id).toMatch(/btcusd/);
      expect(snapshot.fullId).toMatch("Bitstamp:BTC/USD");
      expect(snapshot.exchange).toMatch("Bitstamp");
      expect(snapshot.base).toMatch("BTC");
      expect(snapshot.quote).toMatch("USD");
      expect(snapshot.sequenceId).toBeUndefined();
      expect(snapshot.timestampMs).toBeGreaterThan(1522540800000);
      expect(snapshot.timestampMs).toBeLessThanOrEqual(Date.now());
      expect(parseFloat(snapshot.asks[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.asks[0].size)).toBeGreaterThanOrEqual(0);
      expect(snapshot.asks[0].count).toBeUndefined();
      expect(parseFloat(snapshot.bids[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.bids[0].size)).toBeGreaterThanOrEqual(0);
      expect(snapshot.bids[0].count).toBeUndefined();
      if (hasSnapshot && hasUpdate) done();
    });
    client.on("l2update", (update, market) => {
      hasUpdate = true;
      expect(market).toBeDefined();
      expect(market.id).toMatch(/btcusd/);
      expect(update.fullId).toMatch("Bitstamp:BTC/USD");
      expect(update.exchange).toMatch("Bitstamp");
      expect(update.base).toMatch("BTC");
      expect(update.quote).toMatch("USD");
      expect(update.sequenceId).toBeUndefined();
      expect(update.timestampMs).toBeGreaterThan(1522540800000);
      expect(update.timestampMs).toBeLessThanOrEqual(Date.now());
      let point = update.asks[0] || update.bids[0];
      expect(parseFloat(point.price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(point.size)).toBeGreaterThanOrEqual(0);
      expect(point.count).toBeUndefined();
      if (hasSnapshot && hasUpdate) done();
    });
  });

  test("should unsubscribe from level2 updates", () => {
    client.unsubscribeLevel2Updates(market);
  });

  test("should close connections", done => {
    client.on("closed", done);
    client.close();
  });
});
