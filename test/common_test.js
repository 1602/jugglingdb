var Schema = require('../index').Schema;
var Text = Schema.Text;

require('./spec_helper').init(exports);

var schemas = {
    /*
    riak: {},
    */
    sequelize: {
        database: 'sequ-test',
        username: 'root'
    },
    mysql: {
        database: 'sequ-test',
        username: 'root'
    },
    postgres: {
        database: 'pg-test',
        username: 'anatoliy'
    },
    neo4j:     { url: 'http://localhost:7474/' },
    // mongoose:  { url: 'mongodb://localhost/test' },
    mongoose:  {
        database: 'test'
    },
    redis:     {},
    memory:    {}
};

var specificTest = getSpecificTests();

Object.keys(schemas).forEach(function (schemaName) {
    if (process.env.ONLY && process.env.ONLY !== schemaName) return;
    context(schemaName, function () {
        var schema = new Schema(schemaName, schemas[schemaName]);
        // schema.log = console.log;
        testOrm(schema);
        if (specificTest[schemaName]) specificTest[schemaName](schema);
    });
});

function testOrm(schema) {

    var Post, User;
    var start = Date.now();

    it('should define class', function (test) {

        User = schema.define('User', {
            name:         String,
            bio:          Text,
            approved:     Boolean,
            joinedAt:     Date,
            age:          Number,
            passwd:     String
        });

        Post = schema.define('Post', {
            title:     { type: String, length: 255, index: true },
            content:   { type: Text },
            date:      { type: Date,    default: Date.now },
            published: { type: Boolean, default: false }
        });

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
        test.ok(!post.propertyChanged('title'));
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
        '{"id":1,"title":"hello, json","content":null,"date":1,"published":false,"userId":null}');
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
                    test.ok(!post.a);
                    test.done();
                });
            });
        });
    });

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

    it('should update single attribute', function (test) {
        Post.create({title: 'title', content: 'content', published: true}, function (err, post) {
            post.content = 'New content';
            post.updateAttribute('title', 'New title', function () {
                test.equal(post.title, 'New title');
                test.ok(!post.propertyChanged('title'));
                test.equal(post.content, 'New content', 'dirty state saved');
                test.ok(post.propertyChanged('content'));
                post.reload(function () {
                    test.equal(post.title, 'New title');
                    test.ok(!post.propertyChanged('title'));
                    test.equal(post.content, 'content', 'real value turned back');
                    test.ok(!post.propertyChanged('content'), 'content unchanged');
                    test.done();
                });
            });
        });
    });

    var countOfposts;
    it('should fetch collection', function (test) {
        Post.all(function (err, posts) {
            countOfposts = posts.length;
            test.ok(countOfposts > 0);
            test.ok(posts[0] instanceof Post);
            test.done();
        });
    });

    it('should fetch count of records in collection', function (test) {
        Post.count(function (err, count) {
            test.equal(countOfposts, count);
            test.done();
        });
    });

    it('should find filtered set of records', function (test) {
        var wait = 3;

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
        Post.all({where: {title: null}}, function (err, res) {

            var pass = true;
            res.forEach(function (r) {
                if (r.title != null) pass = false;
            });
            test.ok(res.length > 0, 'Matching null returns dataset');
            test.ok(pass, 'Matching null');
            done();
        });

        // matching regexp
        Post.all({where: {title: /hello/i}}, function (err, res) {
            var pass = true;
            res.forEach(function (r) {
                if (!r.title || !r.title.match(/hello/i)) pass = false;
            });
            test.ok(res.length > 0, 'Matching regexp returns dataset');
            test.ok(pass, 'Matching regexp');
            done();
        });

        function done() {
            if (--wait === 0) {
                test.done();
            }
        }

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
                    test.strictEqual(posts.pop(), post);
                    test.done();
                });
            });
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
        test.ok(Post.published._scope.published = true);
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
                throw err;
            }
            Post.all(function (err, posts) {
                test.equal(posts.length, 0);
                Post.count(function (err, count) {
                    test.equal(count, 0);
                    test.done();
                    process.nextTick(allTestsDone);
                });
            });
        });
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
