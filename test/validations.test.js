// This test written in mocha+should.js
var should = require('./init.js');

var j = require('../'), db, User;
var ValidationError = require('../lib/validations.js').ValidationError;

function getValidAttributes() {
    return {
        name: 'Maria',
        email: 'email@example.com',
        state: '',
        bio: 'haha',
        age: 26,
        countryCode: 'RU',
        gender: 'female',
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
            bio: String,
            gender: String,
            domain: String,
            countryCode: String,
            pendingPeriod: Number,
            createdByAdmin: Boolean,
            createdByScript: Boolean,
            updatedAt: Date
        });
        db.automigrate(done);
    });

    beforeEach(function(done) {
        User.beforeValidate = null
        User.destroyAll(function() {
            delete User._validations;
            done();
        });
    });

    after(function() {
        db.disconnect();
    });

    describe('hooks', function() {

        it('should trigger beforeValidate with data (has validations)', function(done) {

            User.validatesPresenceOf('name');
            User.beforeValidate = function(next, data) {
                should.exist(data)
                next(new Error('Fail'));
            };

            var user = new User;
            user.isValid(function(valid) {
                // when validate hook fails, valid should be false
                valid.should.equal(false)
                done()
            }, { name: 'test' })
        });

        it('should trigger beforeValidate with data (no validations set)', function(done) {
            User.beforeValidate = function(next, data) {
                should.exist(data)
                data.name.should.equal('test')
                next();
            };
            var user = new User;
            user.isValid(function(valid) {
                valid.should.equal(true)
                done()
            }, { name: 'test' })
        });

        it('should allow flow break by pass error to callback', function(done) {

            User.beforeValidate = function(next) {
                next(new Error('failed'));
            };
            User.create(function(err, model) {
                should.exist(err);
                should.exist(model);
                done()
            })
        })

    })

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

        it('should correctly handle null values', function(done) {
            User.validatesUniquenessOf('email', {allowNull: true});
            var u = new User({email: null});
            Boolean(u.isValid(function(valid) {
                valid.should.be.true;
                u.save(function() {
                    var u2 = new User({email: null});
                    u2.isValid(function(valid) {
                        valid.should.be.true;
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
        it('should validate max length', function(done) {
            User.validatesLengthOf('gender', {max: 6});
            var u = new User(getValidAttributes());
            u.isValid(function(valid) {
                should.not.exist(u.errors);
                valid.should.be.true;
                u.gender = 'undefined';
                u.isValid(function(valid) {
                    u.errors.should.be.ok;
                    valid.should.be.false;
                    done();
                });
            });
        });

        it('should validate min length', function(done) {
            User.validatesLengthOf('bio', {min: 3});
            var u = new User({bio: 'ha'});
            u.isValid(function(valid) {
                u.errors.should.be.ok;
                valid.should.be.false;
                u.bio = 'undefined';
                u.isValid(function(valid) {
                    should.not.exist(u.errors);
                    valid.should.be.true;
                    done();
                });
            });
        });

        it('should validate exact length', function(done) {
            User.validatesLengthOf('countryCode', {is: 2});
            var u = new User(getValidAttributes());
            u.isValid(function(valid) {
                should.not.exist(u.errors);
                valid.should.be.true;
                u.countryCode = 'RUS';
                u.isValid(function(valid) {
                    should.exist(u.errors);
                    valid.should.be.false;
                    done();
                });
            });
        });
    });

    describe('custom', function() {
        it('should validate using custom sync validation');
        it('should validate using custom async validation');
    });
});
