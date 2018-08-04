const BitFlyerClient = require("./bitflyer-client");
jest.mock("winston", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

let client;
let market = {
  id: "FX_BTC_JPY",
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

test("should subscribe and emit ticker events", done => {
  client.subscribeTicker(market);
  client.on("ticker", ticker => {
    expect(ticker.fullId).toMatch("bitFlyer:BTC/JPY");
    expect(ticker.timestamp).toBeGreaterThan(1531677480465);
    expect(typeof ticker.last).toBe("string");
    expect(typeof ticker.volume).toBe("string");
    expect(typeof ticker.bid).toBe("string");
    expect(typeof ticker.bidVolume).toBe("string");
    expect(typeof ticker.ask).toBe("string");
    expect(typeof ticker.askVolume).toBe("string");
    expect(parseFloat(ticker.last)).toBeGreaterThan(0);
    expect(ticker.open).toBeUndefined();
    expect(ticker.high).toBeUndefined();
    expect(ticker.low).toBeUndefined();
    expect(parseFloat(ticker.volume)).toBeGreaterThan(0);
    expect(parseFloat(ticker.quoteVolume)).toBeGreaterThan(0);
    expect(ticker.change).toBeUndefined();
    expect(ticker.changePercent).toBeUndefined();
    expect(parseFloat(ticker.bid)).toBeGreaterThan(0);
    expect(parseFloat(ticker.bidVolume)).toBeGreaterThan(0);
    expect(parseFloat(ticker.ask)).toBeGreaterThan(0);
    expect(parseFloat(ticker.askVolume)).toBeGreaterThan(0);
    done();
  });
});

test(
  "should subscribe and emit trade events",
  done => {
    client.subscribeTrades(market);
    client.on("trade", trade => {
      expect(trade.fullId).toMatch("bitFlyer:BTC/JPY");
      expect(trade.exchange).toMatch("bitFlyer");
      expect(trade.base).toMatch("BTC");
      expect(trade.quote).toMatch("JPY");
      expect(trade.tradeId).toBeGreaterThanOrEqual(0);
      expect(trade.unix).toBeGreaterThan(1522540800000);
      expect(trade.side).toMatch(/buy|sell/);
      expect(typeof trade.price).toBe("string");
      expect(typeof trade.amount).toBe("string");
      expect(typeof trade.buyOrderId).toBe("string");
      expect(typeof trade.sellOrderId).toBe("string");
      expect(parseFloat(trade.price)).toBeGreaterThan(0);
      expect(parseFloat(trade.amount)).toBeGreaterThan(0);
      done();
    });
  },
  90000
);

test("should subscribe and emit level2 updates", done => {
  client.subscribeLevel2Updates(market);
  client.on("l2update", update => {
    expect(update.fullId).toMatch("bitFlyer:BTC/JPY");
    expect(update.exchange).toMatch("bitFlyer");
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

test("should unsubscribe from tickers", () => {
  client.unsubscribeTicker(market);
});

test("should unsubscribe trades", () => {
  client.unsubscribeTrades(market);
});

test("should unsubscribe from level2orders", () => {
  client.unsubscribeLevel2Updates(market);
});

test("should close connections", done => {
  client.on("closed", done);
  client.close();
});
