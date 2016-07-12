var fs = require('fs');
var path = require('path');

var Schema = exports.Schema = require('./lib/schema').Schema;
exports.AbstractClass = require('./lib/model.js');

var baseSQL = './lib/sql';

exports.__defineGetter__('BaseSQL', function () {
    return require(baseSQL);
});

exports.loadSchema = function(filename, settings, compound) {
    return require('./legacy-compound-schema-loader')(filename, settings, compound);
};

exports.init = function (compound) {
    return require('./legacy-compound-init')(compound);
};

exports.__defineGetter__('version', function () {
    return JSON.parse(fs.readFileSync(__dirname + '/package.json')).version;
});

var commonTest = './test/common_test';
exports.__defineGetter__('test', function () {
    return require(commonTest);
});
