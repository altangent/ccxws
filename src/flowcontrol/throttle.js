class Throttle {
  constructor(fn, delayMs) {
    this.fn = fn;
    this.delayMs = delayMs;
    this._args = [];
    this._handle;
    this.add = this.add.bind(this);
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
    this._handle = setTimeout(this._process.bind(this), this.delayMs);
    this._handle.unref();
  }

  _process() {
    let args = this._args.shift();
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
