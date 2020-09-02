const ClientWithCounter = require('./client-with-counter');
const balanced = require('./load-balance');

module.exports = {
  ...ClientWithCounter,
  balanced,
};
