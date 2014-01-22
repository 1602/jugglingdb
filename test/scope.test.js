// This test written in mocha+should.js
var should = require('./init.js');

var db, Railway, Station;

describe('sc0pe', function() {

    before(function() {
        db = getSchema();
        Railway = db.define('Railway', {
            URID: {type: String, index: true}
        });
        Station = db.define('Station', {
            USID: {type: String, index: true},
            capacity: {type: Number, index: true},
            thoughput: {type: Number, index: true},
            isActive: {type: Boolean, index: true},
            isUndeground: {type: Boolean, index: true}
        });
    });

    beforeEach(function(done) {
        Railway.destroyAll(function() {
            Station.destroyAll(done);
        });
    });

    it('should define scope with query', function(done) {
        Station.scope('active', {where: {isActive: true}});
        Station.active.create(function(err, station) {
            should.not.exist(err);
            should.exist(station);
            should.exist(station.isActive);
            station.isActive.should.be.true;
            done();
        });
    });

    it('should allow scope chaining', function(done) {
        Station.scope('active', {where: {isActive: true}});
        Station.scope('subway', {where: {isUndeground: true}});
        Station.active.subway.create(function(err, station) {
            should.not.exist(err);
            should.exist(station);
            station.isActive.should.be.true;
            station.isUndeground.should.be.true;
            done();
        })
    });

    it('should query all', function(done) {
        Station.scope('active', {where: {isActive: true}});
        Station.scope('inactive', {where: {isActive: false}});
        Station.scope('ground', {where: {isUndeground: true}});
        Station.active.ground.create(function() {
            Station.inactive.ground.create(function() {
                Station.ground.inactive(function(err, ss) {
                    ss.should.have.lengthOf(1);
                    done();
                });
            });
        });
    });

    it('should destroy all', function(done) {
        Station.inactive.ground.create(function() {
            Station.inactive(function(err, ss) {
                ss.should.have.lengthOf(1);
                Station.inactive.destroyAll(function() {
                    Station.inactive(true, function(err, ss) {
                        ss.should.have.lengthOf(0);
                        done();
                    });
                });
            });
        });
    });
});
