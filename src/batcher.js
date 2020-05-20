const { EventEmitter } = require("events");

/**
 * Debounced batching. Data is added to the batcher, which resets a debounce
 * period. When the debounce period expires, the "ready" event is emitted with
 * the items in the batch.
 *
 * A max batch size can be used to limit the number of items sent in the "ready"
 * event and another batch can then be scheduled.
 */
class Batcher extends EventEmitter {
  constructor(debounceMs = 250, batchLimit = 200, batchDelayMs = 1000) {
    super();
    this._handle;
    this._args = [];
    this.debounceMs = debounceMs;
    this.batchSize = batchLimit;
    this.batchDelayMs = batchDelayMs;

    this._process = this._process.bind(this);
  }

  get size() {
    return this._args.length;
  }

  add(...args) {
    this._args.push(args);
    this._clear();
    this._schedule();
  }

  _clear() {
    clearTimeout(this._handle);
  }

  _schedule() {
    this._handle = setTimeout(this._process.bind(this), this.debounceMs);
  }

  _scheduleNextBatch() {
    this._handle = setTimeout(this._process.bind(this), this.batchDelayMs);
  }

  _process() {
    this.emit("ready", this._args.splice(0, this.batchSize));
    if (this._args.length > 0) {
      this._scheduleNextBatch();
    } else {
      this.emit("complete");
    }
  }
}

module.exports.Batcher = Batcher;
