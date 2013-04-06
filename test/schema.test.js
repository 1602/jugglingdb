// This test written in mocha+should.js
var should = require('./init.js');

var db = getSchema(), slave = getSchema(), Model, SlaveModel;

describe('schema', function() {

    it('should define Model', function() {
        Model = db.define('Model');
        Model.schema.should.eql(db);
        var m = new Model;
        m.schema.should.eql(db);
    });

    it('should clone existing model', function() {
        SlaveModel = slave.copyModel(Model);
        SlaveModel.schema.should.eql(slave);
        slave.should.not.eql(db);
        var sm = new SlaveModel;
        sm.should.be.instanceOf(Model);
        sm.schema.should.not.eql(db);
        sm.schema.should.eql(slave);
    });

    it('should automigrate', function(done) {
        db.automigrate(done);
    });

    it('should create transaction', function(done) {
        var tr = db.transaction();
        tr.connected.should.be.false;
        tr.connecting.should.be.false;
        var called = false;
        tr.models.Model.create(Array(3), function () {
            called = true;
        });
        tr.connected.should.be.false;
        tr.connecting.should.be.true;

        db.models.Model.count(function(err, c) {
            should.not.exist(err);
            should.exist(c);
            c.should.equal(0);
            called.should.be.false;
            tr.exec(function () {
                setTimeout(function() {
                    called.should.be.true;
                    db.models.Model.count(function(err, c) {
                        c.should.equal(3);
                        done();
                    });
                }, 100);
            });
        });
    });

});
