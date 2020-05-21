const { expect } = require("chai");
const sinon = require("sinon");
const { Throttle } = require("../../src/flowcontrol/throttle");

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

describe("Throttle", () => {
  it("should throttle", async () => {
    const fn = sinon.stub();
    const sut = new Throttle(fn, 10);

    sut.add(1);
    sut.add(2);
    sut.add(3);

    expect(fn.callCount).to.equal(0);

    await wait(200);

    expect(fn.callCount).to.equal(3);
    expect(fn.args[0][0]).to.equal(1);
    expect(fn.args[1][0]).to.equal(2);
    expect(fn.args[2][0]).to.equal(3);
  });
});
