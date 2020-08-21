const AbstractStrategy = require('./abstract-strategy');
const FillHolesStrategy = require('./fill-holes-strategy');

module.exports = {
  ...AbstractStrategy,
  ...FillHolesStrategy,
};
