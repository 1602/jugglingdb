module.exports = require('should');

var Schema = require('../').Schema;

if (!('getSchema' in global)) {
    global.getSchema = function() {
        return new Schema('memory');
    };
}
