const Bittrex = require("./bittrex-client");
jest.mock("winston", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

let client;
let market = {
  id: "USDT-BTC",
  base: "BTC",
  quote: "USDT",
};

beforeAll(() => {
  client = new Bittrex();
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
      expect(ticker.fullId).toMatch("Bittrex:BTC/USDT");
      expect(ticker.timestamp).toBeGreaterThan(1531677480465);
      expect(typeof ticker.last).toBe("string");
      expect(typeof ticker.open).toBe("string");
      expect(typeof ticker.high).toBe("string");
      expect(typeof ticker.low).toBe("string");
      expect(typeof ticker.volume).toBe("string");
      expect(typeof ticker.quoteVolume).toBe("string");
      expect(typeof ticker.change).toBe("string");
      expect(typeof ticker.changePercent).toBe("string");
      expect(typeof ticker.bid).toBe("string");
      expect(typeof ticker.ask).toBe("string");
      expect(parseFloat(ticker.last)).toBeGreaterThan(0);
      expect(parseFloat(ticker.open)).toBeGreaterThan(0);
      expect(parseFloat(ticker.high)).toBeGreaterThan(0);
      expect(parseFloat(ticker.low)).toBeGreaterThan(0);
      expect(parseFloat(ticker.volume)).toBeGreaterThan(0);
      expect(parseFloat(ticker.quoteVolume)).toBeGreaterThan(0);
      expect(Math.abs(parseFloat(ticker.change))).toBeGreaterThan(0);
      expect(Math.abs(parseFloat(ticker.changePercent))).toBeGreaterThan(0);
      expect(parseFloat(ticker.bid)).toBeGreaterThan(0);
      expect(ticker.bidVolume).toBeUndefined();
      expect(parseFloat(ticker.ask)).toBeGreaterThan(0);
      expect(ticker.askVolume).toBeUndefined();
      done();
    });
  },
  90000
);

test(
  "should subscribe and emit level2 snapshot and updates",
  done => {
    let hasSnapshot = false;
    client.subscribeLevel2Updates(market);
    client.on("l2snapshot", snapshot => {
      hasSnapshot = true;
      expect(snapshot.fullId).toMatch("Bittrex:BTC/USDT");
      expect(snapshot.exchange).toMatch("Bittrex");
      expect(snapshot.base).toMatch("BTC");
      expect(snapshot.quote).toMatch("USDT");
      expect(snapshot.sequenceId).toBeGreaterThan(0);
      expect(snapshot.timestampMs).toBeUndefined();
      expect(typeof snapshot.asks[0].price).toBe("string");
      expect(typeof snapshot.asks[0].size).toBe("string");
      expect(parseFloat(snapshot.asks[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.asks[0].size)).toBeGreaterThanOrEqual(0);
      expect(snapshot.asks[0].count).toBeUndefined();
      expect(typeof snapshot.bids[0].price).toBe("string");
      expect(typeof snapshot.bids[0].size).toBe("string");
      expect(parseFloat(snapshot.bids[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.bids[0].size)).toBeGreaterThanOrEqual(0);
      expect(snapshot.bids[0].count).toBeUndefined();
    });
    client.on("l2update", update => {
      expect(update.fullId).toMatch("Bittrex:BTC/USDT");
      expect(update.exchange).toMatch("Bittrex");
      expect(update.base).toMatch("BTC");
      expect(update.quote).toMatch("USDT");
      expect(update.sequenceId).toBeGreaterThan(0);
      expect(update.timestampMs).toBeUndefined();
      let point = update.asks[0] || update.bids[0];
      expect(typeof point.price).toBe("string");
      expect(typeof point.size).toBe("string");
      expect(parseFloat(point.price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(point.size)).toBeGreaterThanOrEqual(0);
      expect(point.count).toBeUndefined();
      expect(point.meta.type).toBeGreaterThanOrEqual(0);
      if (hasSnapshot) done();
    });
  },
  90000
);

test(
  "should subscribe and emit trade events",
  done => {
    client.subscribeTrades(market);
    client.on("trade", trade => {
      expect(trade.fullId).toMatch("Bittrex:BTC/USDT");
      expect(trade.exchange).toMatch("Bittrex");
      expect(trade.base).toMatch("BTC");
      expect(trade.quote).toMatch("USDT");
      expect(trade.tradeId).toMatch(/^[0-9a-f]{32,32}$/);
      expect(trade.unix).toBeGreaterThan(1522540800000);
      expect(trade.side).toMatch(/buy|sell/);
      expect(typeof trade.price).toBe("string");
      expect(typeof trade.amount).toBe("string");
      expect(parseFloat(trade.price)).toBeGreaterThan(0);
      expect(parseFloat(trade.amount)).toBeGreaterThan(0);
      done();
    });
  },
  90000
);

test("should unsubscribe from tickers", () => {
  client.unsubscribeTicker(market);
});

test("should unsubscribe from trade events", () => {
  client.unsubscribeTrades(market);
});

test("should unsubscribe from level2 updates", () => {
  client.unsubscribeLevel2Updates(market);
});

test("should close connections", done => {
  client.on("closed", done);
  client.close();
});
