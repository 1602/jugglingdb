var fs = require('fs');
var path = require('path');

exports.Schema = require('./lib/schema').Schema;
exports.AbstractClass = require('./lib/abstract-class').AbstractClass;
exports.Validatable = require('./lib/validatable').Validatable;

var baseSQL = './lib/sql';

exports.__defineGetter__('BaseSQL', function () {
    return require(baseSQL);
});

exports.init = function (rw) {
    if (global.railway) {
        global.railway.orm = exports;
    } else {
        rw.orm = {Schema: exports.Schema, AbstractClass: exports.AbstractClass};
    }
    var railway = './lib/railway';
    require(railway)(rw);
};

try {
    if (process.versions.node < '0.6') {
        exports.version = JSON.parse(fs.readFileSync(__dirname + '/package.json')).version;
    } else {
        exports.version = require('../package').version;
    }
} catch (e) {}

var commonTest = './test/common_test';
exports.__defineGetter__('test', function () {
    return require(commonTest);
});
