// This test written in mocha+should.js
const should = require('./init.js');

let db, User, Post, Passport, City, Street, Building, Asset;
const nbSchemaRequests = 0;

let createdUsers = [];

describe('include', function() {

    before(setup);

    it('should fetch belongsTo relation', function(done) {
        Passport.all({ include: 'owner' }, function(err, passports) {
            passports.length.should.be.ok;
            passports.forEach(function(p) {
                p.__cachedRelations.should.have.property('owner');
                const owner = p.__cachedRelations.owner;
                if (!p.ownerId) {
                    should.not.exist(owner);
                } else {
                    should.exist(owner);
                    owner.id.should.equal(p.ownerId);
                }
            });
            done();
        });
    });

    it('should fetch hasMany relation', function(done) {
        User.all({ include: 'posts' }, function(err, users) {
            should.not.exist(err);
            should.exist(users);
            users.length.should.be.ok;
            users.forEach(function(u) {
                u.__cachedRelations.should.have.property('posts');
                u.__cachedRelations.posts.forEach(function(p) {
                    p.userId.should.equal(u.id);
                });
            });
            done();
        });
    });

    it('should fetch hasAndBelongsToMany relation', function(done) {
        User.all({ include: ['assets'] }, function(err, users) {
            should.not.exist(err);
            should.exist(users);
            users.length.should.be.ok;
            users.forEach(function(user) {
                user.__cachedRelations.should.have.property('assets');
                if (user.id === createdUsers[0].id) {
                    user.__cachedRelations.assets.should.have.length(3);
                }
                if (user.id === createdUsers[1].id) {
                    user.__cachedRelations.assets.should.have.length(1);
                }
                user.__cachedRelations.assets.forEach(function(a) {
                    a.url.should.startWith('http://placekitten.com');
                });
            });
            done();
        });
    });

    it('should fetch Passport - Owner - Posts', function(done) {
        Passport.all({ include: { owner: 'posts' } }, function(err, passports) {
            should.not.exist(err);
            should.exist(passports);
            passports.length.should.be.ok;
            passports.forEach(function(p) {
                p.__cachedRelations.should.have.property('owner');
                const user = p.__cachedRelations.owner;
                if (!p.ownerId) {
                    should.not.exist(user);
                } else {
                    should.exist(user);
                    user.id.should.equal(p.ownerId);
                    user.__cachedRelations.should.have.property('posts');
                    user.__cachedRelations.posts.forEach(function(pp) {
                        pp.userId.should.equal(user.id);
                    });
                }
            });
            done();
        });
    });

    it('should fetch Passports - User - Posts - User', function(done) {
        Passport.all({
            include: { owner: { posts: 'author' } }
        }, function(err, passports) {
            should.not.exist(err);
            should.exist(passports);
            passports.length.should.be.ok;
            passports.forEach(function(p) {
                p.__cachedRelations.should.have.property('owner');
                const user = p.__cachedRelations.owner;
                if (!p.ownerId) {
                    should.not.exist(user);
                } else {
                    should.exist(user);
                    user.id.should.equal(p.ownerId);
                    user.__cachedRelations.should.have.property('posts');
                    user.__cachedRelations.posts.forEach(function(pp) {
                        pp.userId.should.equal(user.id);
                        pp.__cachedRelations.should.have.property('author');
                        const author = pp.__cachedRelations.author;
                        author.id.should.equal(user.id);
                    });
                }
            });
            done();
        });
    });

    it('should fetch User - Posts AND Passports', function(done) {
        User.all({ include: ['posts', 'passports'] }, function(err, users) {
            should.not.exist(err);
            should.exist(users);
            users.length.should.be.ok;
            users.forEach(function(user) {
                user.__cachedRelations.should.have.property('posts');
                user.__cachedRelations.should.have.property('passports');
                user.__cachedRelations.posts.forEach(function(p) {
                    p.userId.should.equal(user.id);
                });
                user.__cachedRelations.passports.forEach(function(pp) {
                    pp.ownerId.should.equal(user.id);
                });
            });
            done();
        });
    });
});

function setup(done) {
    db = getSchema();
    City = db.define('City');
    Street = db.define('Street');
    Building = db.define('Building');
    User = db.define('User', {
        name: String,
        age: Number
    });
    Passport = db.define('Passport', {
        number: String
    });
    Post = db.define('Post', {
        title: String
    });
    Asset = db.define('Asset', {
        url: String
    });

    Passport.belongsTo('owner', { model: User });
    User.hasMany('passports', { foreignKey: 'ownerId' });
    User.hasMany('posts', { foreignKey: 'userId' });
    Post.belongsTo('author', { model: User, foreignKey: 'userId' });
    User.hasAndBelongsToMany('assets');

    db.automigrate(function() {
        let createdPassports = [];
        let createdPosts = [];
        let createdAssets = [];
        createUsers();
        function createUsers() {
            clearAndCreate(
                User,
                [
                    { name: 'User A', age: 21 },
                    { name: 'User B', age: 22 },
                    { name: 'User C', age: 23 },
                    { name: 'User D', age: 24 },
                    { name: 'User E', age: 25 }
                ],
                function(items) {
                    createdUsers = items;
                    createPassports();
                }
            );
        }

        function createPassports() {
            clearAndCreate(
                Passport,
                [
                    { number: '1', ownerId: createdUsers[0].id },
                    { number: '2', ownerId: createdUsers[1].id },
                    { number: '3' }
                ],
                function(items) {
                    createdPassports = items;
                    createPosts();
                }
            );
        }

        function createPosts() {
            clearAndCreate(
                Post,
                [
                    { title: 'Post A', userId: createdUsers[0].id },
                    { title: 'Post B', userId: createdUsers[0].id },
                    { title: 'Post C', userId: createdUsers[0].id },
                    { title: 'Post D', userId: createdUsers[1].id },
                    { title: 'Post E' }
                ],
                function(items) {
                    createdPosts = items;
                    createAssets();
                }
            );
        }

        function createAssets() {
            clearAndCreateScoped(
                'assets',
                [
                    { url: 'http://placekitten.com/200/200' },
                    { url: 'http://placekitten.com/300/300' },
                    { url: 'http://placekitten.com/400/400' },
                    { url: 'http://placekitten.com/500/500' }
                ],
                [
                    createdUsers[0],
                    createdUsers[0],
                    createdUsers[0],
                    createdUsers[1]
                ],
                function(items) {
                    createdAssets = items;
                    done();
                }
            );
        }

    });
}

function clearAndCreate(model, data, callback) {
    const createdItems = [];

    model.destroyAll(function() {
        nextItem(null, null);
    });

    let itemIndex = 0;
    function nextItem(err, lastItem) {
        if (lastItem !== null) {
            createdItems.push(lastItem);
        }
        if (itemIndex >= data.length) {
            callback(createdItems);
            return;
        }
        model.create(data[itemIndex], nextItem);
        itemIndex++;
    }
}

function clearAndCreateScoped(modelName, data, scope, callback) {
    const createdItems = [];

    let clearedItemIndex = 0;
    if (scope && scope.length) {

        scope.forEach(function(instance) {
            instance[modelName].destroyAll(function(err) {
                clearedItemIndex++;
                if (clearedItemIndex >= scope.length) {
                    createItems();
                }
            });
        });

    } else {

        callback(createdItems);
    }

    let itemIndex = 0;
    function nextItem(err, lastItem) {
        itemIndex++;

        if (lastItem !== null) {
            createdItems.push(lastItem);
        }
        if (itemIndex >= data.length) {
            callback(createdItems);
            return;
        }
    }

    function createItems() {
        scope.forEach(function(instance, instanceIndex) {
            instance[modelName].create(data[instanceIndex], nextItem);
        });
    }
}
