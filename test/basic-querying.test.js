// This test written in mocha+should.js
const should = require('./init.js');
const expect = require('expect');
let db, User;

/* global getSchema */
/* eslint max-nested-callbacks: [2, 6] */

describe('basic-querying', function() {

    before(function(done) {
        db = getSchema();

        User = db.define('User', {
            name: { type: String, sort: true, limit: 100 },
            email: { type: String, index: true, limit: 100 },
            role: { type: String, index: true, limit: 100 },
            order: { type: Number, index: true, sort: true, limit: 100 }
        });

        db.automigrate(done);

    });


    describe('find', function() {

        before(function(done) {
            User.destroyAll(done);
        });

        it('should query by id: not found', function(done) {
            User.find(1, function(err, u) {
                should.not.exist(u);
                should.not.exist(err);
                done();
            });
        });

        it('should query by id: found', function(done) {
            User.create(function(err, u) {
                should.not.exist(err);
                should.exist(u.id);
                User.find(u.id, function(err, u) {
                    should.exist(u);
                    should.not.exist(err);
                    u.should.be.an.instanceOf(User);
                    done();
                });
            });
        });

    });

    describe('all', function() {

        before(seed);

        it('should query collection', function(done) {
            User.all(function(err, users) {
                should.exists(users);
                should.not.exists(err);
                users.should.have.lengthOf(6);
                done();
            });
        });

        it('should query limited collection', function(done) {
            User.all({ limit: 3 }, function(err, users) {
                should.exists(users);
                should.not.exists(err);
                users.should.have.lengthOf(3);
                done();
            });
        });

        it('should query offset collection with limit', function(done) {
            User.all({ skip: 1, limit: 4 }, function(err, users) {
                should.exists(users);
                should.not.exists(err);
                users.should.have.lengthOf(4);
                done();
            });
        });

        it('should query filtered collection', function(done) {
            User.all({ where: { role: 'lead' } }, function(err, users) {
                should.exists(users);
                should.not.exists(err);
                users.should.have.lengthOf(2);
                done();
            });
        });

        it('should query collection sorted by numeric field', function(done) {
            User.all({ order: 'order' }, function(err, users) {
                should.exists(users);
                should.not.exists(err);
                users.forEach(function(u, i) {
                    u.order.should.eql(i + 1);
                });
                done();
            });
        });

        it('should query collection desc sorted by numeric field', function(done) {
            User.all({ order: 'order DESC' }, function(err, users) {
                should.exists(users);
                should.not.exists(err);
                users.forEach(function(u, i) {
                    u.order.should.eql(users.length - i);
                });
                done();
            });
        });

        it('should query collection sorted by string field', function(done) {
            User.all({ order: 'name' }, function(err, users) {
                should.exists(users);
                should.not.exists(err);
                users.shift().name.should.equal('George Harrison');
                users.shift().name.should.equal('John Lennon');
                users.pop().name.should.equal('Stuart Sutcliffe');
                done();
            });
        });

        it('should query collection desc sorted by string field', function(done) {
            User.all({ order: 'name DESC' }, function(err, users) {
                should.exists(users);
                should.not.exists(err);
                users.pop().name.should.equal('George Harrison');
                users.pop().name.should.equal('John Lennon');
                users.shift().name.should.equal('Stuart Sutcliffe');
                done();
            });
        });
    });

    describe('#all.attributes', function() {

        it('should query collection and return given attribute as  an array of Objects', function(done) {
            User.all({ attributes: ['id'] }, function(err, users) {
                should.exists(users);
                should.not.exists(err);
                users.should.be.instanceOf(Array);
                users.pop().should.be.instanceOf(Object).and.have.property('id');
                done();
            });
        });

        it('should query collection and return given attribute as an array of Numbers', function(done) {
            User.all({ attributes: 'id' }, function(err, users) {
                should.exists(users);
                should.not.exists(err);
                users.should.be.instanceOf(Array);
                users.pop().should.be.a.Number;
                done();
            });
        });

        it('should query collection and return given attributes as an array of objects', function(done) {
            User.all({ attributes: ['id', 'name'] }, function(err, users) {
                should.exists(users);
                should.not.exists(err);
                should.not.exists(users.pop().mail);
                should.not.exists(users.pop().order);
                users.pop().should.be.instanceOf(Object).and.have.property('id');
                users.pop().should.be.instanceOf(Object).and.have.property('name');
                done();
            });
        });
    });

    describe('count', function() {

        before(seed);

        it('should query total count', function(done) {
            User.count(function(err, n) {
                should.not.exist(err);
                should.exist(n);
                n.should.equal(6);
                done();
            });
        });

        it('should query filtered count', function(done) {
            User.count({ role: 'lead' }, function(err, n) {
                should.not.exist(err);
                should.exist(n);
                n.should.equal(2);
                done();
            });
        });
    });

    describe('findOne', function() {

        before(seed);

        it('should find first record (default sort by id)', function(done) {
            User.all({ order: 'id' }, function(err, users) {
                User.findOne(function(e, u) {
                    should.not.exist(e);
                    should.exist(u);
                    u.id.toString().should.equal(users[0].id.toString());
                    done();
                });
            });
        });

        it('should find first record', function(done) {
            User.findOne({ order: 'order' }, function(e, u) {
                should.not.exist(e);
                should.exist(u);
                u.order.should.equal(1);
                u.name.should.equal('Paul McCartney');
                done();
            });
        });

        it('should find last record', function(done) {
            User.findOne({ order: 'order DESC' }, function(e, u) {
                should.not.exist(e);
                should.exist(u);
                u.order.should.equal(6);
                u.name.should.equal('Ringo Starr');
                done();
            });
        });

        it('should find last record in filtered set', function(done) {
            User.findOne({
                where: { role: 'lead' },
                order: 'order DESC'
            }, function(e, u) {
                should.not.exist(e);
                should.exist(u);
                u.order.should.equal(2);
                u.name.should.equal('John Lennon');
                done();
            });
        });

        it('should work even when find by id', function(done) {
            User.findOne(function(e, u) {
                User.findOne({ where: { id: u.id } }, function(err, user) {
                    should.not.exist(err);
                    should.exist(user);
                    done();
                });
            });
        });

    });

    describe('exists', function() {

        before(seed);

        it('should check whether record exist', function(done) {
            User.findOne(function(e, u) {
                User.exists(u.id, function(err, exists) {
                    should.not.exist(err);
                    should.exist(exists);
                    exists.should.be.ok;
                    done();
                });
            });
        });

        it('should check whether record not exist', function(done) {
            User.destroyAll(function() {
                User.exists(42, function(err, exists) {
                    should.not.exist(err);
                    exists.should.not.be.ok;
                    done();
                });
            });
        });

    });

    describe('updateOrCreate', function() {

        it('should update existing record', function() {
            let id;
            return User.create({
                name: 'anatoliy',
                email: 'mail@example.co.uk',
                order: 1602
            })
                .then(function(ud) {
                    id = ud.id;
                    return User.updateOrCreate({
                        id,
                        name: 'Anatoliy'
                    });
                })
                .then(function(ud) {
                    should.exist(ud);
                    ud.id.should.equal(id);
                    ud.name.should.equal('Anatoliy');
                    should.exist(ud.email);
                    ud.email.should.equal('mail@example.co.uk');
                    should.exist(ud.order);
                    ud.order.should.equal(1602);
                });
        });

        it('should create when record does not exist', function() {
            return User.updateOrCreate({
                id: 100000,
                name: 'Anatoliy'
            });
        });

    });

    describe('bulkUpdate', function() {

        let Model;

        before(function() {
            Model = db.define('Model', {
                foo: String,
                bar: Number
            });

            return db.automigrate();
        });

        afterEach(function() { return Model.destroyAll(); });

        context('single update', function() {

            it('should throw when no sufficient params provided', function() {
                return Model.bulkUpdate({ where: { foo: 1 } })
                    .then(function() { throw new Error('Unexpected success'); })
                    .catch(function(err) { expect(err.message).toBe('Required update'); });
            });

            it('should throw when no sufficient params provided', function() {
                return Model.bulkUpdate({ update: { foo: 1 } })
                    .then(function() { throw new Error('Unexpected success'); })
                    .catch(function(err) { expect(err.message).toBe('Required where'); });
            });

            it('should update record in database', function() {
                return Model.create([
                    { foo: 'baz', bar: 1 },
                    { foo: 'fuu', bar: 1 }
                ])
                    .then(function() {
                        return Model.bulkUpdate({
                            update: { bar: 2 },
                            where: { foo: 'fuu' }
                        });
                    })
                    .then(function() {
                        return Model.all({ where: { foo: 'fuu' } });
                    })
                    .then(function(records) {
                        expect(records.length).toBe(1);
                        expect(records[0].bar).toBe(2);
                    })
                    .then(function() {
                        return Model.all({ where: { foo: 'baz' } });
                    })
                    .then(function(records) {
                        expect(records.length).toBe(1);
                        expect(records[0].bar).toBe(1);
                    });
            });

            it('should allow to limit update', function() {
                return Model.create([
                    { foo: 'bar', bar: 1 },
                    { foo: 'bar', bar: 1 }
                ])
                    .then(function() {
                        return Model.bulkUpdate({
                            update: { bar: 2 },
                            where: { foo: 'bar' },
                            limit: 1
                        });
                    })
                    .then(function() { return Model.count({ bar: 2 }); })
                    .then(function(count) {
                        expect(count).toBe(1);
                    })
                    .then(function() { return Model.count({ bar: 1 }); })
                    .then(function(count) {
                        expect(count).toBe(1);
                    });
            });

        });

        context('multiple records', function() {

            it('should throw when no sufficient params provided', function() {
                return Model.bulkUpdate([{ where: { foo: 1 } }])
                    .then(function() { throw new Error('Unexpected success'); })
                    .catch(function(err) { expect(err.message).toBe('Required update'); });
            });

            it('should throw when no sufficient params provided', function() {
                return Model.bulkUpdate([{ update: { foo: 1 } }])
                    .then(function() { throw new Error('Unexpected success'); })
                    .catch(function(err) { expect(err.message).toBe('Required where'); });
            });

            it('should return array of results', function() {
                return Model.create([
                    { foo: 'bar', bar: 1 },
                    { foo: 'bar', bar: 2 }
                ])
                    .then(function() {
                        return Model.bulkUpdate([
                            { update: { foo: 1 }, where: { bar: 1 } },
                            { update: { foo: 2 }, where: { bar: 2 } }
                        ]);
                    })
                    .then(function(res) {
                        expect(res instanceof Array).toBeTruthy();
                    });
            });

        });
    });

    describe('update', function() {

        let Model;

        before(function() {
            Model = db.define('Model', {
                foo: String,
                bar: Number
            });

            return db.automigrate();
        });

        afterEach(function() { return Model.destroyAll(); });

        it('should update record by id', function() {
            let id;
            return Model.create({
                foo: 'bar',
                bar: 1
            })
                .then(function(inst) {
                    id = inst.id;
                    return Model.update(inst.id, { foo: 'baz' });
                })
                .then(function() {
                    return Model.find(id);
                })
                .then(function(inst) {
                    expect(inst.foo).toBe('baz');
                });
        });

    });

});

function seed(done) {
    let count = 0;
    const beatles = [
        {
            name: 'John Lennon',
            mail: 'john@b3atl3s.co.uk',
            role: 'lead',
            order: 2
        }, {
            name: 'Paul McCartney',
            mail: 'paul@b3atl3s.co.uk',
            role: 'lead',
            order: 1
        },
        { name: 'George Harrison', order: 5 },
        { name: 'Ringo Starr', order: 6 },
        { name: 'Pete Best', order: 4 },
        { name: 'Stuart Sutcliffe', order: 3 }
    ];
    User.destroyAll(function() {
        beatles.forEach(function(beatle) {
            User.create(beatle, ok);
        });
    });

    function ok() {
        if (++count === beatles.length) {
            done();
        }
    }
}
