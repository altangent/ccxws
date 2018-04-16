const Trade = require("./trade");

test("marketId should be base + quote", () => {
  let t = new Trade({ base: "BTC", quote: "USD" });
  expect(t.marketId).toBe("BTC/USD");
});

test("fullId should be exchange + base + quote", () => {
  let t = new Trade({ exchange: "GDAX", base: "BTC", quote: "USD" });
  expect(t.fullId).toBe("GDAX:BTC/USD");
});
