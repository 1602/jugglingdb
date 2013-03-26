var db, User, should = require('should');

describe('basic-querying', function() {

    before(function() {
        db = getSchema();

        User = db.define('User', {
            name: String,
            email: {type: String, index: true},
            role: {type: String, index: true},
            order: {type: Number, index: true}
        });

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

        it('should query filtered collection', function(done) {
            User.all({where: {role: 'lead'}}, function(err, users) {
                should.exists(users);
                should.not.exists(err);
                users.should.have.lengthOf(2);
                done();
            });
        });

        it('should query collection sorted by numeric field', function(done) {
            User.all({order: 'order'}, function(err, users) {
                should.exists(users);
                should.not.exists(err);
                users.forEach(function(u, i) {
                    u.order.should.eql(i + 1);
                });
                done();
            });
        });

        it('should query collection desc sorted by numeric field', function(done) {
            User.all({order: 'order DESC'}, function(err, users) {
                should.exists(users);
                should.not.exists(err);
                users.forEach(function(u, i) {
                    u.order.should.eql(users.length - i);
                });
                done();
            });
        });

        it('should query collection sorted by string field', function(done) {
            User.all({order: 'name'}, function(err, users) {
                should.exists(users);
                should.not.exists(err);
                users.shift().name.should.equal('George Harrison');
                users.shift().name.should.equal('John Lennon');
                users.pop().name.should.equal('Stuart Sutcliffe');
                done();
            });
        });

        it('should query collection desc sorted by string field', function(done) {
            User.all({order: 'name DESC'}, function(err, users) {
                should.exists(users);
                should.not.exists(err);
                users.pop().name.should.equal('George Harrison');
                users.pop().name.should.equal('John Lennon');
                users.shift().name.should.equal('Stuart Sutcliffe');
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
            User.count({role: 'lead'}, function(err, n) {
                should.not.exist(err);
                should.exist(n);
                n.should.equal(2);
                done();
            });
        });
    });

    describe('exists', function() {

        before(seed);

        it('should check whether record exist', function(done) {
            User.exists(1, function(err, exists) {
                should.not.exist(err);
                should.exist(exists);
                exists.should.be.true;
                done();
            });
        });

        it('should check whether record not exist', function(done) {
            User.destroyAll(function() {
                User.exists(42, function(err, exists) {
                    should.not.exist(err);
                    exists.should.be.false;
                    done();
                });
            });
        });

    });

});

function seed(done) {
    var count = 0;
    var beatles = [
        {   id: 1,
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
        {name: 'George Harrison', order: 5},
        {name: 'Ringo Starr', order: 6},
        {name: 'Pete Best', order: 4},
        {name: 'Stuart Sutcliffe', order: 3}
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
