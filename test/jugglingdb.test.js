var jugglingdb = require('../');

describe('jugglingdb', function() {
    it('should expose version', function () {
        jugglingdb.version.should.equal(require('../package.json').version);
    });
});
