const { expect } = require("chai");
const sinon = require("sinon");
const { CollectLast } = require("../../src/flowcontrol/collect-last");

describe("CollectLast", () => {
  it("zero calls doesn't call", () => {
    const fn = sinon.stub();
    const sut = new CollectLast();
    const args = [];
    for (const arg of args) sut.add(arg);
    sut.execute(fn);
    expect(fn.called).to.equal(false);
  });

  it("single 1-arg call", () => {
    const fn = sinon.stub();
    const sut = new CollectLast(fn);
    const args = [["hello"]];
    for (const arg of args) sut.add(arg);
    sut.execute(fn);
    expect(fn.callCount).to.equal(1);
    expect(fn.args[0][0]).to.equal("hello");
  });

  it("many 1-arg calls", () => {
    const fn = sinon.stub();
    const sut = new CollectLast(fn);
    const args = [["h"], ["he"], ["hel"], ["hell"], ["hello"]];
    for (const arg of args) sut.add(arg);
    sut.execute(fn);
    expect(fn.callCount).to.equal(1);
    expect(fn.args[0][0]).to.equal("hello");
  });

  it("many 2-arg calls", () => {
    const fn = sinon.stub();
    const sut = new CollectLast(fn);
    const args = [
      [0, "h"],
      [1, "hel"],
      [2, "hello"],
    ];
    for (const arg of args) sut.add(arg);
    sut.execute(fn);
    expect(fn.callCount).to.equal(1);
    expect(fn.args[0][0]).to.equal(2);
    expect(fn.args[0][1]).to.equal("hello");
  });
});
