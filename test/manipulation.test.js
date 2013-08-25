// This test written in mocha+should.js
var should = require('./init.js');

var db, Person;

describe('manipulation', function() {

    before(function(done) {
        db = getSchema();

        Person = db.define('Person', {
            name: String,
            gender: String,
            married: Boolean,
            age: {type: Number, index: true},
            dob: Date,
            createdAt: {type: Number, default: Date.now}
        });

        db.automigrate(done);

    });

    describe('create', function() {

        before(function(done) {
            Person.destroyAll(done);
        });

        it('should create instance', function(done) {
            Person.create({name: 'Anatoliy'}, function(err, p) {
                p.name.should.equal('Anatoliy');
                should.not.exist(err);
                should.exist(p);
                Person.find(p.id, function(err, person) {
                    person.id.should.equal(p.id);
                    person.name.should.equal('Anatoliy');
                    done();
                });
            });
        });

        it('should return instance of object', function(done) {
            var person = Person.create(function(err, p) {
                p.id.should.eql(person.id);
                done();
            });
            should.exist(person);
            person.should.be.an.instanceOf(Person);
            should.not.exist(person.id);
        });

        it('should work when called without callback', function(done) {
            Person.afterCreate = function(next) {
                this.should.be.an.instanceOf(Person);
                this.name.should.equal('Nickolay');
                should.exist(this.id);
                Person.afterCreate = null;
                next();
                setTimeout(done, 10);
            };
            Person.create({name: 'Nickolay'});
        });

        it('should create instance with blank data', function(done) {
            Person.create(function(err, p) {
                should.not.exist(err);
                should.exist(p);
                should.not.exists(p.name);
                Person.find(p.id, function(err, person) {
                    person.id.should.equal(p.id);
                    should.not.exists(person.name);
                    done();
                });
            });
        });

        it('should work when called with no data and callback', function(done) {
            Person.afterCreate = function(next) {
                this.should.be.an.instanceOf(Person);
                should.not.exist(this.name);
                should.exist(this.id);
                Person.afterCreate = null;
                next();
                setTimeout(done, 30);
            };
            Person.create();
        });

        it('should create batch of objects', function(done) {
            var batch = [{name: 'Shaltay'}, {name: 'Boltay'}, {}];
            Person.create(batch, function(e, ps) {
                should.not.exist(e);
                should.exist(ps);
                ps.should.be.instanceOf(Array);
                ps.should.have.lengthOf(batch.length);

                Person.validatesPresenceOf('name');
                Person.create(batch, function(errors, persons) {
                    delete Person._validations;
                    should.exist(errors);
                    errors.should.have.lengthOf(batch.length);
                    should.not.exist(errors[0]);
                    should.not.exist(errors[1]);
                    should.exist(errors[2]);

                    should.exist(persons);
                    persons.should.have.lengthOf(batch.length);
                    persons[0].errors.should.be.false;
                    done();
                }).should.be.instanceOf(Array);
            }).should.have.lengthOf(3);
        });
    });

    describe('save', function() {

        it('should save new object', function(done) {
            var p = new Person;
            p.save(function(err) {
                should.not.exist(err);
                should.exist(p.id);
                done();
            });
        });

        it('should save existing object', function(done) {
            Person.findOne(function(err, p) {
                should.not.exist(err);
                p.name = 'Hans';
                p.propertyChanged('name').should.be.true;
                p.save(function(err) {
                    should.not.exist(err);
                    p.propertyChanged('name').should.be.false;
                    Person.findOne(function(err, p) {
                        should.not.exist(err);
                        p.name.should.equal('Hans');
                        p.propertyChanged('name').should.be.false;
                        done();
                    });
                });
            });
        });

        it('should save invalid object (skipping validation)', function(done) {
            Person.findOne(function(err, p) {
                should.not.exist(err);
                p.isValid = function(done) {
                    process.nextTick(done);
                    return false;
                };
                p.name = 'Nana';
                p.save(function(err) {
                    should.exist(err);
                    p.propertyChanged('name').should.be.true;
                    p.save({validate: false}, function(err) {
                        should.not.exist(err);
                        p.propertyChanged('name').should.be.false;
                        done();
                    });
                });
            });
        });

        it('should save invalid new object (skipping validation)', function (done) {
            var p = new Person();
            p.isNewRecord().should.be.true;

            p.isValid = function(done) {
                if (done) {
                    process.nextTick(done);
                }
                return false;
            };
            p.isValid().should.be.false;
            
            p.save({ validate: false }, function (err) {
                should.not.exist(err);
                p.isNewRecord().should.be.false;
                p.isValid().should.be.false;
                done();
            });
        });

        it('should save throw error on validation', function() {
            Person.findOne(function(err, p) {
                should.not.exist(err);
                p.isValid = function(cb) {
                    cb(false);
                    return false;
                };
                (function() {
                    p.save({
                        'throws': true
                    });
                }).should.throw('Validation error');
            });
        });

    });

    describe('updateAttributes', function() {
        var person;

        before(function(done) {
            Person.destroyAll(function() {
                person = Person.create(done);
            });
        });

        it('should update one attribute', function(done) {
            person.updateAttribute('name', 'Paul Graham', function(err, p) {
                should.not.exist(err);
                Person.all(function(e, ps) {
                    should.not.exist(err);
                    ps.should.have.lengthOf(1);
                    ps.pop().name.should.equal('Paul Graham');
                    done();
                });
            });
        });
    });

    describe('destroy', function() {

        it('should destroy record', function(done) {
            Person.create(function(err, p){ 
                p.destroy(function(err) {
                    should.not.exist(err);
                    Person.exists(p.id, function(err, ex) {
                        ex.should.not.be.ok;
                        done();
                    });
                });
            });
        });

        it('should destroy all records', function (done) {
            Person.destroyAll(function (err) {
                should.not.exist(err);
                Person.all(function (err, posts) {
                    posts.should.have.lengthOf(0);
                    Person.count(function (err, count) {
                        count.should.eql(0);
                        done();
                    });
                });
            });
        });

        // TODO: implement destroy with filtered set
        it('should destroy filtered set of records');
    });

    describe('iterate', function() {

        before(function(next) {
            var ps = [];
            for (var i = 0; i < 507; i += 1) {
                ps.push({name: 'Person ' + i});
            }
            Person.create(ps, next);
        });

        it('should iterate through the batch of objects', function(done) {
            var num = 0;
            Person.iterate({batchSize: 100}, function(person, next, i) {
                num += 1;
                next();
            }, function(err) {
                num.should.equal(507);
                done();
            });
        });
    });

    describe('initialize', function() {
        it('should initialize object properly', function() {
            var hw = 'Hello word',
                now = Date.now(),
                person = new Person({name: hw});

            person.name.should.equal(hw);
            person.propertyChanged('name').should.be.false;
            person.name = 'Goodbye, Lenin';
            person.name_was.should.equal(hw);
            person.propertyChanged('name').should.be.true;
            (person.createdAt >= now).should.be.true;
            person.isNewRecord().should.be.true;
        });

        it('should work when constructor called as function', function() {
            var p = Person({name: 'John Resig'});
            p.should.be.an.instanceOf(Person);
            p.name.should.equal('John Resig');
        });
    });
});
