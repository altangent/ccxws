/**
 * Throttles the function execution to the rate limit specified. This can be
 * used "enqueue" a bunch of function executes and limit the rate at which they
 * will be called.
 *
 * @example
 * ```javascript
 * const fn = n => console.log(n, new Date());
 * const throttle = new Throttle(fn, 1000);
 * throttle.add(1);
 * throttle.add(2);
 * throttle.add(3);
 * ```
 */
class Throttle {
  constructor(fn, rateMs) {
    this.fn = fn;
    this.rateMs = rateMs;
    this._args = [];
    this._handle;
  }

  add(...args) {
    this._args.push(args);
    this._unschedule();
    this._schedule();
  }

  reset() {
    this._unschedule();
    this._args.length = 0;
  }

  _unschedule() {
    clearTimeout(this._handle);
  }

  _schedule() {
    this._handle = setTimeout(this._process.bind(this), this.rateMs);
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

module.exports.Throttle = Throttle;
