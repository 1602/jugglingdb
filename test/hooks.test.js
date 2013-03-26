var j = require('../'),
    should = require('should'),
    Schema = j.Schema,
    AbstractClass = j.AbstractClass,
    Hookable = j.Hookable,

    db, User;

describe('hooks', function() {

    before(function() {
        db = getSchema();

        User = db.define('User', {
            email: String,
            name: String,
            password: String,
            state: String
        });
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
                u.id.should.be.a('number');
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
                    data.toObject().should.have.keys('id', 'name', 'email',
                        'password', 'state')
                    done();
                };
                user.save();
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

        it('should be triggered on destroy', function() {
            var hook = 'not called';
            User.beforeDestroy = function() {
                hook = 'called';
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
