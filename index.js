var fs = require('fs');
var path = require('path');

exports.Schema = require('./lib/schema').Schema;
exports.AbstractClass = require('./lib/abstract-class').AbstractClass;
exports.Validatable = require('./lib/validatable').Validatable;
exports.BaseSQL = require('./lib/sql');

exports.init = function (rw) {
    if (typeof rw === 'string') {
        railway.orm = exports;
    } else {
        rw.orm = {Schema: exports.Schema, AbstractClass: exports.AbstractClass};
    }
    require('./lib/railway')(rw);
};

try {
    if (process.versions.node < '0.6') {
        exports.version = JSON.parse(fs.readFileSync(__dirname + '/package.json')).version;
    } else {
        exports.version = require('../package').version;
    }
} catch (e) {}

exports.test = require('./test/common_test');

