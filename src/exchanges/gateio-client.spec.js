const Gateio = require("./gateio-client");
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

describe("GateioClient", () => {
  beforeAll(() => {
    client = new Gateio();
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

  test("should subscribe and emit ticker events", done => {
    client.subscribeTicker(market1);
    client.on("ticker", function tickerHandler(ticker) {
      expect(ticker.fullId).toMatch("Gateio:BTC/USDT");
      expect(ticker.timestamp).toBeGreaterThan(1531677480465);
      expect(typeof ticker.last).toBe("string");
      expect(typeof ticker.open).toBe("string");
      expect(typeof ticker.high).toBe("string");
      expect(typeof ticker.low).toBe("string");
      expect(typeof ticker.volume).toBe("string");
      expect(typeof ticker.quoteVolume).toBe("string");
      expect(typeof ticker.change).toBe("string");
      expect(typeof ticker.changePercent).toBe("string");
      expect(typeof ticker.bid).toBe("undefined");
      expect(typeof ticker.bidVolume).toBe("undefined");
      expect(typeof ticker.ask).toBe("undefined");
      expect(typeof ticker.askVolume).toBe("undefined");
      expect(parseFloat(ticker.last)).toBeGreaterThan(0);
      expect(parseFloat(ticker.open)).toBeGreaterThan(0);
      expect(parseFloat(ticker.high)).toBeGreaterThan(0);
      expect(parseFloat(ticker.low)).toBeGreaterThan(0);
      expect(parseFloat(ticker.volume)).toBeGreaterThan(0);
      expect(parseFloat(ticker.quoteVolume)).toBeGreaterThan(0);
      expect(isNaN(parseFloat(ticker.change))).toBeFalsy();
      expect(isNaN(parseFloat(ticker.changePercent))).toBeFalsy();
      expect(parseFloat(ticker.bid)).toBe(NaN);
      expect(parseFloat(ticker.bidVolume)).toBe(NaN);
      expect(parseFloat(ticker.ask)).toBe(NaN);
      expect(parseFloat(ticker.askVolume)).toBe(NaN);
      done();
    });
  }, 30000);

  test("should unsubscribe from tickers", () => {
    client.unsubscribeTicker(market1);
  });

  test("should subscribe and emit trade events", done => {
    client.subscribeTrades(market1);
    client.subscribeTrades(market2);
    client.on("trade", function tradeHandler(trade) {
      expect(trade.fullId).toMatch(/Gateio:BTC\/USDT|Gateio:ETH\/BTC/);
      expect(trade.exchange).toMatch("Gateio");
      expect(trade.base).toMatch(/BTC|ETH/);
      expect(trade.quote).toMatch(/USDT|BTC/);
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

  test("should unsubscribe from trades", () => {
    client.unsubscribeTrades(market1);
  });

  test("should subscribe and emit level2 updates", done => {
    client.subscribeLevel2Updates(market1);
    let hasSnapshot = true;
    client.on("l2snapshot", snapshot => {
      expect(snapshot.fullId).toMatch("Gateio:BTC/USDT");
      expect(snapshot.exchange).toMatch("Gateio");
      expect(snapshot.base).toMatch("BTC");
      expect(snapshot.quote).toMatch("USDT");
      expect(snapshot.sequenceId).toBeUndefined();
      expect(typeof snapshot.asks[0].price).toBe("string");
      expect(typeof snapshot.asks[0].size).toBe("string");
      expect(typeof snapshot.bids[0].price).toBe("string");
      expect(typeof snapshot.bids[0].size).toBe("string");
      expect(parseFloat(snapshot.asks[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.asks[0].size)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.bids[0].price)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(snapshot.bids[0].size)).toBeGreaterThanOrEqual(0);
      hasSnapshot = true;
    });
    client.on("l2update", function level2UpdateHandler(update) {
      expect(update.fullId).toMatch("Gateio:BTC/USDT");
      expect(update.exchange).toMatch("Gateio");
      expect(update.base).toMatch("BTC");
      expect(update.quote).toMatch("USDT");
      expect(update.sequenceId).toBeUndefined();
      if (update.asks.length) {
        expect(parseFloat(update.asks[0].price)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(update.asks[0].size)).toBeGreaterThanOrEqual(0);
      }
      if (update.bids.length) {
        expect(parseFloat(update.bids[0].price)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(update.bids[0].size)).toBeGreaterThanOrEqual(0);
      }

      if (hasSnapshot) {
        done();
      }
    });
  }, 30000);

  it("should unsubscribe from level2 updates", () => {
    client.unsubscribeLevel2Updates(market1);
  });

  test("should close connections", done => {
    client.on("closed", done);
    client.close();
  });
});
