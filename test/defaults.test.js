// This test written in mocha+should.js
const should = require('./init.js');

const db = getSchema();

describe('defaults', function() {
    let Server;

    before(function() {
        Server = db.define('Server', {
            host: String,
            port: { type: Number, default: 80 }
        });
    });

    it('should apply defaults on new', function() {
        const s = new Server;
        s.port.should.equal(80);
    });

    it('should apply defaults on create', function(done) {
        Server.create(function(err, s) {
            s.port.should.equal(80);
            done();
        });
    });

    it('should apply defaults on read', function(done) {
        db.defineProperty('Server', 'host', {
            type: String,
            default: 'localhost'
        });
        Server.all(function(err, servers) {
            (new String('localhost')).should.equal(servers[0].host);
            done();
        });
    });
});
