var jdb = require('../'),
    Schema = jdb.Schema,
    test = require('./common_test');

var schema = new Schema('memory');

test(module.exports, schema);

test.skip('hasMany should be cached');

