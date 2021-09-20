export class Candle {
    constructor(
        readonly timestampMs: number,
        readonly open: string,
        readonly high: string,
        readonly low: string,
        readonly close: string,
        readonly volume: string,
    ) {}
}
