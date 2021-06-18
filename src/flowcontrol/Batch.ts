/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-implied-eval */

import { CancelableFn, Fn } from "./Fn";

export class Batch {
    protected _handle: NodeJS.Timeout;
    protected _args: any[];

    constructor(readonly fn: Fn, readonly batchSize: number, readonly collectMs: number = 0) {
        this._handle;
        this._args = [];
    }

    public add(...args) {
        this._args.push(args);
        this._unschedule();
        this._schedule();
    }

    public cancel() {
        this._unschedule();
        this._args = [];
    }

    protected _unschedule() {
        clearTimeout(this._handle);
    }

    protected _schedule() {
        this._handle = setTimeout(this._process.bind(this), this.collectMs);
        if (this._handle.unref) {
            this._handle.unref();
        }
    }

    protected _process() {
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
export function batch(
    fn: Fn,
    batchSize: number = Number.MAX_SAFE_INTEGER,
    collectMs: number = 0,
): CancelableFn {
    const inst = new Batch(fn, batchSize, collectMs);
    const add = inst.add.bind(inst);
    add.cancel = inst.cancel.bind(inst);
    return add as CancelableFn;
}
