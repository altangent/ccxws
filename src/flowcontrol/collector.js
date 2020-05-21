/**
 * Collector allows repeated calls to a function but will delay execution of the
 * function until a a timeout period expires. Upon expiration, the function is
 * called with arguments organized by some argument collection strategy
 *
 * @example
 * const fn = n => console.log(n, new Date());
 * const strategy = new CollectLast();
 * const collector = new Collector(fn, strategy, waitMs);
 * const waitMs = 100;
 * collector.execute('h');
 * collector.execute('he');
 * collector.execute('hel');
 * collector.execute('hell');
 * collector.execute('hello');
 */
class Collector {
  constructor(fn, strategy, waitMs = 0) {
    this.fn = fn;
    this.waitMs = waitMs;
    this.strategy = strategy;
    this._handle;
    this.add = this.add.bind(this);
  }

  add(...args) {
    this.strategy.add(args);
    this._unschedule();
    this._schedule();
  }

  reset() {
    this._unschedule();
    this.strategy.reset();
  }

  _unschedule() {
    clearTimeout(this._handle);
  }

  _schedule() {
    this._handle = setTimeout(this._process.bind(this), this.waitMs);
    this._handle.unref();
  }

  _process() {
    this.strategy.execute(this.fn);
  }
}

module.exports.Collector = Collector;
