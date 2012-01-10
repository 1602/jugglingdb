exports.Schema = require('./lib/schema').Schema;
exports.AbstractClass = require('./lib/abstract-class').AbstractClass;
exports.Validatable = require('./lib/validatable').Validatable;

exports.version = JSON.parse(require('fs').readFileSync('./package.json')).version;
