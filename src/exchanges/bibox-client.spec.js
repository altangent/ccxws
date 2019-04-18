const Bibox = require("./bibox-client");
jest.mock("winston", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.retryTimes(3);

let client;
let market1 = {
  id: "BTC_USDT",
  base: "BTC",
  quote: "USDT",
};
let market2 = {
  id: "ETH_BTC",
  base: "ETH",
  quote: "BTC",
};

describe("BiboxClient", () => {
  beforeAll(() => {
    client = new Bibox();
  });

  test("it should support tickers", () => {
    expect(client.hasTickers).toBeTruthy();
  });

  test("it should support trades", () => {
    expect(client.hasTrades).toBeTruthy();
  });

  test("it should not support level2 snapshots", () => {
    expect(client.hasLevel2Snapshots).toBeTruthy();
  });

  test("it should not support level2 updates", () => {
    expect(client.hasLevel2Updates).toBeFalsy();
  });

  test("it should not support level3 snapshots", () => {
    expect(client.hasLevel3Snapshots).toBeFalsy();
  });

  test("it should not support level3 updates", () => {
    expect(client.hasLevel3Updates).toBeFalsy();
  });

  test("should subscribe and emit ticker events", done => {
    client.subscribeTicker(market1);
    client.on("ticker", (ticker, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/BTC_USDT|ETH_BTC/);
      expect(ticker.fullId).toMatch(/Bibox:BTC\/USDT/);
      expect(ticker.timestamp).toBeGreaterThan(1531677480465);
      expect(typeof ticker.last).toBe("string");
      expect(typeof ticker.open).toBe("string");
      expect(typeof ticker.high).toBe("string");
      expect(typeof ticker.low).toBe("string");
      expect(typeof ticker.volume).toBe("string");
      expect(typeof ticker.quoteVolume).toBe("undefined");
      expect(typeof ticker.change).toBe("string");
      expect(typeof ticker.changePercent).toBe("string");
      expect(typeof ticker.bid).toBe("string");
      expect(typeof ticker.bidVolume).toBe("undefined");
      expect(typeof ticker.ask).toBe("string");
      expect(typeof ticker.askVolume).toBe("undefined");
      expect(parseFloat(ticker.last)).toBeGreaterThan(0);
      expect(parseFloat(ticker.open)).toBeGreaterThan(0);
      expect(parseFloat(ticker.high)).toBeGreaterThan(0);
      expect(parseFloat(ticker.low)).toBeGreaterThan(0);
      expect(parseFloat(ticker.volume)).toBeGreaterThan(0);
      expect(parseFloat(ticker.quoteVolume)).toBe(NaN);
      expect(isNaN(parseFloat(ticker.change))).toBeFalsy();
      expect(isNaN(parseFloat(ticker.changePercent))).toBeFalsy();
      expect(parseFloat(ticker.bid)).toBeGreaterThan(0);
      expect(parseFloat(ticker.bidVolume)).toBe(NaN);
      expect(parseFloat(ticker.ask)).toBeGreaterThan(0);
      expect(parseFloat(ticker.askVolume)).toBe(NaN);
      done();
    });
  }, 60000);

  test("should unsubscribe to ticker events", () => {
    client.unsubscribeTicker(market1);
  });

  test("should subscribe and emit trade events", done => {
    client.subscribeTrades(market1);
    client.subscribeTrades(market2);
    client.on("trade", (trade, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/BTC_USDT|ETH_BTC/);
      expect(trade.fullId).toMatch(/Bibox:BTC\/USDT|Bibox:ETH\/BTC/);
      expect(trade.exchange).toMatch("Bibox");
      expect(trade.base).toMatch(/BTC|ETH/);
      expect(trade.quote).toMatch(/USDT|BTC/);
      expect(trade.tradeId).toBeGreaterThan(0);
      expect(trade.unix).toBeGreaterThan(1522540800000);
      expect(trade.side).toMatch(/buy|sell/);
      expect(typeof trade.price).toBe("string");
      expect(typeof trade.amount).toBe("string");
      expect(parseFloat(trade.price)).toBeGreaterThan(0);
      done();
    });
  }, 30000);

  test("should unsubscribe from trade events", () => {
    client.unsubscribeTrades(market1);
  });

  test("should subscribe and emit level2 snapshots", done => {
    client.subscribeLevel2Snapshots(market1);
    client.on("l2snapshot", (snapshot, market) => {
      expect(market).toBeDefined();
      expect(market.id).toMatch(/BTC_USDT|ETH_BTC/);
      expect(snapshot.fullId).toMatch(/Bibox:BTC\/USDT/);
      expect(snapshot.exchange).toMatch("Bibox");
      expect(snapshot.base).toMatch(market1.base);
      expect(snapshot.quote).toMatch(market1.quote);
      expect(snapshot.timestampMs).toBeGreaterThan(1553712743791);
      expect(snapshot.sequenceId).toBeUndefined();
      if (snapshot.asks.length) {
        expect(parseFloat(snapshot.asks[0].price)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(snapshot.asks[0].size)).toBeGreaterThanOrEqual(0);
      }
      if (snapshot.bids.length) {
        expect(parseFloat(snapshot.bids[0].price)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(snapshot.bids[0].size)).toBeGreaterThanOrEqual(0);
      }
      done();
    });
  }, 30000);

  test("should close connections", done => {
    client.on("closed", done);
    client.close();
  });
});
