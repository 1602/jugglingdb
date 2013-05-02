// This test written in mocha+should.js
var should = require('./init.js');

var j = require('../'), db, User;
var ValidationError = require('../lib/validations.js').ValidationError;

function getValidAttributes() {
    return {
        name: 'Anatoliy',
        email: 'email@example.com',
        state: '',
        age: 26,
        gender: 'male',
        createdByAdmin: false,
        createdByScript: true
    };
}

describe('validations', function() {

    before(function(done) {
        db = getSchema();
        User = db.define('User', {
            email: String,
            name: String,
            password: String,
            state: String,
            age: Number,
            gender: String,
            domain: String,
            pendingPeriod: Number,
            createdByAdmin: Boolean,
            createdByScript: Boolean,
            updatedAt: Date
        });
        db.automigrate(done);
    });

    beforeEach(function(done) {
        User.destroyAll(function() {
            delete User._validations;
            done();
        });
    });

    after(function() {
        db.disconnect();
    });

    describe('commons', function() {

        describe('skipping', function() {

            it('should allow to skip using if: attribute', function() {
                User.validatesPresenceOf('pendingPeriod', {if: 'createdByAdmin'});
                var user = new User;
                user.createdByAdmin = true;
                user.isValid().should.be.false;
                user.errors.pendingPeriod.should.eql(['can\'t be blank']);
                user.pendingPeriod = 1
                user.isValid().should.be.true;
            });

        });

        describe('lifecycle', function() {

            it('should work on create', function(done) {
                delete User._validations;
                User.validatesPresenceOf('name');
                User.create(function(e, u) {
                    should.exist(e);
                    User.create({name: 'Valid'}, function(e, d) {
                        should.not.exist(e);
                        done();
                    });
                });
            });

            it('should work on update', function(done) {
                delete User._validations;
                User.validatesPresenceOf('name');
                User.create({name: 'Valid'}, function(e, d) {
                    d.updateAttribute('name', null, function(e) {
                        should.exist(e);
                        e.should.be.instanceOf(Error);
                        e.should.be.instanceOf(ValidationError);
                        d.updateAttribute('name', 'Vasiliy', function(e) {
                            should.not.exist(e);
                            done();
                        });
                    })
                });
            });

            it('should return error code', function(done) {
                delete User._validations;
                User.validatesPresenceOf('name');
                User.create(function(e, u) {
                    should.exist(e);
                    e.codes.name.should.eql(['presence']);
                    done();
                });
            });

            it('should allow to modify error after validation', function(done) {
                User.afterValidate = function(next) {
                    next();
                };
                done();
            });

        });
    });

    describe('presence', function() {

        it('should validate presence', function() {
            User.validatesPresenceOf('name', 'email');
            var u = new User;
            u.isValid().should.not.be.true;
            u.name = 1;
            u.email = 2;
            u.isValid().should.be.true;
        });

        it('should skip validation by property (if/unless)', function() {
            User.validatesPresenceOf('domain', {unless: 'createdByScript'});

            var user = new User(getValidAttributes())
            user.isValid().should.be.true;

            user.createdByScript = false;
            user.isValid().should.be.false;
            user.errors.domain.should.eql(['can\'t be blank']);

            user.domain = 'domain';
            user.isValid().should.be.true;
        });

    });

    describe('uniqueness', function() {
        it('should validate uniqueness', function(done) {
            User.validatesUniquenessOf('email');
            var u = new User({email: 'hey'});
            Boolean(u.isValid(function(valid) {
                valid.should.be.true;
                u.save(function() {
                    var u2 = new User({email: 'hey'});
                    u2.isValid(function(valid) {
                        valid.should.be.false;
                        done();
                    });
                });
            })).should.be.false;
        });

        it('should handle same object modification', function(done) {
            User.validatesUniquenessOf('email');
            var u = new User({email: 'hey'});
            Boolean(u.isValid(function(valid) {
                valid.should.be.true;
                u.save(function() {
                    u.name = 'Goghi';
                    u.isValid(function(valid) {
                        valid.should.be.true;
                        u.save(done);
                    });
                });
                // async validations always falsy when called as sync
            })).should.not.be.ok;
        });

    });

    describe('format', function() {
        it('should validate format');
        it('should overwrite default blank message with custom format message');
    });

    describe('numericality', function() {
        it('should validate numericality');
    });

    describe('inclusion', function() {
        it('should validate inclusion');
    });

    describe('exclusion', function() {
        it('should validate exclusion');
    });

    describe('length', function() {
        it('should validate length');
    });

    describe('custom', function() {
        it('should validate using custom sync validation');
        it('should validate using custom async validation');
    });
});
