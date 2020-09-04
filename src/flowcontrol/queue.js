const { CircularBuffer } = require("./circular-buffer");

/**
 * Implements a fast FIFO Queue using a circular buffer.
 */
class Queue {
  constructor(bufferSize = 1 << 12) {
    this.buffer = new CircularBuffer(bufferSize);
  }

  shift() {
    return this.buffer.read();
  }

  push(val) {
    if (!this.buffer.write(val)) {
      this._resize();
      this.buffer.write(val);
    }
  }

  _resize() {
    // construct a new buffer
    let newBuf = new CircularBuffer(this.buffer.size * 2);

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let val = this.buffer.read();
      if (val === undefined) break;
      newBuf.write(val);
    }

    this.buffer = newBuf;
  }
}

module.exports.Queue = Queue;
