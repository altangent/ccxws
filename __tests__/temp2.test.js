console.log('--a')
const GeminiClient = require("../src/exchanges/gemini-client");
console.log('--b')

client = new GeminiClient();
const market = {
  id: 'btcusd',
  base: 'BTC',
  quote: 'USD'
};

// console.log('--clietn')
client.subscribeLevel2Updates(market);
client.on('l2update', (ticker, thisMarket) => {
  console.log('got ticker update', JSON.stringify({
    market,
    ticker
  }, null, 2));
  // console.log('got l2 update event', JSON.stringify({
  //   market,
  //   ticker
  // }, null, 2));
});
setTimeout(() => {
  // console.log('=======timeout hit, unsubbing');
  // client.unsubscribeTicker(market);
}, 5000);

// this.emit("connected");
//     for (let marketSymbol of this._tickerSubs.keys()) {
//       this._sendSubTicker(marketSymbol);
//     }
//     for (let marketSymbol of this._tradeSubs.keys()) {
//       this._sendSubTrades(marketSymbol);
//     }
//     for (let marketSymbol of this._level2SnapshotSubs.keys()) {
//       this._sendSubLevel2Snapshots(marketSymbol);
//     }
//     for (let marketSymbol of this._level2UpdateSubs.keys()) {
//       this._sendSubLevel2Updates(marketSymbol);
//     }
//     for (let marketSymbol of this._level3UpdateSubs.keys()) {
//       this._sendSubLevel3Updates(marketSymbol);
//     }
//     this._watcher.start();