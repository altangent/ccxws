/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-implied-eval */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { CancelableFn, Fn } from "./Fn";

export class Throttle {
    private _calls: any[][];
    private _handle: NodeJS.Timeout;

    constructor(readonly fn: Fn, readonly delayMs: number) {
        this._calls = [];
        this._handle;
        this.add = this.add.bind(this);
    }

    public add(...args: any[]) {
        this._calls.push(args);
        if (!this._handle) this._process();
    }

    public cancel() {
        this._unschedule();
        this._calls = [];
    }

    private _unschedule() {
        clearTimeout(this._handle);
        this._handle = undefined;
    }

    private _schedule() {
        this._handle = setTimeout(this._process.bind(this), this.delayMs);
        if (this._handle.unref) {
            this._handle.unref();
        }
    }

    private _process() {
        this._handle = undefined;
        const args = this._calls.shift();
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
export function throttle(fn: Fn, delayMs: number): CancelableFn {
    const inst = new Throttle(fn, delayMs);
    const add = inst.add.bind(inst);
    add.cancel = inst.cancel.bind(inst);
    return add as CancelableFn;
}
