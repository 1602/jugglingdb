// This test written in mocha+should.js
const should = require('./init.js');
const Schema = require ('../').Schema;

let db = getSchema(), slave = getSchema(), Model, SlaveModel;

describe('schema', function() {

    it('should define Model', function() {
        Model = db.define('Model');
        Model.schema.should.eql(db);
        const m = new Model;
        m.schema.should.eql(db);
    });

    it('should clone existing model', function() {
        SlaveModel = slave.copyModel(Model);
        SlaveModel.schema.should.eql(slave);
        slave.should.not.eql(db);
        const sm = new SlaveModel;
        sm.should.be.instanceOf(Model);
        sm.schema.should.not.eql(db);
        sm.schema.should.eql(slave);
    });

    it('should automigrate', function(done) {
        db.automigrate(done);
    });

    it('should create transaction', function(done) {
        const tr = db.transaction();
        tr.connected.should.be.false;
        tr.connecting.should.be.false;
        let called = false;
        tr.models.Model.should.not.equal(db.models.Model);
        tr.models.Model.create([{},{}, {}], function() {
            called = true;
        });
        tr.connected.should.be.false;
        tr.connecting.should.be.true;

        db.models.Model.count(function(err, c) {
            should.not.exist(err);
            should.exist(c);
            c.should.equal(0);
            called.should.be.false;
            tr.exec(function() {
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
            const db = new Schema('memory');
            db.adapter.isActual = function(cb) {
                return cb(null, true);
            };

            db.isActual(function(err, result) {
                result.should.be.true();
                done();
            });
        });

        it('should return undefined when adapter is schema-less', function(done) {
            const db = new Schema('memory');
            delete db.adapter.isActual;

            db.isActual(function(err, result) {
                (typeof result).should.equal('undefined');
                done();
            });
        });

    });

    describe('autoupdate', function() {

        it('should delegate autoupdate to adapter', function(done) {
            const db = new Schema('memory');
            db.adapter = {
                autoupdate: done
            };
            db.autoupdate();
        });

    });

    describe('automigrate', function() {

        it('should delegate automigrate to adapter', function() {
            const db = new Schema('memory');
            let called = false;
            db.adapter.automigrate = function(cb) {
                process.nextTick(function() {
                    called = true;
                    cb(null);
                });
            };

            return db.automigrate()
                .then(function() {
                    return called.should.be.true();
                });
        });

        it('should reject in case of error', function() {
            const db = new Schema('memory');
            const called = false;
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
            const db = new Schema('memory');
            db.define('User', { something: Number });
            db.adapter = {
                defineForeignKey(model, prop, cb) {
                    cb(null, Number);
                    done();
                }
            };
            db.defineForeignKey('User', 'appId');
        });

    });

    describe('connect', function() {

        it('should delegate connect to adapter', function(done) {
            const db = new Schema({
                initialize(schema, cb) {
                    schema.adapter = {
                        connect(cb) {
                            cb();
                        }
                    };
                }
            });
            db.once('connected', done);
            db.connect();
        });

        it('should support adapters without connections', function() {
            const db = new Schema({
                initialize(schema, cb) {
                    schema.adapter = {};
                }
            });
            return db.connect()
                .then(function(schema) {
                    schema.connecting.should.be.false();
                });
        });

        it('should catch connection errors', function() {
            const db = new Schema({
                initialize(schema, cb) {
                    schema.adapter = {
                        connect(cb) {
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
            const db = new Schema('memory');
            db.adapter = {
                disconnect: done
            };
            db.disconnect();
        });

        it('should call callback with "disconnect" is not handled by adapter', function(done) {
            const db = new Schema('memory');
            delete db.adapter.disconnect;
            db.disconnect(done);
        });

    });

});
