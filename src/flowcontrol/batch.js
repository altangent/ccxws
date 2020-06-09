class Batch {
  constructor(fn, batchSize, collectMs = 0) {
    this.fn = fn;
    this.batchSize = batchSize;
    this.collectMs = collectMs;
    this._handle;
    this._args = [];
  }

  add(...args) {
    this._args.push(args);
    this._unschedule();
    this._schedule();
  }

  cancel() {
    this._unschedule();
    this._args = [];
  }

  _unschedule() {
    clearTimeout(this._handle);
  }

  _schedule() {
    this._handle = setTimeout(this._process.bind(this), this.collectMs);
    if (this._handle.unref) {
      this._handle.unref();
    }
  }

  _process() {
    if (!this._args.length) return;
    while (this._args.length) {
      this.fn(this._args.splice(0, this.batchSize));
    }
  }
}

/**
 * Batcher allows repeated calls to a function but will delay execution of the
 * until the next tick or a timeout expires. Upon expiration, the function is
 * called with the arguments of the calls batched by the batch size
 *
 * @example
 * const fn = n => console.log(n);
 * const batchFn = batch(fn, debounceMs);
 * batchFn(1);
 * batchFn(2);
 * batchFn(3);
 * // [[1],[2],[3]]
 */
function batch(fn, batchSize = Number.MAX_SAFE_INTEGER, collectMs = 0) {
  const inst = new Batch(fn, batchSize, collectMs);
  const add = inst.add.bind(inst);
  add.cancel = inst.cancel.bind(inst);
  return add;
}

module.exports.Batch = Batch;
module.exports.batch = batch;
