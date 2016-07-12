// This test written in mocha+should.js
var should = require('./init.js');
var Schema = require ('../').Schema;

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
        tr.models.Model.should.not.equal(db.models.Model);
        tr.models.Model.create([{},{}, {}], function () {
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

    describe('isActual', function() {

        it('should delegate schema check to adapter', function(done) {
            var db = new Schema('memory');
            db.adapter.isActual = function(cb) {
                return cb(null, true);
            };

            db.isActual(function(err, result) {
                result.should.be.true();
                done();
            });
        });

        it('should return undefined when adapter is schema-less', function(done) {
            var db = new Schema('memory');
            delete db.adapter.isActual;

            db.isActual(function(err, result) {
                (typeof result).should.equal('undefined');
                done();
            });
        });

    });

    describe('autoupdate', function() {

        it('should delegate autoupdate to adapter', function(done) {
            var db = new Schema('memory');
            db.adapter = {
                autoupdate: done
            };
            db.autoupdate();
        });

    });

    describe('automigrate', function() {

        it('should delegate automigrate to adapter', function() {
            var db = new Schema('memory');
            var called = false;
            db.adapter.automigrate = function(cb) {
                process.nextTick(function() {
                    called = true;
                    cb(null);
                });
            };

            return db.automigrate()
                .then(function () {
                    return called.should.be.true();
                });
        });

        it('should reject in case of error', function() {
            var db = new Schema('memory');
            var called = false;
            db.adapter.automigrate = function(cb) {
                throw new Error('Oopsie');
            };

            return db.automigrate()
                .then(function() {
                    throw new Error('Unexpected success');
                })
                .catch(function(err) {
                    err.message.should.equal('Oopsie');
                });
        });

    });

    describe('defineForeignKey', function() {

        it('should allow adapter to define foreign key', function(done) {
            var db = new Schema('memory');
            db.define('User', { something: Number });
            db.adapter = {
                defineForeignKey: function(model, prop, cb) {
                    cb(null, Number);
                    done();
                }
            };
            db.defineForeignKey('User', 'appId');
        });

    });

    describe('connect', function() {

        it('should delegate connect to adapter', function(done) {
            var db = new Schema({
                initialize: function(schema, cb) {
                    schema.adapter = {
                        connect: function(cb) {
                            cb();
                        }
                    };
                }
            });
            db.once('connected', done);
            db.connect();
        });

        it('should support adapters without connections', function() {
            var db = new Schema({
                initialize: function(schema, cb) {
                    schema.adapter = {};
                }
            });
            return db.connect()
                .then(function(schema) {
                    schema.connecting.should.be.false();
                });
        });

        it('should catch connection errors', function() {
            var db = new Schema({
                initialize: function(schema, cb) {
                    schema.adapter = {
                        connect: function(cb) {
                            cb(new Error('Connection error'));
                        }
                    };
                }
            });

            return db.connect()
                .then(function() {
                    throw new Error('Unexpected success');
                })
                .catch(function(err) {
                    err.message.should.equal('Connection error');
                });
        });

    });

    describe('disconnect', function() {

        it('should delegate disconnection to adapter', function(done) {
            var db = new Schema('memory');
            db.adapter = {
                disconnect: done
            };
            db.disconnect();
        });

        it('should call callback with "disconnect" is not handled by adapter', function(done) {
            var db = new Schema('memory');
            delete db.adapter.disconnect;
            db.disconnect(done);
        });

    });

});
