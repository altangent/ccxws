/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import zlib from "zlib";
import { Queue } from "./flowcontrol/Queue";
const queue = new Queue<any>();

let current: [string, Buffer, ZlibCallback];

export type ZlibCallback = (err: Error, result: Buffer) => void;

/**
 * Serialized unzip using async zlib.unzip method. This function is a helper to
 * address issues with memory fragmentation issues as documented here:
 * https://nodejs.org/api/zlib.html#zlib_threadpool_usage_and_performance_considerations
 */
export function unzip(data: Buffer, cb: ZlibCallback): void {
    queue.push(["unzip", data, cb]);
    serialExecute();
}

/**
 * Serialized inflate using async zlib.inflate method. This function is a helper to
 * address issues with memory fragmentation issues as documented here:
 * https://nodejs.org/api/zlib.html#zlib_threadpool_usage_and_performance_considerations
 */
export function inflate(data: Buffer, cb: ZlibCallback): void {
    queue.push(["inflate", data, cb]);
    serialExecute();
}

/**
 * Serialized inflateRaw using async zlib.inflateRaw method. This function is a helper to
 * address issues with memory fragmentation issues as documented here:
 * https://nodejs.org/api/zlib.html#zlib_threadpool_usage_and_performance_considerations
 *
 */
export function inflateRaw(data: Buffer, cb: ZlibCallback) {
    queue.push(["inflateRaw", data, cb]);
    serialExecute();
}

function serialExecute() {
    // abort if already executng
    if (current) return;

    // remove first item and abort if nothing else to do
    current = queue.shift();
    if (!current) return;

    // perform unzip
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    zlib[current[0]](current[1], (err: Error, res: Buffer) => {
        // call supplied callback
        current[2](err, res);

        // reset the current status
        current = undefined;

        // immediate try next item
        serialExecute();
    });
}
