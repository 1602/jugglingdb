var j = require('../'),
    should = require('should'),
    Schema = j.Schema,
    AbstractClass = j.AbstractClass,
    Hookable = j.Hookable,

    db, User;

describe('hooks', function() {

    before(function(done) {
        db = getSchema();

        User = db.define('User', {
            email: {type: String, index: true},
            name: String,
            password: String,
            state: String
        });

        db.automigrate(done);
    });

    describe('initialize', function() {

        afterEach(function() {
            User.afterInitialize = null;
        });

        it('should be triggered on new', function(done) {
            User.afterInitialize = function() {
                done();
            };
            new User;
        });

        it('should be triggered on create', function(done) {
            var user;
            User.afterInitialize = function() {
                if (this.name === 'Nickolay') {
                    this.name += ' Rozental';
                }
            };
            User.create({name: 'Nickolay'}, function(err, u) {
                u.id.should.be.ok;
                u.name.should.equal('Nickolay Rozental');
                done();
            });
        });

    });

    describe('create', function() {

        afterEach(removeHooks('Create'));

        it('should be triggered on create', function(done) {
            addHooks('Create', done);
            User.create();
        });

        it('should not be triggered on new', function() {
            User.beforeCreate = function(next) {
                should.fail('This should not be called');
                next();
            };
            var u = new User;
        });

        it('should be triggered on new+save', function(done) {
            addHooks('Create', done);
            (new User).save();
        });

    });

    describe('save', function() {
        afterEach(removeHooks('Save'));

        it('should be triggered on create', function(done) {
            addHooks('Save', done);
            User.create();
        });

        it('should be triggered on new+save', function(done) {
            addHooks('Save', done);
            (new User).save();
        });

        it('should be triggered on updateAttributes', function(done) {
            User.create(function(err, user) {
                addHooks('Save', done);
                user.updateAttributes({name: 'Anatoliy'});
            });
        });

        it('should be triggered on save', function(done) {
            User.create(function(err, user) {
                addHooks('Save', done);
                user.name = 'Hamburger';
                user.save();
            });
        });

        it('should save full object', function(done) {
            User.create(function(err, user) {
                User.beforeSave = function(next, data) {
                    data.should.have.keys('id', 'name', 'email',
                        'password', 'state')
                    done();
                };
                user.save();
            });
        });

        it('should save actual modifications to database', function(done) {
            User.beforeSave = function(next, data) {
                data.password = 'hash';
                next();
            };
            User.destroyAll(function() {
                User.create({
                    email: 'james.bond@example.com',
                    password: 'secret'
                }, function() {
                    User.findOne({
                        where: {email: 'james.bond@example.com'}
                    }, function(err, jb) {
                        jb.password.should.equal('hash');
                        done();
                    });
                });
            });
        });

        it('should save actual modifications on updateAttributes', function(done) {
            User.beforeSave = function(next, data) {
                data.password = 'hash';
                next();
            };
            User.destroyAll(function() {
                User.create({
                    email: 'james.bond@example.com'
                }, function(err, u) {
                    u.updateAttribute('password', 'new password', function(e, u) {
                        should.not.exist(e);
                        should.exist(u);
                        u.password.should.equal('hash');
                        User.findOne({
                            where: {email: 'james.bond@example.com'}
                        }, function(err, jb) {
                            jb.password.should.equal('hash');
                            done();
                        });
                    });
                });
            });
        });

    });

    describe('update', function() {
        afterEach(removeHooks('Update'));

        it('should not be triggered on create', function() {
            User.beforeUpdate = function(next) {
                should.fail('This should not be called');
                next();
            };
            User.create();
        });

        it('should not be triggered on new+save', function() {
            User.beforeUpdate = function(next) {
                should.fail('This should not be called');
                next();
            };
            (new User).save();
        });

        it('should be triggered on updateAttributes', function(done) {
            User.create(function (err, user) {
                addHooks('Update', done);
                user.updateAttributes({name: 'Anatoliy'});
            });
        });

        it('should be triggered on save', function(done) {
            User.create(function (err, user) {
                addHooks('Update', done);
                user.name = 'Hamburger';
                user.save();
            });
        });

        it('should update limited set of fields', function(done) {
            User.create(function (err, user) {
                User.beforeUpdate = function(next, data) {
                    data.should.have.keys('name', 'email');
                    done();
                };
                user.updateAttributes({name: 1, email: 2});
            });
        });
    });

    describe('destroy', function() {
        afterEach(removeHooks('Destroy'));

        it('should be triggered on destroy', function(done) {
            var hook = 'not called';
            User.beforeDestroy = function(next) {
                hook = 'called';
                next();
            };
            User.afterDestroy = function() {
                hook.should.eql('called');
                done();
            };
            User.create(function (err, user) {
                user.destroy();
            });
        });
    });

    describe('lifecycle', function() {
        var life = [], user;
        before(function(done) {
            User.beforeSave     = function(d){life.push('beforeSave');   d();};
            User.beforeCreate   = function(d){life.push('beforeCreate'); d();};
            User.beforeUpdate   = function(d){life.push('beforeUpdate'); d();};
            User.beforeDestroy  = function(d){life.push('beforeDestroy');d();};
            User.beforeValidate = function(d){life.push('beforeValidate');d();};
            User.afterInitialize= function( ){life.push('afterInitialize');  };
            User.afterSave      = function(d){life.push('afterSave');    d();};
            User.afterCreate    = function(d){life.push('afterCreate');  d();};
            User.afterUpdate    = function(d){life.push('afterUpdate');  d();};
            User.afterDestroy   = function(d){life.push('afterDestroy'); d();};
            User.afterValidate  = function(d){life.push('afterValidate');d();};
            User.create(function(e, u) {
                user = u;
                life = [];
                done();
            });
        });
        beforeEach(function() {
            life = [];
        });

        it('should describe create sequence', function(done) {
            User.create(function() {
                life.should.eql([
                    'afterInitialize',
                    'beforeValidate',
                    'afterValidate',
                    'beforeCreate',
                    'beforeSave',
                    'afterInitialize',
                    'afterSave',
                    'afterCreate'
                ]);
                done();
            });
        });

        it('should describe new+save sequence', function(done) {
            var u = new User;
            u.save(function() {
                life.should.eql([
                    'afterInitialize',
                    'beforeValidate',
                    'afterValidate',
                    'beforeCreate',
                    'beforeSave',
                    'afterInitialize',
                    'afterSave',
                    'afterCreate'
                ]);
                done();
            });
        });

        it('should describe updateAttributes sequence', function(done) {
            user.updateAttributes({name: 'Antony'}, function() {
                life.should.eql([
                    'beforeValidate',
                    'afterValidate',
                    'beforeSave',
                    'beforeUpdate',
                    'afterUpdate',
                    'afterSave',
                ]);
                done();
            });
        });

        it('should describe isValid sequence', function(done) {
            should.not.exist(
                user.constructor._validations,
                'Expected user to have no validations, but she have');
            user.isValid(function(valid) {
                valid.should.be.true;
                life.should.eql([
                    'beforeValidate',
                    'afterValidate'
                ]);
                done();
            });
        });

        it('should describe destroy sequence', function(done) {
            user.destroy(function() {
                life.should.eql([
                    'beforeDestroy',
                    'afterDestroy'
                ]);
                done();
            });
        });

    });
});

function addHooks(name, done) {
    var called = false, random = Math.floor(Math.random() * 1000);
    User['before' + name] = function(next, data) {
        called = true;
        data.email = random;
        next();
    };
    User['after' + name] = function(next) {
        (new Boolean(called)).should.equal(true);
        this.email.should.equal(random);
        done();
    };
}

function removeHooks(name) {
    return function() {
        User['after' + name] = null;
        User['before' + name] = null;
    };
}
