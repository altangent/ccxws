/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-implied-eval */

import { CancelableFn, Fn } from "./Fn";

export class Debounce {
    protected _handle: NodeJS.Timeout;
    protected _last: any;

    constructor(readonly fn: Fn, readonly waitMs: number = 100) {
        this._handle;
        this._last;
    }

    public add(...args: any[]) {
        this._last = args;
        this._unschedule();
        this._schedule();
    }

    public cancel() {
        this._unschedule();
        this._last = undefined;
    }

    protected _unschedule() {
        clearTimeout(this._handle);
    }

    protected _schedule() {
        this._handle = setTimeout(this._process.bind(this), this.waitMs);
        if (this._handle.unref) {
            this._handle.unref();
        }
    }

    protected _process() {
        if (!this._last) return;
        this.fn(...this._last);
    }
}

/**
 * Debounce allows repeated calls to a function but will delay execution of the
 * function until a a timeout period expires. Upon expiration, the function is
 * called with the last value that was provided
 *
 * @example
 * const debounceMs = 100;
 * const fn = n => console.log(n, new Date());
 * const debouncedFn = debounce(fn, debounceMs);
 * debouncedFn('h');
 * debouncedFn('he');
 * debouncedFn('hel');
 * debouncedFn('hell');
 * debouncedFn('hello');
 */
export function debounce(fn: Fn, debounceMs: number = 100): CancelableFn {
    const i = new Debounce(fn, debounceMs);
    const add = i.add.bind(i);
    add.cancel = i.cancel.bind(i);
    return add as CancelableFn;
}
