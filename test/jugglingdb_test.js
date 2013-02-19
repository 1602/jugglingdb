var juggling = require('../index');
require('./spec_helper').init(module.exports);

it('should expose version', function (test) {
    console.log('version:', juggling.version);
    test.ok(juggling.version);
    test.done();
});
