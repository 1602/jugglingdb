var fs = require('fs');
var path = require('path');

exports.Schema = require('./lib/schema').Schema;
exports.AbstractClass = require('./lib/model.js').AbstractClass;
exports.Validatable = require('./lib/validations.js').Validatable;

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

    if (rw.version > '1.1.5-15') {
        rw.on('after routes', initialize);
    } else {
        initialize();
    }

    function initialize() {
        try {
            var init = require(railway);
        } catch (e) {}
        if (init) init(rw);
    }
};

exports.__defineGetter__('version', function () {
    return JSON.parse(fs.readFileSync(__dirname + '/package.json')).version;
});

var commonTest = './test/common_test';
exports.__defineGetter__('test', function () {
    return require(commonTest);
});
