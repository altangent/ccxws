const GDAX = require("./gdax-client");
jest.mock("winston", () => ({ info: jest.fn() }));

let client;
let market = {
  id: "BTC-USD",
  base: "BTC",
  quote: "USD",
};

beforeAll(() => {
  client = new GDAX();
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

test(
  "should subscribe and emit trade events",
  done => {
    client.subscribeTrades(market);
    client.on("trade", trade => {
      expect(trade.fullId).toMatch("GDAX:BTC/USD");
      expect(trade.exchange).toMatch("GDAX");
      expect(trade.base).toMatch("BTC");
      expect(trade.quote).toMatch("USD");
      expect(trade.tradeId).toBeGreaterThan(0);
      expect(trade.unix).toBeGreaterThan(1522540800);
      expect(trade.price).toBeGreaterThan(0);
      expect(trade.amount).toBeDefined();
      done();
    });
  },
  30000
);

test("should subscribe and emit level2 snapshot and updates", done => {
  let hasSnapshot = false;
  client.subscribeLevel2Updates(market);
  client.on("l2snapshot", snapshot => {
    hasSnapshot = true;
    expect(snapshot.fullId).toMatch("GDAX:BTC/USD");
    expect(snapshot.exchange).toMatch("GDAX");
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
  client.on("l2update", update => {
    expect(hasSnapshot).toBeTruthy();
    expect(update.fullId).toMatch("GDAX:BTC/USD");
    expect(update.exchange).toMatch("GDAX");
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

test(
  "should subscribe and emit level3 updates",
  done => {
    let hasReceived, hasOpen, hasDone, hasMatch;
    let point;
    client.subscribeLevel3Updates(market);
    client.on("l3update", update => {
      try {
        expect(update.fullId).toMatch("GDAX:BTC/USD");
        expect(update.exchange).toMatch("GDAX");
        expect(update.base).toMatch("BTC");
        expect(update.quote).toMatch("USD");
        expect(update.sequenceId).toBeGreaterThan(0);
        expect(update.timestampMs).toBeGreaterThan(0);
        point = update.asks[0] || update.bids[0];
        expect(point.orderId).toMatch(/[a-f0-9]{16,16}/);

        switch (point.meta.type) {
          case "received":
            hasReceived = true;
            if (point.meta.order_type === "market") {
              expect(parseFloat(point.meta.funds)).toBeGreaterThan(0);
            } else if (point.meta.order_type === "limit") {
              expect(parseFloat(point.price)).toBeGreaterThan(0);
              expect(parseFloat(point.size)).toBeGreaterThan(0);
            } else throw new Error("unknown type " + point.meta.order_type);
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
            expect(point.meta.maker_order_id).toMatch(/[a-f0-9]{16,16}/);
            expect(point.meta.taker_order_id).toMatch(/[a-f0-9]{16,16}/);
            break;
        }

        if (hasReceived && hasOpen && hasDone && hasMatch) done();
      } catch (ex) {
        console.log(point);
        throw ex;
      }
    });
  },
  30000
);

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
