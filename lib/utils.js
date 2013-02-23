if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function() {

var exports = {};
exports.safeRequire = safeRequire;

function safeRequire(module) {
    try {
        return require(module);
    } catch (e) {
        console.log('Run "npm install jugglingdb ' + module + '" command to use jugglingdb using ' + module + ' database engine');
        process.exit(1);
    }
}

return exports;

});
