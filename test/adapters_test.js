var jdb = require('jugglingdb'),
    Schema = jdb.Schema,
    test = jdb.test;

var schema = new Schema('memory');

test(module.exports, schema);

test.skip('hasMany should be cached');

