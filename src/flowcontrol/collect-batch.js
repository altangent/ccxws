/**
 * Collection strategy that collects all function call arguments, then calls
 * the function with batches of arguments.
 */
class CollectBatch {
  constructor(batchSize = 1) {
    this.batchSize = batchSize;
    this.args = [];
  }

  add(args) {
    this.args.push(args);
  }

  reset() {
    this.args = [];
  }

  execute(fn) {
    if (!this.args.length) return;

    while (this.args.length) {
      fn(this.args.splice(0, this.batchSize));
    }
  }
}

module.exports.CollectBatch = CollectBatch;
