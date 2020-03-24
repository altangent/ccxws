const zlib = require("zlib");

module.exports = {
  unzip,
  inflateRaw,
};

const queue = [];
let current;

/**
 * Serialized unzip using async zlib.unzip method. This function is a helper to
 * address issues with memory fragmentation issues as documented here:
 * https://nodejs.org/api/zlib.html#zlib_threadpool_usage_and_performance_considerations
 *
 * @param {Buffer} data
 * @param {(err:Error, result:Buffer) => void} cb
 */
function unzip(data, cb) {
  queue.push(["unzip", data, cb]);
  serialExecute();
}

/**
 * Serialized inflateRaw using async zlib.unzip method. This function is a helper to
 * address issues with memory fragmentation issues as documented here:
 * https://nodejs.org/api/zlib.html#zlib_threadpool_usage_and_performance_considerations
 *
 * @param {Buffer} data
 * @param {(err:Error, result:Buffer) => void} cb
 */
function inflateRaw(data, cb) {
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
  zlib[current[0]](current[1], (err, res) => {
    // call supplied callback
    current[2](err, res);

    // reset the current status
    current = undefined;

    // immediate try next item
    serialExecute();
  });
}
