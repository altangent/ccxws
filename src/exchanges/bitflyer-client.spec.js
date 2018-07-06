const BitFlyerClient = require("./bitflyer-client");
jest.mock("winston", () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

let client;
let market = {
  id: "BTC_JPY",
  base: "BTC",
  quote: "JPY",
};

beforeAll(() => {
  client = new BitFlyerClient();
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

test(
  "should subscribe and emit trade events",
  done => {
    client.subscribeTrades(market);
    client.on("trade", trade => {
      expect(trade.fullId).toMatch("BitFlyer:BTC/JPY");
      expect(trade.exchange).toMatch("BitFlyer");
      expect(trade.base).toMatch("BTC");
      expect(trade.quote).toMatch("JPY");
      expect(trade.tradeId).toBeGreaterThan(0);
      expect(trade.unix).toBeGreaterThan(1522540800);
      expect(trade.price).toBeGreaterThan(0);
      expect(trade.amount).toBeDefined();
      done();
    });
  },
  30000
);

test("should subscribe and emit level2 updates", done => {
  client.subscribeLevel2Updates(market);
  client.on("l2update", update => {
    expect(update.fullId).toMatch("BitFlyer:BTC/JPY");
    expect(update.exchange).toMatch("BitFlyer");
    expect(update.base).toMatch("BTC");
    expect(update.quote).toMatch("JPY");
    expect(update.sequenceId).toBeUndefined();
    expect(update.timestampMs).toBeUndefined();
    let point = update.asks[0] || update.bids[0];
    expect(typeof point.price).toBe("string");
    expect(typeof point.size).toBe("string");
    expect(parseFloat(point.price)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(point.size)).toBeGreaterThanOrEqual(0);
    expect(point.count).toBeUndefined();
    done();
  });
});

test("should unsubscribe", () => {
  client.unsubscribeTrades(market);
});

test("should unsubscribe from level2orders", () => {
  client.unsubscribeLevel2Updates(market);
});

test("should close connections", done => {
  client.on("closed", done);
  client.close();
});
