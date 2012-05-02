var fs = require('fs');
var path = require('path');

exports.Schema = require('./lib/schema').Schema;
exports.AbstractClass = require('./lib/abstract-class').AbstractClass;
exports.Validatable = require('./lib/validatable').Validatable;

exports.init = function (root) {
    if (!global.railway) return;
    railway.orm = exports;
    require('./lib/railway')(root);
};

try {
    if (process.versions.node < '0.6') {
        exports.version = JSON.parse(fs.readFileSync(__dirname + '/package.json')).version;
    } else {
        exports.version = require('../package').version;
    }
} catch (e) {}

