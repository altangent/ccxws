import { CircularBuffer } from "./CircularBuffer";

/**
 * Implements a fast FIFO Queue using a circular buffer.
 */
export class Queue<T> {
    public buffer: CircularBuffer<T>;

    constructor(readonly bufferSize = 1 << 12) {
        this.buffer = new CircularBuffer(bufferSize);
    }

    public shift(): T {
        return this.buffer.read();
    }

    public push(val: T) {
        if (!this.buffer.write(val)) {
            this._resize();
            this.buffer.write(val);
        }
    }

    protected _resize() {
        // construct a new buffer
        const newBuf = new CircularBuffer<T>(this.buffer.size * 2);

        // eslint-disable-next-line no-constant-condition
        while (true) {
            const val = this.buffer.read();
            if (val === undefined) break;
            newBuf.write(val);
        }

        this.buffer = newBuf;
    }
}
