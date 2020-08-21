const ccxws = require('../src');

const exchange = new ccxws.Binance();

exchange.on('trade', x => x);
exchange.subscribeTrades({
  id: 'BTCUSDT',
  base: 'BTC',
  quote: 'USDT',
});

exchange.subscribeTrades({
  id: 'ETHBTC',
  base: 'ETH',
  quote: 'BTC',
});

exchange.subscribeTrades({
  id: 'ETHUSDT',
  base: 'ETH',
  quote: 'USDT',
});


setTimeout(() => {

  exchange.unsubscribeTrades({
    id: 'ETHUSDT',
    base: 'ETH',
    quote: 'USDT',
  });
  
}, 2000);


setTimeout(() => {
  exchange.unsubscribeTrades({
    id: 'ETHBTC',
    base: 'ETH',
    quote: 'BTC',
  });
  
}, 4000);


setTimeout(() => {

  exchange.subscribeTrades({
    id: 'ETHUSDT',
    base: 'ETH',
    quote: 'USDT',
  });
  
}, 5000);




setTimeout(() => {
  exchange.unsubscribeTrades({
    id: 'ETHUSDT',
    base: 'ETH',
    quote: 'USDT',
  });

  exchange.unsubscribeTrades({
    id: 'BTCUSDT',
    base: 'BTC',
    quote: 'USDT',
  });
  
}, 8000);
