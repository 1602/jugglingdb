require('./spec_helper').init(exports);

var Schema = require('../index').Schema;
var Text = Schema.Text;

var schemas = {
    // riak: {},
    mysql: {
        database: 'myapp_test',
        username: 'root'
    },
    postgres:  {
        database: 'myapp_test',
        username: 'postgres'
    },
    sqlite3:   {
        database: ':memory:'
    },
    neo4j:     { url: 'http://localhost:7474/' },
    // mongoose:  { url: 'mongodb://travis:test@localhost:27017/myapp' },
    mongodb:   { url: 'mongodb://travis:test@localhost:27017/myapp' },
    redis2:     {},
    memory:    {},
    cradle:    {}
};

var specificTest = getSpecificTests();
var testPerformed = false;
var nbSchemaRequests = 0;

Object.keys(schemas).forEach(function (schemaName) {
    if (process.env.ONLY && process.env.ONLY !== schemaName) return;
    if (process.env.EXCEPT && ~process.env.EXCEPT.indexOf(schemaName)) return;
    performTestFor(schemaName);
});

if (process.env.ONLY && !testPerformed) {
    performTestFor(process.env.ONLY);
}

function performTestFor(schemaName) {
    testPerformed = true;
    context(schemaName, function () {
        var schema = new Schema(schemaName, schemas[schemaName] || {});

        it('should connect to database', function (test) {
            if (schema.connected) return test.done();
            schema.on('connected', test.done);
        });

        schema.log = function (a) {
            console.log(a);
            nbSchemaRequests++;
        };

        testOrm(schema);
        if (specificTest[schemaName]) specificTest[schemaName](schema);
    });
}

function testOrm(schema) {
    var requestsAreCounted = schema.name !== 'mongodb';

    var Post, User, Passport;
    var start = Date.now();

    it('should define class', function (test) {

        User = schema.define('User', {
            name:      { type: String, index: true },
            email:     { type: String, index: true },
            bio:          Text,
            approved:     Boolean,
            joinedAt:     Date,
            age:          Number,
            passwd:    { type: String, index: true },
            settings:  { type: Schema.JSON },
            extra:      Object
        });

        Post = schema.define('Post', {
            title:     { type: String, length: 255, index: true },
            subject:   { type: String },
            content:   { type: Text },
            date:      { type: Date,    default: function () { return new Date }, index: true },
            published: { type: Boolean, default: false },
            likes:     [],
            related:   [RelatedPost]
        }, {table: 'posts'});

        function RelatedPost() { }
        RelatedPost.prototype.someMethod = function () {
            return this.parent;
        };

        Post.validateAsync('title', function (err, done) {
            process.nextTick(done);
        });

        User.hasMany(Post,   {as: 'posts',  foreignKey: 'userId'});
        // creates instance methods:
        // user.posts(conds)
        // user.posts.build(data) // like new Post({userId: user.id});
        // user.posts.create(data) // build and save
        // user.posts.find

        // User.hasOne('latestPost', {model: Post, foreignKey: 'postId'});

        // User.hasOne(Post,    {as: 'latestPost', foreignKey: 'latestPostId'});
        // creates instance methods:
        // user.latestPost()
        // user.latestPost.build(data)
        // user.latestPost.create(data)

        Post.belongsTo(User, {as: 'author', foreignKey: 'userId'});
        // creates instance methods:
        // post.author(callback) -- getter when called with function
        // post.author() -- sync getter when called without params
        // post.author(user) -- setter when called with object

        Passport = schema.define('Passport', {
            number: String
        });

        Passport.belongsTo(User, {as: 'owner', foreignKey: 'ownerId'});

        var user = new User;

        test.ok(User instanceof Function);

        // class methods
        test.ok(User.find instanceof Function);
        test.ok(User.create instanceof Function);

        // instance methods
        test.ok(user.save instanceof Function);

        schema.automigrate(function (err) {
            if (err) {
                console.log('Error while migrating');
                console.log(err);
            } else {
                test.done();
            }
        });

    });

    it('should initialize object properly', function (test) {
        var hw = 'Hello word',
            now = Date.now(),
            post = new Post({title: hw}),
            anotherPost = Post({title: 'Resig style constructor'});

        test.equal(post.title, hw);
        test.ok(!post.propertyChanged('title'), 'property changed: title');
        post.title = 'Goodbye, Lenin';
        test.equal(post.title_was, hw);
        test.ok(post.propertyChanged('title'));
        test.strictEqual(post.published, false);
        test.ok(post.date >= now);
        test.ok(post.isNewRecord());
        test.ok(anotherPost instanceof Post);
        test.ok(anotherPost.title, 'Resig style constructor');
        test.done();
    });

    it('should be expoted to JSON', function (test) {
        test.equal(JSON.stringify(new Post({id: 1, title: 'hello, json', date: 1})),
        '{"title":"hello, json","subject":null,"content":null,"date":1,"published":false,"likes":[],"related":[],"id":1,"userId":null}');
        test.done();
    });

    it('should create object', function (test) {
        Post.create(function (err, post) {
            if (err) throw err;
            test.ok(post.id, 'Id present');
            test.ok(!post.title, 'Title is blank');
            Post.exists(post.id, function (err, exists) {
                if (err) throw err;
                test.ok(exists);
                test.done();
            });
        });
    });

    it('should create object without callback', function (test) {
        var uniqueTitle = 'Unique title ' + Date.now();
        Post.create({title: uniqueTitle});

        setTimeout(delayedCallback, 100);

        function delayedCallback() {
            Post.all({where: {title: uniqueTitle}}, function (err, posts) {
                test.equal(posts.length, 1);
                test.done();
            });
        }
    });

    it('should save object', function (test) {
        var title = 'Initial title', title2 = 'Hello world',
            date = new Date;

        Post.create({
            title: title,
            date: date
        }, function (err, obj) {
            test.ok(obj.id, 'Object id should present');
            test.equals(obj.title, title);
            // test.equals(obj.date, date);
            obj.title = title2;
            test.ok(obj.propertyChanged('title'), 'Title changed');
            obj.save(function (err, obj) {
                test.equal(obj.title, title2);
                test.ok(!obj.propertyChanged('title'));

                var p = new Post({title: 1});
                p.title = 2;
                p.save(function (err, obj) {
                    test.ok(!p.propertyChanged('title'));
                    p.title = 3;
                    test.ok(p.propertyChanged('title'));
                    test.equal(p.title_was, 2);
                    p.save(function () {
                        test.equal(p.title_was, 3);
                        test.ok(!p.propertyChanged('title'));
                        test.done();
                    });
                });
            });
        });
    });

    it('should create object with initial data', function (test) {
        var title = 'Initial title',
            date = new Date;

        Post.create({
            title: title,
            date: date
        }, function (err, obj) {
            test.ok(obj.id);
            test.equals(obj.title, title);
            test.equals(obj.date, date);
            Post.find(obj.id, function () {
                test.equal(obj.title, title);
                test.equal(obj.date.toString(), date.toString());
                test.done();
            });
        });
    });

    it('should save only schema-defined field in database', function (test) {
        Post.create({title: '1602', nonSchemaField: 'some value'}, function (err, post) {
            test.ok(!post.nonSchemaField);
            post.a = 1;
            post.save(function () {
                test.ok(post.a);
                post.reload(function (err, psto) {
                    test.ok(!psto.a);
                    test.done();
                });
            });
        });
    });

    /*
    it('should not create new instances for the same object', function (test) {
        var title = 'Initial title';
        Post.create({ title: title }, function (err, post) {
            test.ok(post.id, 'Object should have id');
            test.equals(post.title, title);
            Post.find(post.id, function (err, foundPost) {
                if (err) throw err;
                test.equal(post.title, title);
                test.strictEqual(post, foundPost);
                test.done();
            });
        });
    });
    */

    it('should not re-instantiate object on saving', function (test) {
        var title = 'Initial title';
        var post = new Post({title: title});
        post.save(function (err, savedPost) {
            test.strictEqual(post, savedPost);
            test.done();
        });
    });

    it('should destroy object', function (test) {
        Post.create(function (err, post) {
            Post.exists(post.id, function (err, exists) {
                test.ok(exists, 'Object exists');
                post.destroy(function () {
                    Post.exists(post.id, function (err, exists) {
                        if (err) console.log(err);
                        test.ok(!exists, 'Hey! ORM told me that object exists, but it looks like it doesn\'t. Something went wrong...');
                        Post.find(post.id, function (err, obj) {
                            test.equal(obj, null, 'Param obj should be null');
                            test.done();
                        });
                    });
                });
            });
        });
    });

    it('should handle virtual attributes', function (test) {
        var salt = 's0m3s3cr3t5a1t';

        User.setter.passwd = function (password) {
            this._passwd = calcHash(password, salt);
        };

        function calcHash(pass, salt) {
            var crypto = require('crypto');
            var hash = crypto.createHash('sha256');
            hash.update(pass);
            hash.update(salt);
            return hash.digest('base64');
        }

        var u = new User;
        u.passwd = 's3cr3t';
        test.equal(u.passwd, calcHash('s3cr3t', salt));
        test.done();
    });

    // it('should serialize JSON type', function (test) {
    //     User.create({settings: {hello: 'world'}}, function (err, user) {
    //         test.ok(user.id);
    //         test.equal(user.settings.hello, 'world');
    //         User.find(user.id, function (err, u) {
    //             console.log(u.settings);
    //             test.equal(u.settings.hello, 'world');
    //             test.done();
    //         });
    //     });
    // });

    it('should update single attribute', function (test) {
        Post.create({title: 'title', content: 'content', published: true}, function (err, post) {
            post.content = 'New content';
            post.updateAttribute('title', 'New title', function () {
                test.equal(post.title, 'New title');
                test.ok(!post.propertyChanged('title'));
                console.log('hahaha', post.content, post.__data.content);
                test.equal(post.content, 'New content', 'dirty state saved');
                test.ok(post.propertyChanged('content'));
                post.reload(function (err, post) {
                    test.equal(post.title, 'New title');
                    test.ok(!post.propertyChanged('title'), 'title not changed');
                    console.log(post.content);
                    test.equal(post.content, 'content', 'real value turned back');
                    test.ok(!post.propertyChanged('content'), 'content unchanged');
                    test.done();
                });
            });
        });
    });

    var countOfposts, countOfpostsFiltered;
    it('should fetch collection', function (test) {
        Post.all(function (err, posts) {
            countOfposts = posts.length;
            test.ok(countOfposts > 0);
            test.ok(posts[0] instanceof Post);
            countOfpostsFiltered = posts.filter(function (p) {
                console.log(p.title);
                return p.title === 'title';
            }).length;
            test.done();
        });
    });

    it('should fetch count of records in collection', function (test) {
        Post.count(function (err, count) {
            console.log(countOfposts, count);
            test.equal(countOfposts, count, 'unfiltered count');
            Post.count({title: 'title'}, function (err, count) {
                console.log(countOfpostsFiltered, count, 'filtered count');
                test.equal(countOfpostsFiltered, count, 'filtered count');
                test.done();
            });
        });
    });

    it('should find filtered set of records', function (test) {
        var wait = 1;

        // exact match with string
        Post.all({where: {title: 'New title'}}, function (err, res) {
            var pass = true;
            res.forEach(function (r) {
                if (r.title != 'New title') pass = false;
            });
            test.ok(res.length > 0, 'Exact match with string returns dataset');
            test.ok(pass, 'Exact match with string');
            done();
        });

        // matching null
        // Post.all({where: {title: null}}, function (err, res) {

        //     var pass = true;
        //     res.forEach(function (r) {
        //         if (r.title != null) pass = false;
        //     });
        //     test.ok(res.length > 0, 'Matching null returns dataset');
        //     test.ok(pass, 'Matching null');
        //     done();
        // });

        function done() {
            if (--wait === 0) {
                test.done();
            }
        }

    });


    it('should find records filtered with multiple attributes', function (test) {
        Post.create({title: 'title', content: 'content', published: true, date: 1}, function (err, post) {
            Post.all({where: {title: 'title', date: 1}}, function (err, res) {
                test.ok(res.length > 0, 'Exact match with string returns dataset');
                test.done();
            });
        });
    });

    it('should handle hasMany relationship', function (test) {
        User.create(function (err, u) {
            if (err) return console.log(err);
            test.ok(u.posts, 'Method defined: posts');
            test.ok(u.posts.build, 'Method defined: posts.build');
            test.ok(u.posts.create, 'Method defined: posts.create');
            u.posts.create(function (err, post) {
                if (err) return console.log(err);
                // test.ok(post.author(), u.id);
                u.posts(function (err, posts) {
                    test.equal(posts.pop().id, post.id);
                    test.done();
                });
            });
        });
    });


    if (
        !schema.name.match(/redis/) &&
            schema.name !== 'memory' &&
            schema.name !== 'neo4j' &&
            schema.name !== 'cradle' &&
            schema.name !== 'mongodb'
        )
    it('hasMany should support additional conditions', function (test) {

        // Finding one post with an existing author associated
        Post.all(function (err, posts) {
            // We try to get the first post with a userId != NULL
            for (var i = 0; i < posts.length; i++) {
                var post = posts[i];
                if (post.userId !== null) {
                    // We could get the user with belongs to relationship but it is better if there is no interactions.
                    User.find(post.userId, function(err, user) {
                        user.posts({where: {id: post.id}}, function(err, posts) {
                            test.equal(posts.length, 1, 'There should be only 1 post.');
                            test.done();
                        });
                    });
                    break;
                }
            }
        });
    });


    if (
        !schema.name.match(/redis/) &&
            schema.name !== 'memory' &&
            schema.name !== 'neo4j' &&
            schema.name !== 'cradle'
        )
    it('hasMany should be cached', function (test) {
        // Finding one post with an existing author associated
        Post.all(function (err, posts) {
            // We try to get the first post with a userId != NULL
            for (var i = 0; i < posts.length; i++) {
                var post = posts[i];
                if (post.userId !== null) {
                    // We could get the user with belongs to relationship but it is better if there is no interactions.
                    User.find(post.userId, function(err, user) {
                        User.create(function(err, voidUser) {
                            Post.create({userId: user.id}, function() {

                                // There can't be any concurrency because we are counting requests
                                // We are first testing cases when user has posts
                                user.posts(function(err, data) {
                                    var nbInitialRequests = nbSchemaRequests;
                                    user.posts(function(err, data2) {
                                        test.equal(data.length, 2, 'There should be 2 posts.');
                                        test.equal(data.length, data2.length, 'Posts should be the same, since we are loading on the same object.');
                                        requestsAreCounted && test.equal(nbInitialRequests, nbSchemaRequests, 'There should not be any request because value is cached.');

                                        if (schema.name === 'mongodb') { // for the moment mongodb doesn\'t support additional conditions on hasMany relations (see above)
                                            test.done();
                                        } else {
                                            user.posts({where: {id: data[0].id}}, function(err, data) {
                                                test.equal(data.length, 1, 'There should be only one post.');
                                                requestsAreCounted && test.equal(nbInitialRequests + 1, nbSchemaRequests, 'There should be one additional request since we added conditions.');

                                                user.posts(function(err, data) {
                                                    test.equal(data.length, 2, 'Previous get shouldn\'t have changed cached value though, since there was additional conditions.');
                                                    requestsAreCounted && test.equal(nbInitialRequests + 1, nbSchemaRequests, 'There should not be any request because value is cached.');

                                                    // We are now testing cases when user doesn't have any post
                                                    voidUser.posts(function(err, data) {
                                                        var nbInitialRequests = nbSchemaRequests;
                                                        voidUser.posts(function(err, data2) {
                                                            test.equal(data.length, 0, 'There shouldn\'t be any posts (1/2).');
                                                            test.equal(data2.length, 0, 'There shouldn\'t be any posts (2/2).');
                                                            requestsAreCounted && test.equal(nbInitialRequests, nbSchemaRequests, 'There should not be any request because value is cached.');

                                                            voidUser.posts(true, function(err, data3) {
                                                                test.equal(data3.length, 0, 'There shouldn\'t be any posts.');
                                                                requestsAreCounted && test.equal(nbInitialRequests + 1, nbSchemaRequests, 'There should be one additional request since we forced refresh.');

                                                                test.done();
                                                            });
                                                        });
                                                    });

                                                });
                                            });
                                        }

                                    });
                                });

                            });
                        });
                    });
                    break;
                }
            }
        });

    });

    // it('should handle hasOne relationship', function (test) {
    //     User.create(function (err, u) {
    //         if (err) return console.log(err);
    //     });
    // });

    it('should support scopes', function (test) {
        var wait = 2;

        test.ok(Post.scope, 'Scope supported');
        Post.scope('published', {where: {published: true}});
        test.ok(typeof Post.published === 'function');
        test.ok(Post.published._scope.where.published === true);
        var post = Post.published.build();
        test.ok(post.published, 'Can build');
        test.ok(post.isNewRecord());
        Post.published.create(function (err, psto) {
            if (err) return console.log(err);
            test.ok(psto.published);
            test.ok(!psto.isNewRecord());
            done();
        });

        User.create(function (err, u) {
            if (err) return console.log(err);
            test.ok(typeof u.posts.published == 'function');
            test.ok(u.posts.published._scope.where.published);
            console.log(u.posts.published._scope);
            test.equal(u.posts.published._scope.where.userId, u.id);
            done();
        });

        function done() {
            if (--wait === 0) test.done();
        };
    });

    it('should destroy all records', function (test) {
        Post.destroyAll(function (err) {
            if (err) {
                console.log('Error in destroyAll');
                console.log(err);
                throw err;
            }
            Post.all(function (err, posts) {
                test.equal(posts.length, 0);
                Post.count(function (err, count) {
                    test.equal(count, 0);
                    test.done();
                });
            });
        });
    });

    it('should return type of property', function (test) {
        test.equal(Post.whatTypeName('title'), 'String');
        test.equal(Post.whatTypeName('content'), 'Text');
        var p = new Post;
        test.equal(p.whatTypeName('title'), 'String');
        test.equal(p.whatTypeName('content'), 'Text');
        test.done();
    });

    it('should handle ORDER clause', function (test) {
        var titles = [ { title: 'Title A', subject: "B" },
                       { title: 'Title Z', subject: "A" },
                       { title: 'Title M', subject: "C" },
                       { title: 'Title A', subject: "A" },
                       { title: 'Title B', subject: "A" },
                       { title: 'Title C', subject: "D" }];
        var isRedis = Post.schema.name === 'redis';
        var dates = isRedis ? [ 5, 9, 0, 17, 10, 9 ] : [
            new Date(1000 * 5 ),
            new Date(1000 * 9),
            new Date(1000 * 0),
            new Date(1000 * 17),
            new Date(1000 * 10),
            new Date(1000 * 9)
        ];
        titles.forEach(function (t, i) {
            Post.create({title: t.title, subject: t.subject, date: dates[i]}, done);
        });

        var i = 0, tests = 0;
        function done(err, obj) {
            if (++i === titles.length) {
                doFilterAndSortTest();
                doFilterAndSortReverseTest();
                doStringTest();
                doNumberTest();

                if (schema.name == 'mongoose') {
                    doMultipleSortTest();
                    doMultipleReverseSortTest();
                }
            }
        }

        function compare(a, b) {
            if (a.title < b.title) return -1;
            if (a.title > b.title) return 1;
            return 0;
        }

        // Post.schema.log = console.log;

        function doStringTest() {
            tests += 1;
            Post.all({order: 'title'}, function (err, posts) {
                if (err) console.log(err);
                test.equal(posts.length, 6);
                titles.sort(compare).forEach(function (t, i) {
                    if (posts[i]) test.equal(posts[i].title, t.title);
                });
                finished();
            });
        }

        function doNumberTest() {
            tests += 1;
            Post.all({order: 'date'}, function (err, posts) {
                if (err) console.log(err);
                test.equal(posts.length, 6);
                dates.sort(numerically).forEach(function (d, i) {
                    if (posts[i])
                    test.equal(posts[i].date.toString(), d.toString(), 'doNumberTest');
                });
                finished();
            });
        }

        function doFilterAndSortTest() {
            tests += 1;
            Post.all({where: {date: new Date(1000 * 9)}, order: 'title', limit: 3}, function (err, posts) {
                if (err) console.log(err);
                console.log(posts.length);
                test.equal(posts.length, 2, 'Exactly 2 posts returned by query');
                [ 'Title C', 'Title Z' ].forEach(function (t, i) {
                    if (posts[i]) {
                        test.equal(posts[i].title, t, 'doFilterAndSortTest');
                    }
                });
                finished();
            });
        }

        function doFilterAndSortReverseTest() {
            tests += 1;
            Post.all({where: {date: new Date(1000 * 9)}, order: 'title DESC', limit: 3}, function (err, posts) {
                if (err) console.log(err);
                test.equal(posts.length, 2, 'Exactly 2 posts returned by query');
                [ 'Title Z', 'Title C' ].forEach(function (t, i) {
                    if (posts[i]) {
                        test.equal(posts[i].title, t, 'doFilterAndSortReverseTest');
                    }
                });
                finished();
            });
        }

        function doMultipleSortTest() {
            tests += 1;
            Post.all({order: "title ASC, subject ASC"}, function(err, posts) {
                if (err) console.log(err);
                test.equal(posts.length, 6);
                test.equal(posts[0].title, "Title A");
                test.equal(posts[0].subject, "A");
                test.equal(posts[1].title, "Title A");
                test.equal(posts[1].subject, "B");
                test.equal(posts[5].title, "Title Z");
                finished();
            });
        }

        function doMultipleReverseSortTest() {
            tests += 1;
            Post.all({order: "title ASC, subject DESC"}, function(err, posts) {
                if (err) console.log(err);
                test.equal(posts.length, 6);
                test.equal(posts[0].title, "Title A");
                test.equal(posts[0].subject, "B");
                test.equal(posts[1].title,"Title A");
                test.equal(posts[1].subject, "A");
                test.equal(posts[5].title, "Title Z");
                finished();
            });
        }

        var fin = 0;
        function finished() {
            if (++fin === tests) {
                test.done();
            }
        }

        // TODO: do mixed test, do real dates tests, ensure that dates stored in UNIX timestamp format

        function numerically(a, b) {
            return a - b;
        }

    });

    if (
        !schema.name.match(/redis/) &&
        schema.name !== 'memory' &&
        schema.name !== 'neo4j' &&
        schema.name !== 'cradle'
    )
    it('should allow advanced queying: lt, gt, lte, gte, between', function (test) {
        Post.destroyAll(function () {
            Post.create({date: new Date('Wed, 01 Feb 2012 13:56:12 GMT')}, done);
            Post.create({date: new Date('Thu, 02 Feb 2012 13:56:12 GMT')}, done);
            Post.create({date: new Date('Fri, 03 Feb 2012 13:56:12 GMT')}, done);
            Post.create({date: new Date('Sat, 04 Feb 2012 13:56:12 GMT')}, done);
            Post.create({date: new Date('Sun, 05 Feb 2012 13:56:12 GMT')}, done);
            Post.create({date: new Date('Mon, 06 Feb 2012 13:56:12 GMT')}, done);
            Post.create({date: new Date('Tue, 07 Feb 2012 13:56:12 GMT')}, done);
            Post.create({date: new Date('Wed, 08 Feb 2012 13:56:12 GMT')}, done);
            Post.create({date: new Date('Thu, 09 Feb 2012 13:56:12 GMT')}, done);
        });

        var posts = 9;
        function done() {
            if (--posts === 0) makeTest();
        }

        function makeTest() {
            // gt
            Post.all({where: {date: {gt: new Date('Tue, 07 Feb 2012 13:56:12 GMT')}}}, function (err, posts) {
                test.equal(posts.length, 2, 'gt');
                ok();
            });

            // gte
            Post.all({where: {date: {gte: new Date('Tue, 07 Feb 2012 13:56:12 GMT')}}}, function (err, posts) {
                test.equal(posts.length, 3, 'gte');
                ok();
            });

            // lte
            Post.all({where: {date: {lte: new Date('Tue, 07 Feb 2012 13:56:12 GMT')}}}, function (err, posts) {
                test.equal(posts.length, 7, 'lte');
                ok();
            });

            // lt
            Post.all({where: {date: {lt: new Date('Tue, 07 Feb 2012 13:56:12 GMT')}}}, function (err, posts) {
                test.equal(posts.length, 6, 'lt');
                ok();
            });

            // between
            Post.all({where: {date: {between: [new Date('Tue, 05 Feb 2012 13:56:12 GMT'), new Date('Tue, 09 Feb 2012 13:56:12 GMT')]}}}, function (err, posts) {
                test.equal(posts.length, 5, 'between');
                ok();
            });
        }

        var tests = 5;
        function ok() {
            if (--tests === 0) test.done();
        }
    });


    if (
        schema.name === 'mysql' ||
        schema.name === 'postgres'
    )
    it('should allow IN or NOT IN', function (test) {
        User.destroyAll(function () {
            User.create({name: 'User A', age: 21}, done);
            User.create({name: 'User B', age: 22}, done);
            User.create({name: 'User C', age: 23}, done);
            User.create({name: 'User D', age: 24}, done);
            User.create({name: 'User E', age: 25}, done);
        });

        var users = 5;
        function done() {
            if (--users === 0) makeTest();
        }

        function makeTest() {
            // IN with empty array should return nothing
            User.all({where: {name: {inq: []}}}, function (err, users) {
                test.equal(users.length, 0, 'IN with empty array returns nothing');
                ok();
            });

            // NOT IN with empty array should return everything
            User.all({where: {name: {nin: []}}}, function (err, users) {
                test.equal(users.length, 5, 'NOT IN with empty array returns everything');
                ok();
            });

            // IN [User A] returns user with name = User A
            User.all({where: {name: {inq: ['User A']}}}, function (err, users) {
                test.equal(users.length, 1, 'IN searching one existing value returns 1 user');
                test.equal(users[0].name, 'User A', 'IN [User A] returns user with name = User A');
                ok();
            });

            // NOT IN [User A] returns users with name != User A
            User.all({where: {name: {nin: ['User A']}}}, function (err, users) {
                test.equal(users.length, 4, 'IN [User A] returns users with name != User A');
                ok();
            });

            // IN [User A, User B] returns users with name = User A OR name = User B
            User.all({where: {name: {inq: ['User A', 'User B']}}}, function (err, users) {
                test.equal(users.length, 2, 'IN searching two existing values returns 2 users');
                ok();
            });

            // NOT IN [User A, User B] returns users with name != User A AND name != User B
            User.all({where: {name: {nin: ['User A', 'User B']}}}, function (err, users) {
                test.equal(users.length, 3, 'NOT IN searching two existing values returns users with name != User A AND name != User B');
                ok();
            });

            // IN works with numbers too
            User.all({where: {age: {inq: [21, 22]}}}, function (err, users) {
                test.equal(users.length, 2, 'IN works with numbers too');
                ok();
            });

            // NOT IN works with numbers too
            User.all({where: {age: {nin: [21, 22]}}}, function (err, users) {
                test.equal(users.length, 3, 'NOT IN works with numbers too');
                ok();
            });
        }

        var tests = 8;
        function ok() {
            if (--tests === 0) test.done();
        }
    });

    it('should handle order clause with direction', function (test) {
        var wait = 0;
        var emails = [
            'john@hcompany.com',
            'tom@hcompany.com',
            'admin@hcompany.com',
            'tin@hcompany.com',
            'mike@hcompany.com',
            'susan@hcompany.com',
            'test@hcompany.com'
        ];
        User.destroyAll(function () {
            emails.forEach(function (email) {
                wait += 1;
                User.create({email: email, name: 'Nick'}, done);
            });
        });
        var tests = 2;
        function done() {
            process.nextTick(function () {
                if (--wait === 0) {
                    doSortTest();
                    doReverseSortTest();
                }
            });
        }

        function doSortTest() {
            User.all({order: 'email ASC', where: {name: 'Nick'}}, function (err, users) {
                var _emails = emails.sort();
                users.forEach(function (user, i) {
                    test.equal(_emails[i], user.email, 'ASC sorting');
                });
                testDone();
            });
        }

        function doReverseSortTest() {
            User.all({order: 'email DESC', where: {name: 'Nick'}}, function (err, users) {
                var _emails = emails.sort().reverse();
                users.forEach(function (user, i) {
                    test.equal(_emails[i], user.email, 'DESC sorting');
                });
                testDone();
            });
        }

        function testDone() {
            if (--tests === 0) test.done();
        }
    });

    it('should return id in find result even after updateAttributes', function (test) {
        Post.create(function (err, post) {
            var id = post.id;
            test.ok(post.published === false);
            post.updateAttributes({title: 'hey', published: true}, function () {
                Post.find(id, function (err, post) {
                    test.ok(!!post.published, 'Update boolean field');
                    test.ok(post.id);
                    test.done();
                });
            });
        });
    });

    it('should handle belongsTo correctly', function (test) {
        var passport = new Passport({ownerId: 16});
        // sync getter
        test.equal(passport.owner(), 16);
        // sync setter
        passport.owner(18);
        test.equal(passport.owner(), 18);
        test.done();
    });

    it('should query one record', function (test) {
        test.expect(4);
        Post.findOne(function (err, post) {
            test.ok(post && post.id);
            Post.findOne({ where: { title: 'hey' } }, function (err, post) {
                if (err) {
                    console.log(err);
                    return test.done();
                }
                test.equal(post && post.constructor.modelName, 'Post');
                test.equal(post && post.title, 'hey');
                Post.findOne({ where: { title: 'not exists' } }, function (err, post) {
                    test.ok(typeof post === 'undefined');
                    test.done();
                });
            });
        });
    });

    if (
        !schema.name.match(/redis/) &&
            schema.name !== 'memory' &&
            schema.name !== 'neo4j' &&
            schema.name !== 'cradle'
        )
    it('belongsTo should be cached', function (test) {
        User.findOne(function(err, user) {

            var passport = new Passport({ownerId: user.id});
            var passport2 = new Passport({ownerId: null});

            // There can't be any concurrency because we are counting requests
            // We are first testing cases when passport has an owner
            passport.owner(function(err, data) {
                var nbInitialRequests = nbSchemaRequests;
                passport.owner(function(err, data2) {
                    test.equal(data.id, data2.id, 'The value should remain the same');
                    requestsAreCounted && test.equal(nbInitialRequests, nbSchemaRequests, 'There should not be any request because value is cached.');

                    // We are now testing cases when passport has not an owner
                    passport2.owner(function(err, data) {
                        var nbInitialRequests2 = nbSchemaRequests;
                        passport2.owner(function(err, data2) {
                            test.equal(data, null, 'The value should be null since there is no owner');
                            test.equal(data, data2, 'The value should remain the same (null)');
                            requestsAreCounted && test.equal(nbInitialRequests2, nbSchemaRequests, 'There should not be any request because value is cached.');

                            passport2.owner(user.id);
                            passport2.owner(function(err, data3) {
                                test.equal(data3.id, user.id, 'Owner should now be the user.');
                                requestsAreCounted && test.equal(nbInitialRequests2 + 1, nbSchemaRequests, 'If we changed owner id, there should be one more request.');

                                passport2.owner(true, function(err, data4) {
                                    test.equal(data3.id, data3.id, 'The value should remain the same');
                                    requestsAreCounted && test.equal(nbInitialRequests2 + 2, nbSchemaRequests, 'If we forced refreshing, there should be one more request.');
                                    test.done();
                                });
                            });
                        });
                    });

                });
            });
        });

    });

    if (schema.name !== 'mongoose' && schema.name !== 'neo4j')
    it('should update or create record', function (test) {
        var newData = {
            id: 1,
            title: 'New title (really new)',
            content: 'Some example content (updated)'
        };
        Post.updateOrCreate(newData, function (err, updatedPost) {
            if (err) throw err;
            test.ok(updatedPost);
            if (!updatedPost) throw Error('No post!');

            if (schema.name !== 'mongodb') {
                test.equal(newData.id, updatedPost.toObject().id);
            }
            test.equal(newData.title, updatedPost.toObject().title);
            test.equal(newData.content, updatedPost.toObject().content);

            Post.find(updatedPost.id, function (err, post) {
                if (err) throw err;
                if (!post) throw Error('No post!');
                if (schema.name !== 'mongodb') {
                    test.equal(newData.id, post.toObject().id);
                }
                test.equal(newData.title, post.toObject().title);
                test.equal(newData.content, post.toObject().content);
                Post.updateOrCreate({id: 100001, title: 'hey'}, function (err, post) {
                    if (schema.name !== 'mongodb') test.equal(post.id, 100001);
                    test.equal(post.title, 'hey');
                    Post.find(post.id, function (err, post) {
                        if (!post) throw Error('No post!');
                        test.done();
                    });
                });
            });
        });
    });

    it('should work with custom setters and getters', function (test) {
        User.schema.defineForeignKey('User', 'passwd');
        User.setter.passwd = function (pass) {
            this._passwd = pass + 'salt';
        };
        var u = new User({passwd: 'qwerty'});
        test.equal(u.passwd, 'qwertysalt');
        u.save(function (err, user) {
            User.find(user.id, function (err, user) {
                test.ok(user !== u);
                test.equal(user.passwd, 'qwertysalt');
                User.all({where: {passwd: 'qwertysalt'}}, function (err, users) {
                    test.ok(users[0] !== user);
                    test.equal(users[0].passwd, 'qwertysalt');
                    User.create({passwd: 'asalat'}, function (err, usr) {
                        test.equal(usr.passwd, 'asalatsalt');
                        User.upsert({passwd: 'heyman'}, function (err, us) {
                            test.equal(us.passwd, 'heymansalt');
                            User.find(us.id, function (err, user) {
                                test.equal(user.passwd, 'heymansalt');
                                test.done();
                            });
                        });
                    });
                });
            });
        });
    });

    it('should work with typed and untyped nested collections', function (test) {
        var post = new Post;
        var like = post.likes.push({foo: 'bar'});
        test.equal(like.constructor.name, 'ListItem');
        var related = post.related.push({hello: 'world'});
        test.ok(related.someMethod);
        post.save(function (err, p) {
            test.equal(p.likes.nextid, 2);
            p.likes.push({second: 2});
            p.likes.push({third: 3});
            p.save(function (err) {
                Post.find(p.id, function (err, pp) {
                    test.equal(pp.likes.length, 3);
                    test.ok(pp.likes[3].third);
                    test.ok(pp.likes[2].second);
                    test.ok(pp.likes[1].foo);
                    pp.likes.remove(2);
                    test.equal(pp.likes.length, 2);
                    test.ok(!pp.likes[2]);
                    pp.likes.remove(pp.likes[1]);
                    test.equal(pp.likes.length, 1);
                    test.ok(!pp.likes[1]);
                    test.ok(pp.likes[3]);
                    pp.save(function () {
                        Post.find(p.id, function (err, pp) {
                            test.equal(pp.likes.length, 1);
                            test.ok(!pp.likes[1]);
                            test.ok(pp.likes[3]);
                            test.done();
                        });
                    });
                });
            });
        });
    });

    it('all tests done', function (test) {
        test.done();
        process.nextTick(allTestsDone);
    });

    function allTestsDone() {
        schema.disconnect();
        console.log('Test done in %dms\n', Date.now() - start);
    }

}

function getSpecificTests() {
    var sp  = {};

    sp['neo4j'] = function (schema) {

        it('should create methods for searching by index', function (test) {
            var Post = schema.models['Post'];
            test.ok(typeof Post.findByTitle === 'function');
            Post.create({title: 'Catcher in the rye'}, function (err, post) {
                if (err) return console.log(err);
                test.ok(!post.isNewRecord());
                Post.findByTitle('Catcher in the rye', function (err, foundPost) {
                    if (err) return console.log(err);
                    if (foundPost) {
                        test.equal(post.id, foundPost.id);
                        test.done();
                    }
                });
            });
        });
    };

    return sp;
}
