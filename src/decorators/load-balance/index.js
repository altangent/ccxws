const LoadBalanceClient = require('./load-balance-client');
const strategies = require('./strategies');

module.exports = {
  ...LoadBalanceClient,
  strategies,
};
