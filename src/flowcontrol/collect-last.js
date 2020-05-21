/**
 * Collection strategy that stores final call and executes the function with
 * the arguments used for the final calls
 */
class CollectLast {
  constructor() {
    this.reset();
  }

  add(args) {
    this.args = args;
  }

  reset() {
    this.args = undefined;
  }

  execute(fn) {
    if (!this.args) return;
    fn(...this.args);
    this.reset();
  }
}

module.exports.CollectLast = CollectLast;
