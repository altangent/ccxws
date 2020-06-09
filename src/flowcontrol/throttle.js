class Throttle {
  constructor(fn, delayMs) {
    this.fn = fn;
    this.delayMs = delayMs;
    this._calls = [];
    this._handle;
    this.add = this.add.bind(this);
  }

  add(...args) {
    this._calls.push(args);
    if (!this._handle) this._process();
  }

  cancel() {
    this._unschedule();
    this._calls = [];
  }

  _unschedule() {
    clearTimeout(this._handle);
    this._handle = undefined;
  }

  _schedule() {
    this._handle = setTimeout(this._process.bind(this), this.delayMs);
    if (this._handle.unref) {
      this._handle.unref();
    }
  }

  _process() {
    this._handle = undefined;
    let args = this._calls.shift();
    if (args) {
      this.fn(...args);
      this._schedule();
    }
  }
}

/**
 * Throttles the function execution to the rate limit specified. This can be
 * used "enqueue" a bunch of function executes and limit the rate at which they
 * will be called.
 *
 * @example
 * ```javascript
 * const fn = n => console.log(n, new Date());
 * const delayMs = 1000;
 * const throttledFn = throttle(fn, delayMs);
 * throttledFn(1);
 * throttledFn(2);
 * throttledFn(3);
 * ```
 */
function throttle(fn, delayMs) {
  const inst = new Throttle(fn, delayMs);
  const add = inst.add.bind(inst);
  add.cancel = inst.cancel.bind(inst);
  return add;
}

module.exports.Throttle = Throttle;
module.exports.throttle = throttle;
