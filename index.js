if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(['fs', 'path', './lib/schema', './lib/abstract-class',
  './lib/validatable', './lib/sql']
  , function(fs, path, schema, abstractClass
    , validatable, baseSQL) {

var exports = {};
exports.Schema = schema.Schema;
exports.AbstractClass = abstractClass.AbstractClass;
exports.Validatable = validatable.Validatable;

exports.__defineGetter__('BaseSQL', function () {
    return baseSQL;
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
        exports.version = require('./package').version;
    }
} catch (e) {}

return exports;

});
