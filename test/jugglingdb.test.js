// This test written in mocha+should.js
var should = require('./init.js');

var jugglingdb = require('../');

describe('jugglingdb', function() {
    it('should expose version', function () {
        jugglingdb.version.should.equal(require('../package.json').version);
    });
});
