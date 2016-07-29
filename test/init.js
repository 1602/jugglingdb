module.exports = require('should');

const Schema = require('../').Schema;

if (!('getSchema' in global)) {
    global.getSchema = function() {
        return new Schema('memory');
    };
}
