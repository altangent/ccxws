/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/**
 * Implements a fast fixed size circular buffer. This buffer has O(1)
 * reads and write. The fixed size is limited to n-1 values in the
 * buffer. The final value is used as a marker to indicate that the
 * buffer is full. This trades a small amount of space for performance
 * by not requiring maintenance of a counter.
 *
 * In benchmarks this performs ~50,000 ops/sec which is twice as fast
 * as the `double-ended-queue` library.
 */
export class CircularBuffer<T> {
    public buffer: T[];
    public writePos: number;
    public readPos: number;

    constructor(readonly size: number) {
        this.buffer = new Array(size).fill(undefined);
        this.writePos = 0;
        this.readPos = 0;
    }

    /**
     * Writes a value into the buffer. Returns `false` if the buffer is
     * full. Otherwise returns `true`.
     *
     * @remarks
     *
     * The `writePos` is incremented prior to writing. This allows the
     * `readPos` to chase the `writePos` and allows us to not require a
     * counter that needs to be maintained.
     */
    public write(val: T) {
        const newPos = (this.writePos + 1) % this.size;
        if (newPos === this.readPos) return false;
        this.writePos = newPos;
        this.buffer[this.writePos] = val;
        return true;
    }

    /**
     * Reads the next value from the circular buffer. Returns `undefined`
     * when there is no data in the buffer.
     *
     * @remarks
     *
     * The `readPos` will chase the `writePos` and we increment the
     * `readPos` prior to reading in the same way that we increment teh
     * `writePos` prior to writing.
     */
    public read() {
        if (this.readPos === this.writePos) return; // empty
        this.readPos = (this.readPos + 1) % this.size;
        const val = this.buffer[this.readPos];
        this.buffer[this.readPos] = undefined;
        return val;
    }
}
