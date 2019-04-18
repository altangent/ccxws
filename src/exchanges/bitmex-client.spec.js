const BitmexClient = require("./bitmex-client");
jest.mock("winston", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.retryTimes(3);

let client;
let market = {
  id: "XBTUSD",
  base: "BTC",
  quote: "USD",
};

describe("BitmexClient", () => {
  beforeAll(() => {
    client = new BitmexClient();
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

  test("it should not support level3 updates", () => {
    expect(client.hasLevel3Updates).toBeFalsy();
  });

  test("should subscribe and emit trade events", done => {
    client.subscribeTrades(market);
    client.on("trade", (trade, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/XBTUSD/);
      expect(trade.fullId).toMatch("BitMEX:BTC/USD");
      expect(trade.exchange).toMatch("BitMEX");
      expect(trade.base).toMatch("BTC");
      expect(trade.quote).toMatch("USD");
      expect(trade.id).toMatch("XBTUSD");
      expect(trade.tradeId).toMatch(/^[a-f0-9]{32,32}$/);
      expect(trade.unix).toBeGreaterThan(1522540800000);
      expect(trade.side).toMatch(/buy|sell/);
      expect(typeof trade.price).toBe("string");
      expect(typeof trade.amount).toBe("string");
      expect(parseFloat(trade.price)).toBeGreaterThan(0);
      expect(parseFloat(trade.amount)).toBeGreaterThan(0);
      client.removeAllListeners("trade");
      done();
    });
  }, 30000);

  test("should unsubscribe from trades", () => {
    client.unsubscribeTrades(market);
  });

  // run first so we can capture snapshot
  test("should subscribe and emit level2 snapshot and updates", done => {
    let hasSnapshot = false;
    let hasUpdate = false;
    let hasInsert = false;
    let hasDelete = false;
    client.subscribeLevel2Updates(market);
    client.on("l2snapshot", (snapshot, market) => {
      hasSnapshot = true;
      expect(market).toBeDefined();
      expect(market.id).toMatch(/XBTUSD/);
      expect(snapshot.fullId).toMatch("BitMEX:BTC/USD");
      expect(snapshot.exchange).toMatch("BitMEX");
      expect(snapshot.base).toMatch("BTC");
      expect(snapshot.quote).toMatch("USD");
      expect(snapshot.sequenceId).toBeUndefined();
      expect(snapshot.timestampMs).toBeUndefined();
      expect(parseFloat(snapshot.asks[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.asks[0].size)).toBeGreaterThanOrEqual(0);
      expect(snapshot.asks[0].count).toBeUndefined();
      expect(parseFloat(snapshot.bids[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.bids[0].size)).toBeGreaterThanOrEqual(0);
      expect(snapshot.bids[0].count).toBeUndefined();
      client.removeAllListeners("l2snapshot");
    });
    client.on("l2update", (update, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/XBTUSD/);
      expect(update.fullId).toMatch("BitMEX:BTC/USD");
      expect(update.exchange).toMatch("BitMEX");
      expect(update.base).toMatch("BTC");
      expect(update.quote).toMatch("USD");
      expect(update.sequenceId).toBeUndefined();
      expect(update.timestampMs).toBeUndefined();
      let point = update.asks[0] || update.bids[0];
      expect(typeof point.price).toBe("string");
      expect(parseFloat(point.price)).toBeGreaterThanOrEqual(0);
      expect(typeof point.size).toBe("string");
      expect(parseFloat(point.size)).toBeGreaterThanOrEqual(0);
      expect(point.count).toBeUndefined();
      expect(point.meta.id).toBeGreaterThan(0);
      expect(point.meta.type).toMatch(/(update|delete|insert)/);

      if (point.meta.type === "update") hasUpdate = true;
      if (point.meta.type === "insert") hasInsert = true;
      if (point.meta.type === "delete") hasDelete = true;

      if (hasUpdate && hasInsert && hasDelete) {
        expect(hasSnapshot).toBeTruthy();
        client.removeAllListeners("l2update");
        done();
      }
    });
  }, 30000);

  test("should unsubscribe from l2updates", () => {
    client.unsubscribeLevel2Updates(market);
  });

  test("should close connections", done => {
    client.on("closed", done);
    client.close();
  });
});
