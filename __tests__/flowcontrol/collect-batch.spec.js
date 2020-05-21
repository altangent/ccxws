const { expect } = require("chai");
const sinon = require("sinon");
const { CollectBatch } = require("../../src/flowcontrol/collect-batch");

describe("CollectBatch", () => {
  describe("batch of 1", () => {
    it("zero calls doesn't call", () => {
      const fn = sinon.stub();
      const sut = new CollectBatch(1);
      const args = [];
      for (const arg of args) sut.add(arg);
      sut.execute(fn);
      expect(fn.called).to.equal(false);
    });

    it("single 1-arg call", () => {
      const fn = sinon.stub();
      const sut = new CollectBatch(1);
      const args = [["hello"]];
      for (const arg of args) sut.add(arg);
      sut.execute(fn);
      expect(fn.callCount).to.equal(1);
      expect(fn.args[0][0]).to.deep.equal([["hello"]]);
    });

    it("many 1-arg calls", () => {
      const fn = sinon.stub();
      const sut = new CollectBatch(1);
      const args = [["h"], ["hel"], ["hello"]];
      for (const arg of args) sut.add(arg);
      sut.execute(fn);
      expect(fn.callCount).to.equal(3);
      expect(fn.args[0][0]).to.deep.equal([["h"]]);
      expect(fn.args[1][0]).to.deep.equal([["hel"]]);
      expect(fn.args[2][0]).to.deep.equal([["hello"]]);
    });

    it("many 2-arg calls", () => {
      const fn = sinon.stub();
      const sut = new CollectBatch(1);
      const args = [
        [0, "h"],
        [1, "hel"],
        [2, "hello"],
      ];
      for (const arg of args) sut.add(arg);
      sut.execute(fn);
      expect(fn.callCount).to.equal(3);
      expect(fn.args[0][0]).to.deep.equal([[0, "h"]]);
      expect(fn.args[1][0]).to.deep.equal([[1, "hel"]]);
      expect(fn.args[2][0]).to.deep.equal([[2, "hello"]]);
    });
  });

  describe("batch of 2", () => {
    it("zero calls doesn't call", () => {
      const fn = sinon.stub();
      const sut = new CollectBatch(2);
      const args = [];
      for (const arg of args) sut.add(arg);
      sut.execute(fn);
      expect(fn.called).to.equal(false);
    });

    it("single 1-arg call", () => {
      const fn = sinon.stub();
      const sut = new CollectBatch(2);
      const args = [["hello"]];
      for (const arg of args) sut.add(arg);
      sut.execute(fn);
      expect(fn.callCount).to.equal(1);
      expect(fn.args[0][0]).to.deep.equal([["hello"]]);
    });

    it("many 1-arg calls", () => {
      const fn = sinon.stub();
      const sut = new CollectBatch(2);
      const args = [["h"], ["hel"], ["hello"]];
      for (const arg of args) sut.add(arg);
      sut.execute(fn);
      expect(fn.callCount).to.equal(2);
      expect(fn.args[0][0]).to.deep.equal([["h"], ["hel"]]);
      expect(fn.args[1][0]).to.deep.equal([["hello"]]);
    });

    it("many 2-arg calls", () => {
      const fn = sinon.stub();
      const sut = new CollectBatch(2);
      const args = [
        [0, "h"],
        [1, "hel"],
        [2, "hello"],
      ];
      for (const arg of args) sut.add(arg);
      sut.execute(fn);
      expect(fn.callCount).to.equal(2);
      expect(fn.args[0][0]).to.deep.equal([
        [0, "h"],
        [1, "hel"],
      ]);
      expect(fn.args[1][0]).to.deep.equal([[2, "hello"]]);
    });
  });

  describe("batch of 200", () => {
    it("zero calls doesn't call", () => {
      const fn = sinon.stub();
      const sut = new CollectBatch(200);
      const args = [];
      for (const arg of args) sut.add(arg);
      sut.execute(fn);
      expect(fn.called).to.equal(false);
    });

    it("single 1-arg call", () => {
      const fn = sinon.stub();
      const sut = new CollectBatch(200);
      const args = [["hello"]];
      for (const arg of args) sut.add(arg);
      sut.execute(fn);
      expect(fn.callCount).to.equal(1);
      expect(fn.args[0][0]).to.deep.equal([["hello"]]);
    });

    it("many 1-arg calls", () => {
      const fn = sinon.stub();
      const sut = new CollectBatch(200);
      const args = [["h"], ["hel"], ["hello"]];
      for (const arg of args) sut.add(arg);
      sut.execute(fn);
      expect(fn.callCount).to.equal(1);
      expect(fn.args[0][0]).to.deep.equal([["h"], ["hel"], ["hello"]]);
    });

    it("many 2-arg calls", () => {
      const fn = sinon.stub();
      const sut = new CollectBatch(200);
      const args = [
        [0, "h"],
        [1, "hel"],
        [2, "hello"],
      ];
      for (const arg of args) sut.add(arg);
      sut.execute(fn);
      expect(fn.callCount).to.equal(1);
      expect(fn.args[0][0]).to.deep.equal([
        [0, "h"],
        [1, "hel"],
        [2, "hello"],
      ]);
    });
  });
});
