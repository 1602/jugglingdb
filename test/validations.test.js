// This test written in mocha+should.js
const should = require('./init.js');
const Schema = require('../').Schema;

let j = require('../'), db, User;
const ValidationError = require('../lib/validations.js').ValidationError;

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
        createdByScript: true,
        misc: Schema.JSON,
        bigText: Schema.Text
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
        User.beforeValidate = null;
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
                should.exist(data);
                next(new Error('Fail'));
            };

            const user = new User;
            user.isValid(function(valid) {
                // when validate hook fails, valid should be false
                valid.should.equal(false);
                done();
            }, { name: 'test' });
        });

        it('should trigger beforeValidate with data (no validations set)', function(done) {
            User.beforeValidate = function(next, data) {
                should.exist(data);
                data.name.should.equal('test');
                next();
            };
            const user = new User;
            user.isValid(function(valid) {
                valid.should.equal(true);
                done();
            }, { name: 'test' });
        });

        it('should allow flow break by pass error to callback', function(done) {

            User.beforeValidate = function(next) {
                next(new Error('failed'));
            };
            User.create(function(err, model) {
                should.exist(err);
                should.exist(model);
                done();
            });
        });

    });

    describe('commons', function() {

        describe('skipping', function() {

            it('should allow to skip using if: attribute', function() {
                User.validatesPresenceOf('pendingPeriod', { if: 'createdByAdmin' });
                const user = new User;
                user.createdByAdmin = true;
                user.isValid().should.be.false;
                user.errors.pendingPeriod.should.eql(['can\'t be blank']);
                user.pendingPeriod = 1;
                user.isValid().should.be.true;
            });

        });

        describe('lifecycle', function() {

            it('should work on create', function(done) {
                delete User._validations;
                User.validatesPresenceOf('name');
                User.create(function(e, u) {
                    should.exist(e);
                    User.create({ name: 'Valid' }, function(e, d) {
                        should.not.exist(e);
                        done();
                    });
                });
            });

            it('should work on update', function(done) {
                delete User._validations;
                User.validatesPresenceOf('name');
                User.create({ name: 'Valid' }, function(e, d) {
                    d.updateAttribute('name', null, function(e) {
                        should.exist(e);
                        e.should.be.instanceOf(Error);
                        e.name.should.equal('ValidationError');
                        d.updateAttribute('name', 'Vasiliy', function(e) {
                            should.not.exist(e);
                            done();
                        });
                    });
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
            const u = new User;
            u.isValid().should.not.be.true;
            u.name = 1;
            u.email = 2;
            u.isValid().should.be.true;
        });

        it('should skip validation by property (if/unless)', function() {
            User.validatesPresenceOf('domain', { unless: 'createdByScript' });

            const user = new User(getValidAttributes());
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
            const u = new User({ email: 'hey' });
            Boolean(u.isValid(function(valid) {
                valid.should.be.true;
                u.save(function() {
                    const u2 = new User({ email: 'hey' });
                    u2.isValid(function(valid) {
                        valid.should.be.false;
                        done();
                    });
                });
            })).should.be.false;
        });

        it('should correctly handle null values', function(done) {
            User.validatesUniquenessOf('email', { allowNull: true });
            const u = new User({ email: null });
            Boolean(u.isValid(function(valid) {
                valid.should.be.true;
                u.save(function() {
                    const u2 = new User({ email: null });
                    u2.isValid(function(valid) {
                        valid.should.be.true;
                        done();
                    });
                });
            })).should.be.false;
        });

        it('should handle same object modification', function(done) {
            User.validatesUniquenessOf('email');
            const u = new User({ email: 'hey' });
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

        it('should allow null', function(done) {
            User.validatesFormatOf('email', { allowNull: true });
            const u = new User(getValidAttributes());
            u.email = null;
            u.isValid(function(valid) {
                should.exist(valid);
                valid.should.be.true();
                done();
            });
        });

        it('should validate format', function(done) {
            User.validatesFormatOf('email', { with: /^.*?@.*$/ });
            const u = new User(getValidAttributes());
            u.email = 'haha';
            u.isValid(function(valid) {
                should.exist(valid);
                valid.should.be.false();
                u.errors.email[0].should.equal('is invalid');
                u.email = 'haha@haha';
                u.isValid(function(valid) {
                    should.exist(valid);
                    valid.should.be.true;
                    should.not.exist(u.errors);
                    done();
                });
            });
        });

        it('should overwrite default blank message with custom format message');
    });

    describe('numericality', function() {

        it('should allow null', function(done) {
            User.validatesNumericalityOf('age', { allowNull: true });
            const u = new User(getValidAttributes());
            u.age = null;
            u.isValid(function(valid) {
                should.exist(valid);
                valid.should.be.true();
                done();
            });
        });

        it('should validate numericality', function(done) {
            User.validatesNumericalityOf('age');
            const u = new User(getValidAttributes());
            u.isValid(function(valid) {
                should.exist(valid);
                valid.should.be.true();
                u.age = 'nineteen';
                u.isValid(function(valid) {
                    should.exist(valid);
                    valid.should.be.false();
                    u.errors.age[0].should.equal('is not a number');
                    done();
                });
            });
        });

        it('should check whether number is integer', function(done) {
            User.validatesNumericalityOf('age', { int: true });
            const u = new User(getValidAttributes());
            u.age = 1.1;
            u.isValid(function(valid) {
                should.exist(valid);
                valid.should.be.false();
                u.errors.age[0].should.equal('is not an integer');
                done();
            });
        });

    });

    describe('inclusion', function() {

        it('should allow null', function(done) {
            User.validatesInclusionOf('gender', {
                in: ['male', 'female'],
                allowNull: true
            });
            const u = new User(getValidAttributes());
            u.gender = null;
            u.isValid(function(valid) {
                should.exist(valid);
                valid.should.be.true();
                done();
            });
        });

        it('should validate inclusion', function(done) {
            User.validatesInclusionOf('gender', {
                in: ['male', 'female']
            });
            const u = new User(getValidAttributes());
            u.gender = 'emale';
            u.isValid(function(valid) {
                should.exist(valid);
                valid.should.be.false();
                u.errors.gender[0].should.equal('is not included in the list');
                u.gender = 'male';
                u.isValid(function(valid) {
                    should.exist(valid);
                    valid.should.be.true();
                    should.not.exist(u.errors);
                    done();
                });
            });
        });

    });

    describe('exclusion', function() {

        it('should allow null', function(done) {
            User.validatesExclusionOf('gender', {
                in: ['notmale'],
                allowNull: true
            });
            const u = new User(getValidAttributes());
            u.gender = null;
            u.isValid(function(valid) {
                should.exist(valid);
                valid.should.be.true();
                done();
            });
        });

        it('should validate exclusion', function(done) {
            User.validatesExclusionOf('name', {
                in: ['admin']
            });
            const u = new User(getValidAttributes());
            u.name = 'admin';
            u.isValid(function(valid) {
                should.exist(valid);
                valid.should.be.false();
                u.errors.name[0].should.equal('is reserved');
                u.name = 'Anatoliy';
                u.isValid(function(valid) {
                    should.exist(valid);
                    valid.should.be.true();
                    should.not.exist(u.errors);
                    done();
                });
            });
        });
    });

    describe('length', function() {

        it('should allow null', function(done) {
            User.validatesLengthOf('gender', { max: 8, allowNull: true });
            const u = new User(getValidAttributes());
            u.gender = null;
            u.isValid(function(valid) {
                should.exist(valid);
                valid.should.be.true();
                done();
            });
        });

        it('should validate max length', function(done) {
            User.validatesLengthOf('gender', { max: 6 });
            const u = new User(getValidAttributes());
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
            User.validatesLengthOf('bio', { min: 3 });
            const u = new User({ bio: 'ha' });
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
            User.validatesLengthOf('countryCode', { is: 2 });
            const u = new User(getValidAttributes());
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
