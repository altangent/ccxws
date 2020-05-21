const { expect } = require("chai");
const sinon = require("sinon");
const { Collector } = require("../../src/flowcontrol/collector");
const { CollectLast } = require("../../src/flowcontrol/collect-last");
const { CollectBatch } = require("../../src/flowcontrol/collect-batch");

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

describe("Collector", () => {
  describe("last call", () => {
    let fn;
    let sut;

    beforeEach(() => {
      const strategy = new CollectLast();
      const waitMs = 50;
      fn = sinon.stub();
      sut = new Collector(fn, waitMs, strategy);
    });

    it("groups calls within timeout period", async () => {
      sut.add(1);
      await wait(10);

      sut.add(2);
      await wait(10);

      sut.add(3);
      await wait(100);

      expect(fn.callCount).to.equal(1);
      expect(fn.args[0][0]).to.deep.equal(3);
    });

    it("groups calls within debounce periods", async () => {
      sut.add(1);
      await wait(100);

      sut.add(2);
      await wait(100);

      sut.add(3);
      await wait(100);

      expect(fn.callCount).to.equal(3);
      expect(fn.args[0][0]).to.deep.equal(1);
      expect(fn.args[1][0]).to.deep.equal(2);
      expect(fn.args[2][0]).to.deep.equal(3);
    });

    it("can reset pending executions", async () => {
      sut.add(1);
      sut.reset();

      await wait(100);
      expect(fn.callCount).to.equal(0);
    });
  });

  describe("small batch size", () => {
    let fn;
    let sut;

    beforeEach(() => {
      const batchSize = 2;
      const strategy = new CollectBatch(batchSize);
      const waitMs = 50;
      fn = sinon.stub();
      sut = new Collector(fn, waitMs, strategy);
    });

    it("groups calls within timeout period", async () => {
      sut.add(1);
      await wait(10);

      sut.add(2);
      await wait(10);

      sut.add(3);
      await wait(100);

      expect(fn.callCount).to.equal(2);
      expect(fn.args[0][0]).to.deep.equal([[1], [2]]);
      expect(fn.args[1][0]).to.deep.equal([[3]]);
    });

    it("groups calls within debounce periods", async () => {
      sut.add(1);
      await wait(100);

      sut.add(2);
      await wait(100);

      sut.add(3);
      await wait(100);

      expect(fn.callCount).to.equal(3);
      expect(fn.args[0][0]).to.deep.equal([[1]]);
      expect(fn.args[1][0]).to.deep.equal([[2]]);
      expect(fn.args[2][0]).to.deep.equal([[3]]);
    });

    it("can reset pending executions", async () => {
      sut.add(1);
      sut.reset();

      await wait(100);
      expect(fn.callCount).to.equal(0);
    });
  });

  describe("large batch size", () => {
    let fn;
    let sut;

    beforeEach(() => {
      const batchSize = 100;
      const strategy = new CollectBatch(batchSize);
      const waitMs = 50;
      fn = sinon.stub();
      sut = new Collector(fn, waitMs, strategy);
    });

    it("groups calls within timeout period", async () => {
      sut.add(1);
      await wait(10);

      sut.add(2);
      await wait(10);

      sut.add(3);
      await wait(100);

      expect(fn.callCount).to.equal(1);
      expect(fn.args[0][0]).to.deep.equal([[1], [2], [3]]);
    });

    it("groups calls within debounce periods", async () => {
      sut.add(1);
      await wait(100);

      sut.add(2);
      await wait(100);

      sut.add(3);
      await wait(100);

      expect(fn.callCount).to.equal(3);
      expect(fn.args[0][0]).to.deep.equal([[1]]);
      expect(fn.args[1][0]).to.deep.equal([[2]]);
      expect(fn.args[2][0]).to.deep.equal([[3]]);
    });

    it("can reset pending executions", async () => {
      sut.add(1);
      sut.reset();

      await wait(100);
      expect(fn.callCount).to.equal(0);
    });
  });
});

// it("compose with ExecuteLast", async () => {
//   const fn = sinon.stub();
//   const last = new ExecuteLast(fn);
//   const sut = new Debounce(last.execute.bind(last), 50);

//   sut.execute(1);
//   await wait(10);
//   sut.execute(2);
//   await wait(10);
//   sut.execute(3);
//   await wait(100);

//   expect(fn.callCount).to.equal(1);
//   expect(fn.args[0][0]).to.deep.equal(3);
// });

// it("compose with BatchStrategy", async () => {
//   const fn = sinon.stub();
//   const batch = new ExecuteBatch(fn, 2);
//   const sut = new Debounce(batch.execute.bind(batch), 50);

//   sut.execute(1);
//   await wait(10);
//   sut.execute(2);
//   await wait(10);
//   sut.execute(3);
//   await wait(100);

//   expect(fn.callCount).to.equal(2);
//   expect(fn.args[0][0]).to.deep.equal([[1], [2]]);
//   expect(fn.args[1][0]).to.deep.equal([[3]]);
// });
