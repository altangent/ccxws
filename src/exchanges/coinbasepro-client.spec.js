const Client = require("./coinbasepro-client");
jest.mock("winston", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.retryTimes(3);

let client;
let market = {
  id: "BTC-USD",
  base: "BTC",
  quote: "USD",
};

describe("CoinbaseProClient", () => {
  beforeAll(() => {
    client = new Client();
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
      expect(market.id).toMatch(/BTC-USD/);
      expect(ticker.fullId).toMatch("CoinbasePro:BTC/USD");
      expect(ticker.timestamp).toBeGreaterThan(1531677480465);
      expect(typeof ticker.last).toBe("string");
      expect(typeof ticker.open).toBe("string");
      expect(typeof ticker.high).toBe("string");
      expect(typeof ticker.low).toBe("string");
      expect(typeof ticker.volume).toBe("string");
      expect(typeof ticker.change).toBe("string");
      expect(typeof ticker.changePercent).toBe("string");
      expect(typeof ticker.bid).toBe("string");
      expect(typeof ticker.ask).toBe("string");
      expect(parseFloat(ticker.last)).toBeGreaterThan(0);
      expect(parseFloat(ticker.open)).toBeGreaterThan(0);
      expect(parseFloat(ticker.high)).toBeGreaterThan(0);
      expect(parseFloat(ticker.low)).toBeGreaterThan(0);
      expect(parseFloat(ticker.volume)).toBeGreaterThan(0);
      expect(isNaN(parseFloat(ticker.change))).toBeFalsy();
      expect(isNaN(parseFloat(ticker.changePercent))).toBeFalsy();
      expect(parseFloat(ticker.bid)).toBeGreaterThan(0);
      expect(ticker.bidVolume).toBeUndefined();
      expect(parseFloat(ticker.ask)).toBeGreaterThan(0);
      expect(ticker.askVolume).toBeUndefined();
      done();
    });
  }, 10000);

  test("should subscribe and emit trade events", done => {
    client.subscribeTrades(market);
    client.on("trade", (trade, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/BTC-USD/);
      expect(trade.fullId).toMatch("CoinbasePro:BTC/USD");
      expect(trade.exchange).toMatch("CoinbasePro");
      expect(trade.base).toMatch("BTC");
      expect(trade.quote).toMatch("USD");
      expect(trade.tradeId).toBeGreaterThan(0);
      expect(trade.unix).toBeGreaterThan(1522540800000);
      expect(trade.side).toMatch(/buy|sell/);
      expect(typeof trade.price).toBe("string");
      expect(typeof trade.amount).toBe("string");
      expect(parseFloat(trade.price)).toBeGreaterThan(0);
      expect(parseFloat(trade.amount)).toBeGreaterThan(0);
      expect(trade.buyOrderId).toMatch(/^[0-9a-f]{32,32}$/);
      expect(trade.sellOrderId).toMatch(/^[0-9a-f]{32,32}$/);
      expect(trade.buyOrderId).not.toEqual(trade.sellOrderId);
      done();
    });
  }, 30000);

  test("should subscribe and emit level2 snapshot and updates", done => {
    let hasSnapshot = false;
    client.subscribeLevel2Updates(market);
    client.on("l2snapshot", (snapshot, market) => {
      hasSnapshot = true;
      expect(market).toBeDefined();
      expect(market.id).toMatch(/BTC-USD/);
      expect(snapshot.fullId).toMatch("CoinbasePro:BTC/USD");
      expect(snapshot.exchange).toMatch("CoinbasePro");
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
    });
    client.on("l2update", (update, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/BTC-USD/);
      expect(hasSnapshot).toBeTruthy();
      expect(update.fullId).toMatch("CoinbasePro:BTC/USD");
      expect(update.exchange).toMatch("CoinbasePro");
      expect(update.base).toMatch("BTC");
      expect(update.quote).toMatch("USD");
      expect(update.sequenceId).toBeUndefined();
      expect(update.timestampMs).toBeUndefined();
      let point = update.asks[0] || update.bids[0];
      expect(parseFloat(point.price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(point.size)).toBeGreaterThanOrEqual(0);
      expect(point.count).toBeUndefined();
      done();
    });
  });

  test("should subscribe and emit level3 updates", done => {
    let hasReceived, hasOpen, hasDone, hasMatch;
    let point;
    client.subscribeLevel3Updates(market);
    client.on("l3update", (update, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/BTC-USD/);
      expect(update.fullId).toMatch("CoinbasePro:BTC/USD");
      expect(update.exchange).toMatch("CoinbasePro");
      expect(update.base).toMatch("BTC");
      expect(update.quote).toMatch("USD");
      expect(update.sequenceId).toBeGreaterThan(0);
      expect(update.timestampMs).toBeGreaterThan(0);
      point = update.asks[0] || update.bids[0];
      expect(point.orderId).toMatch(/^[a-f0-9]{32,32}$/);

      switch (point.meta.type) {
        case "received":
          hasReceived = true;
          // if (point.meta.order_type === "market") {
          //   expect(parseFloat(point.meta.funds)).toBeGreaterThan(0);
          // } else
          if (point.meta.order_type === "limit") {
            expect(parseFloat(point.price)).toBeGreaterThan(0);
            expect(parseFloat(point.size)).toBeGreaterThan(0);
          }
          // else throw new Error("unknown type " + point.meta.order_type);
          break;
        case "open":
          hasOpen = true;
          expect(parseFloat(point.price)).toBeGreaterThan(0);
          expect(parseFloat(point.size)).toBeGreaterThan(0);
          expect(parseFloat(point.meta.remaining_size)).toBeGreaterThanOrEqual(0);
          break;
        case "done":
          hasDone = true;
          // removed because we may sometimes have data
          // expect(parseFloat(point.price)).toBeGreaterThan(0);
          // expect(parseFloat(point.size)).toBeGreaterThanOrEqual(0);
          // expect(parseFloat(point.meta.remaining_size)).toBeGreaterThanOrEqual(0);
          expect(point.meta.reason).toMatch(/filled|canceled/);
          break;
        case "match":
          hasMatch = true;
          expect(parseFloat(point.price)).toBeGreaterThan(0);
          expect(parseFloat(point.size)).toBeGreaterThan(0);
          expect(point.meta.trade_id).toBeGreaterThan(0);
          expect(point.meta.maker_order_id).toMatch(/^[a-f0-9]{32,32}$/);
          expect(point.meta.taker_order_id).toMatch(/^[a-f0-9]{32,32}$/);
          break;
      }
      if (hasReceived && hasOpen && hasDone && hasMatch) done();
    });
  }, 30000);

  test("unsubscribe from trades", () => {
    client.unsubscribeTrades(market);
  });

  test("unsubscribe from level2 updates", () => {
    client.unsubscribeLevel2Updates(market);
  });

  test("unsubscribe from level3 updates", () => {
    client.unsubscribeLevel3Updates(market);
  });

  test("should close connections", done => {
    client.on("closed", done);
    client.close();
  });
});
