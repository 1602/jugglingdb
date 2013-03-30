var db, Person, should = require('should');

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
                setTimeout(done, 10);
            };
            Person.create();
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
