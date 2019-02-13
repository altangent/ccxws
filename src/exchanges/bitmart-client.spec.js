const Bitmart = require("./bitmart-client");
jest.mock("winston", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.retryTimes(3);

let client;
const market1 = {
  id: "BMX_ETH",
  base: "BMX",
  quote: "ETH",
};

const market2 = {
  id: "BMX_BTC",
  base: "BMX",
  quote: "BTC",
};

beforeAll(() => {
  client = new Bitmart();
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
  "should subscribe and emit tickers for tickers, trades, and l2updates for the same market",
  done => {
    let receivedTickerUpdate = false,
      receivedTradeUpdate = false,
      receivedL2Update = false,
      receivedTickerUpdateAfterOtherUpdates = false,
      receivedTradeUpdateAfterOtherUpdates = false,
      receivedL2UpdateAfterOtherUpdates = false;

    client.subscribeTicker(market1);
    client.subscribeTrades(market1);
    client.subscribeLevel2Updates(market1);

    client.on("ticker", t => {
      expect(t.base + t.quote).toMatch(/BMXETH|BMXBTC/);
      
      receivedTickerUpdate = true;
      if (receivedTradeUpdate && receivedL2Update) {
        receivedTickerUpdateAfterOtherUpdates = true;
      }
    });
    client.on("trade", t => {
      expect(t.base + t.quote).toMatch(/BMXETH|BMXBTC/);
      receivedTradeUpdate = true;
      if (receivedTickerUpdate && receivedL2Update) {
        receivedTradeUpdateAfterOtherUpdates = true;
      }
    });
    client.on("l2update", t => {
      expect(t.base + t.quote).toMatch(/BMXETH|BMXBTC/);
      receivedL2Update = true;
      if (receivedTickerUpdate && receivedTradeUpdate) {
        receivedL2UpdateAfterOtherUpdates = true;
      }
    });

    var checkInterval = setInterval(() => {
      if (
        receivedTickerUpdateAfterOtherUpdates &&
        receivedTradeUpdateAfterOtherUpdates &&
        receivedL2UpdateAfterOtherUpdates
      ) {
        clearInterval(checkInterval);
        done();
      }
    }, 500);
  },
  50000
);


test(
  "should subscribe and emit tickers for 2 markets",
  done => {
    let receivedMarket1Update = false,
      receivedMarket2Update = false;

        client.subscribeTicker(market1);
        client.subscribeTicker(market2);

        client.on("ticker", function tickerHandler(t) {
          expect(t.base + t.quote).toMatch(/BMXETH|BMXBTC/);

          if (t.base + t.quote === market1.base + market1.quote) {
            receivedMarket1Update = true;
          } else if (t.base + t.quote === market2.base + market2.quote) {
            receivedMarket2Update = true;
          }

          if (receivedMarket1Update && receivedMarket2Update) {
            // Need to remove this listener, otherwise it is still running during subsequent tests
            client.removeListener("ticker", tickerHandler);
            client.unsubscribeTicker(market1);
            client.unsubscribeTicker(market2);
            done();
          }
        });

  },
  60000
);


test(
  "should subscribe and emit ticker events",
  done => {
    client.subscribeTicker(market1);
    client.on("ticker", function tickerHandler(ticker) {
        expect(ticker.fullId).toMatch("Bitmart:"+market1.base+"/"+market1.quote);
        expect(ticker.timestamp).toBeGreaterThan(1531677480465);
        expect(typeof ticker.last).toBe("string");
        expect(typeof ticker.open).toBe("string");
        expect(typeof ticker.high).toBe("string");
        expect(typeof ticker.low).toBe("string");
        expect(typeof ticker.volume).toBe("string");
        expect(typeof ticker.quoteVolume).toBe("undefined");
        expect(typeof ticker.change).toBe("string");
        expect(typeof ticker.changePercent).toBe("undefined");
        expect(typeof ticker.bid).toBe("undefined");
        expect(typeof ticker.bidVolume).toBe("undefined");
        expect(typeof ticker.ask).toBe("undefined");
        expect(typeof ticker.askVolume).toBe("undefined");
        expect(parseFloat(ticker.last)).toBeGreaterThan(0);
        expect(parseFloat(ticker.open)).toBeGreaterThan(0);
        expect(parseFloat(ticker.high)).toBeGreaterThan(0);
        expect(parseFloat(ticker.low)).toBeGreaterThan(0);
        expect(parseFloat(ticker.volume)).toBeGreaterThan(0);
        expect(parseFloat(ticker.quoteVolume)).toBe(NaN);
        expect(isNaN(parseFloat(ticker.change))).toBeFalsy();
        expect(isNaN(parseFloat(ticker.changePercent))).toBeTruthy();
        expect(parseFloat(ticker.bidVolume)).toBe(NaN);
        expect(parseFloat(ticker.bid)).toBe(NaN);
        expect(parseFloat(ticker.askVolume)).toBe(NaN);
        expect(parseFloat(ticker.ask)).toBe(NaN);

      // Need to remove this listener, otherwise it is still running during subsequent tests
      client.removeListener("ticker", tickerHandler);
      client.unsubscribeTicker(market1);
      done();
    });
  },
  30000
);

test(
  "should subscribe and emit trade events",
  done => {
    client.subscribeTrades(market1);
    client.on("trade", function tradeHandler(trade) {

        expect(trade.fullId).toMatch("Bitmart:"+market1.base+"/"+market1.quote);
        expect(trade.exchange).toMatch("Bitmart");
        expect(trade.base).toMatch(market1.base);
        expect(trade.quote).toMatch(market1.quote);
        expect(trade.tradeId).toBe(undefined);
        expect(trade.unix).toBeGreaterThan(1522540800000);
        expect(trade.side).toMatch(/buy|sell/);
        expect(typeof trade.price).toBe("string");
        expect(typeof trade.amount).toBe("string");
        expect(parseFloat(trade.price)).toBeGreaterThan(0);

      
      if (trade.side === "buy") {
        //expect(parseFloat(trade.buyOrderId)).toBeGreaterThan(0);
        //expect(trade.sellOrderId).toBeNull();
      } else {
        //expect(trade.buyOrderId).toBeNull();
        //expect(parseFloat(trade.sellOrderId)).toBeGreaterThan(0);
      }

      // Need to remove this listener, otherwise it is still running during subsequent tests
      client.removeListener("trade", tradeHandler);
      client.unsubscribeTrades(market1);
      done();
    });
  },
  30000
);

test(
  "should subscribe and emit level2 updates",
  done => {
    client.subscribeLevel2Updates(market1);

    client.on("l2update", function level2UpdateHandler(update) {

        expect(update.fullId).toMatch("Bitmart:"+market1.base+"/"+market1.quote);
        expect(update.exchange).toMatch("Bitmart");
        expect(update.base).toMatch(market1.base);
        expect(update.quote).toMatch(market1.quote);
        expect(update.sequenceId).toBeUndefined();
        if (update.asks.length) {
          expect(parseFloat(update.asks[0].price)).toBeGreaterThanOrEqual(0);
          expect(parseFloat(update.asks[0].size)).toBeGreaterThanOrEqual(0);
        }
        if (update.bids.length) {
          expect(parseFloat(update.bids[0].price)).toBeGreaterThanOrEqual(0);
          expect(parseFloat(update.bids[0].size)).toBeGreaterThanOrEqual(0);
        }

      // Need to remove this listener, otherwise it is still running during subsequent tests
      client.removeListener("l2update", level2UpdateHandler);
      client.unsubscribeLevel2Updates(market1);
      done();
    });
  },
  30000
);


test("should close connections", done => {
  client.on("closed", done);
  client.close();
});
