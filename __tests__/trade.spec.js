const { expect } = require("chai");
const Trade = require("../src/trade");

describe("Trade", () => {
  it("marketId should be base + quote", () => {
    let t = new Trade({ base: "BTC", quote: "USD" });
    expect(t.marketId).to.equal("BTC/USD");
  });

  it("fullId should be exchange + base + quote", () => {
    let t = new Trade({ exchange: "GDAX", base: "BTC", quote: "USD" });
    expect(t.fullId).to.equal("GDAX:BTC/USD");
  });
});
