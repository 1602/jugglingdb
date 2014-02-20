module.exports = require('should');

if (!process.env.TRAVIS) {
    if (typeof __cov === 'undefined') {
        process.on('exit', function () {
            require('semicov').report();
        });
    }

    require('semicov').init('lib');
}

var Schema = require('../').Schema;

if (!('getSchema' in global)) {
    global.getSchema = function() {
        return new Schema('memory');
    };
}
