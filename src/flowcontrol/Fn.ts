export type Fn = (...args: any[]) => void;
export type CancelableFn = Fn | { cancel: () => void };
