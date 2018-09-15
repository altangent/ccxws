const ZBClient = require("./zb-client");
jest.mock("winston", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.retryTimes(3);

let client;
let market = {
  id: "btc_usdt",
  base: "BTC",
  quote: "USDT",
};

beforeAll(() => {
  client = new ZBClient();
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

test("it should not support level3 updates", () => {
  expect(client.hasLevel3Updates).toBeFalsy();
});

test(
  "should subscribe and emit ticker events",
  done => {
    client.subscribeTicker(market);
    client.on("ticker", ticker => {
      expect(ticker.fullId).toMatch("ZB:BTC/USDT");
      expect(ticker.timestamp).toBeGreaterThan(1531677480465);
      expect(typeof ticker.last).toBe("string");
      expect(ticker.open).toBeUndefined();
      expect(typeof ticker.high).toBe("string");
      expect(typeof ticker.low).toBe("string");
      expect(typeof ticker.volume).toBe("string");
      expect(ticker.quoteVolume).toBeUndefined();
      expect(ticker.change).toBeUndefined();
      expect(ticker.changePercent).toBeUndefined();
      expect(typeof ticker.bid).toBe("string");
      expect(typeof ticker.ask).toBe("string");
      expect(parseFloat(ticker.last)).toBeGreaterThan(0);
      expect(parseFloat(ticker.high)).toBeGreaterThan(0);
      expect(parseFloat(ticker.low)).toBeGreaterThan(0);
      expect(parseFloat(ticker.volume)).toBeGreaterThan(0);
      expect(parseFloat(ticker.bid)).toBeGreaterThan(0);
      expect(parseFloat(ticker.ask)).toBeGreaterThan(0);
      done();
    });
  },
  10000
);

test(
  "should subscribe and emit trade events",
  done => {
    client.subscribeTrades(market);
    client.on("trade", trade => {
      expect(trade.fullId).toMatch("ZB:BTC/USDT");
      expect(trade.exchange).toMatch("ZB");
      expect(trade.base).toMatch("BTC");
      expect(trade.quote).toMatch("USDT");
      expect(trade.tradeId).toMatch(/[0-9]{1,}/);
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

test("should subscribe and emit level2 updates", done => {
  client.subscribeLevel2Updates(market);
  client.on("l2update", update => {
    expect(update.fullId).toMatch("ZB:BTC/USDT");
    expect(update.exchange).toMatch("ZB");
    expect(update.base).toMatch("BTC");
    expect(update.quote).toMatch("USDT");
    expect(update.sequenceId).toBeUndefined();
    expect(update.timestampMs).toBeGreaterThan(1522540800000);
    expect(parseFloat(update.asks[0].price)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(update.asks[0].size)).toBeGreaterThanOrEqual(0);
    expect(update.asks[0].count).toBeUndefined();
    expect(parseFloat(update.bids[0].price)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(update.bids[0].size)).toBeGreaterThanOrEqual(0);
    expect(update.bids[0].count).toBeUndefined();
    done();
  });
});

test("should unsubscribe tickers", () => {
  client.unsubscribeTicker(market);
});

test("should unsubscribe trades", () => {
  client.unsubscribeTrades(market);
});

test("should unsubscribe level2 updates", () => {
  client.unsubscribeLevel2Updates(market);
});

test("should close connections", done => {
  client.on("closed", done);
  client.close();
});
