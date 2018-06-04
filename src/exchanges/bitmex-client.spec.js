const BitmexClient = require("./bitmex-client");
jest.mock("winston", () => ({ info: jest.fn() }));

let client;
let market = {
  id: "XBTUSD",
  base: "XBT",
  quote: "USDT",
};

beforeAll(() => {
  client = new BitmexClient();
});

test(
  "should subscribe and emit trade events",
  done => {
    client.subscribeTrades(market);
    client.on("trade", trade => {
      expect(trade.fullId).toMatch("BitMEX:XBT/USDT");
      expect(trade.exchange).toMatch("BitMEX");
      expect(trade.base).toMatch("XBT");
      expect(trade.quote).toMatch("USDT");
      expect(trade.unix).toBeGreaterThan(1522540800);
      expect(trade.price).toBeGreaterThan(0);
      expect(trade.amount).toBeDefined();
      done();
    });
  },
  30000
);

test("should unsubscribe", () => {
  client.unsubscribeTrades(market);
});

test("should close connections", done => {
  client.on("closed", done);
  client.close();
});
