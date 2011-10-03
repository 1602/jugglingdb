require('./spec_helper').init(exports);

[ 'redis~'
, 'mysql'
, 'mongodb~'
, 'postgres~'
].forEach(function (driver) {
    // context(driver, testCasesFor(driver));
});

function testCasesFor (driver) {
    return function () {

        function Post ()    { this.initialize.apply(this, Array.prototype.slice.call(arguments)); }
        function Comment () { this.initialize.apply(this, Array.prototype.slice.call(arguments)); }

        var properties = {};

        properties['post'] = {
            title:     { type: String, validate: /.{10,255}/ },
            content:   { type: String  },
            published: { type: Boolean, default: false },
            date:      { type: Date, default: function () {return new Date} }
        };

        properties['comment'] = {
            content:   { type: String, validate: /./  },
            date:      { type: Date    },
            author:    { type: String  },
            approved:  { type: Boolean }
        };

        var associations = {};
        associations['post'] = {
            comments: {className: 'Comment', relationType: 'n', tableName: 'comment'}
        };

        associations['comment'] = {
            post:     {className: 'Post', relationType: '<', tableName: 'post'}
        };

        try {
            var orm = require('../lib/datamapper/' + driver);
            if (driver == 'mysql') {
                orm.configure({
                    host: 'webdesk.homelinux.org',
                    port: 3306,
                    database: 'test',
                    user: 'guest',
                    password: ''
                });
            }
        } catch (e) {
            console.log(e.message);
            return;
        }
        orm.debugMode = true;
        orm.mixPersistMethods(Post, {
            className:    'Post',
            tableName:    'post',
            properties:   properties['post'],
            associations: associations['post']
        });
        orm.mixPersistMethods(Comment, {
            className:    'Comment',
            tableName:    'comment',
            properties:   properties['comment'],
            associations: associations['comment'],
            scopes: {
                approved: { conditions: { approved: true } },
                author: { block: function (author) { return {conditions: {author: author}}; } }
            }
        });

        var HOW_MANY_RECORDS = 1;

        it('cleanup database', function (test) {
            var wait = 0;
            var time = new Date;
            var len;
            Post.allInstances(function (posts) {
                if (posts.length === 0) test.done();
                len = posts.length;
                posts.forEach(function (post) {
                    wait += 1;
                    post.destroy(done);
                });
            });

            function done () {
                if (--wait === 0) {
                    test.done();
                    console.log('Cleanup %d records completed in %d ms', len, new Date - time);
                }
            }
        });

        it('create a lot of data', function (test) {
            var wait = HOW_MANY_RECORDS;
            var time = new Date;
            for (var i = wait; i > 0; i -= 1) {
                Post.create({title: Math.random().toString(), content: arguments.callee.caller.toString(), date: new Date, published: false}, done);
            }

            function done () {
                if (--wait === 0) {
                    test.done();
                    console.log('Creating %d records completed in %d ms', HOW_MANY_RECORDS, new Date - time);
                }
            }
        });

        it('should retrieve all data fast', function (test) {
            var time = new Date;
            Post.allInstances(function (posts) {
                test.equal(posts.length, HOW_MANY_RECORDS);
                console.log('Retrieving %d records completed in %d ms', HOW_MANY_RECORDS, new Date - time);
                test.done();
            });
        });

        it('should initialize object properly', function (test) {
            var hw = 'Hello world', post = new Post({title: hw});
            test.equal(post.title, hw);
            test.ok(!post.propertyChanged('title'));
            post.title = 'Goodbye, Lenin';
            test.equal(post.title_was, hw);
            test.ok(post.propertyChanged('title'));
            test.ok(post.isNewRecord());
            test.done();
        });

        it('should create object', function (test) {
            Post.create(function () {
                test.ok(this.id);
                Post.exists(this.id, function (exists) {
                    test.ok(exists);
                    test.done();
                });
            });
        });

        it('should save object', function (test) {
            var title = 'Initial title', title2 = 'Hello world',
                date = new Date;

            Post.create({
                title: title,
                date: date
            }, function () {
                test.ok(this.id);
                test.equals(this.title, title);
                test.equals(this.date, date);
                this.title = title2;
                this.save(function () {
                    test.equal(this.title, title2);
                    test.ok(!this.propertyChanged('title'));
                    test.done();
                });
            });
        });

        it('should create object with initial data', function (test) {
            var title = 'Initial title',
                date = new Date;

            Post.create({
                title: title,
                date: date
            }, function () {
                test.ok(this.id);
                test.equals(this.title, title);
                test.equals(this.date, date);
                Post.find(this.id, function () {
                    test.equal(this.title, title);
                    test.equal(this.date, date.toString());
                    test.done();
                });
            });
        });

        it('should not create new instances for the same object', function (test) {
            var title = 'Initial title';
            Post.create({ title: title }, function () {
                var post = this;
                test.ok(this.id, 'Object should have id');
                test.equals(this.title, title);
                Post.find(this.id, function () {
                    test.equal(this.title, title);
                    test.strictEqual(this, post);
                    test.done();
                });
            });
        });

        it('should destroy object', function (test) {
            Post.create(function () {
                var post = this;
                Post.exists(post.id, function (exists) {
                    test.ok(exists, 'Object exists');
                    post.destroy(function () {
                        Post.exists(post.id, function (exists) {
                            test.ok(!exists, 'Object not exists');
                            Post.find(post.id, function (err, obj) {
                                test.ok(err, 'Object not found');
                                test.equal(obj, null, 'Param obj should be null');
                                test.done();
                            });
                        });
                    });
                });
            });
        });

        it('should update single attribute', function (test) {
            Post.create({title: 'title', content: 'content'}, function () {
                this.content = 'New content';
                this.updateAttribute('title', 'New title', function () {
                    test.equal(this.title, 'New title');
                    test.ok(!this.propertyChanged('title'));
                    test.equal(this.content, 'New content');
                    test.ok(this.propertyChanged('content'));
                    this.reload(function () {
                        test.equal(this.title, 'New title');
                        test.ok(!this.propertyChanged('title'));
                        test.equal(this.content, 'content');
                        test.ok(!this.propertyChanged('content'));
                        test.done();
                    });
                });
            });
        });

        // NOTE: this test rely on previous
        it('should fetch collection', function (test) {
            Post.allInstances(function (posts) {
                test.ok(posts.length > 0);
                test.strictEqual(posts[0].constructor, Post);
                test.done();
            });
        });

        // NOTE: this test rely on previous
        it('should fetch first, second, third and last elements of class', function (test) {
            test.done(); return;
            var queries = 4;
            test.expect(queries);
            function done () { if (--queries == 0) test.done(); }

            Post.first(function (post) {
                test.strictEqual(post.constructor, Post);
                done();
            });
            Post.second(function (post) {
                test.strictEqual(post.constructor, Post);
                done();
            });
            Post.third(function (post) {
                test.strictEqual(post.constructor, Post);
                done();
            });
            Post.last(function (post) {
                test.strictEqual(post.constructor, Post);
                done();
            });
        });

        it('should load associated collection', function (test) {
            test.done(); return;
            Post.last(function (post) {
                post.comments.approved.where('author = ?', 'me').load();
            });
        });

        it('should find record and associated association', function (test) {
            test.done(); return;
            Post.last(function (post) {
                Post.find(post.id, {include: 'comments'}, function () {
                });
            });
        });

        it('should fetch associated collection', function (test) {
            test.done(); return;
            Post.create(function () {
                // load collection
                this.comments(function () {
                });
                // creating associated object
                this.comments.create(function () {
                });
                this.comments.build().save();
                // named scopes
                this.comments.pending(function () {
                });
                this.comments.approved(function () {
                });
            });
        });

        it('should validate object', function (test) {
            test.done(); return;
            var post = new Post;
            test.ok(!post.isValid());
            post.save(function (id) {
                test.ok(!id, 'Post should not be saved');
            });
            post.title = 'Title';
            test.ok(post.isValid());
            post.save(function (id) {
                test.ok(id);
                test.done();
            });
        });

    }
};
