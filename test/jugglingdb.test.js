// This test written in mocha+should.js
const should = require('./init.js');

const jugglingdb = require('../');

describe('jugglingdb', function() {
    it('should expose version', function() {
        jugglingdb.version.should.equal(require('../package.json').version);
    });
});
