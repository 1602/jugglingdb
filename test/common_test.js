var Schema = require('../index').Schema;
var Text = Schema.Text;

require('./spec_helper').init(exports);

var schemas = {
    /*
    riak: {},
    sequelize: {
        database: 'sequ-test',
        username: 'root'
    }
    */
    neo4j:     { url: 'http://localhost:7474/' },
    mongoose:  { url: 'mongodb://localhost/test' },
    redis:     {},
    memory:    {}
};

Object.keys(schemas).forEach(function (schemaName) {
    if (process.env.ONLY && process.env.ONLY !== schemaName) return;
    context(schemaName, function () {
        var schema = new Schema(schemaName, schemas[schemaName]);
        testOrm(schema);
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
            age:          Number
        });

        Post = schema.define('Post', {
            title:     { type: String, length: 255 },
            content:   { type: Text },
            date:      { type: Date,    detault: Date.now },
            published: { type: Boolean, default: false }
        });

        User.hasMany(Post,   {as: 'posts',  foreignKey: 'userId'});
        // creates instance methods:
        // user.posts(conds)
        // user.buildPost(data) // like new Post({userId: user.id});
        // user.createPost(data) // build and save

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
        var hw = 'Hello word', post = new Post({title: hw});
        test.equal(post.title, hw);
        test.ok(!post.propertyChanged('title'));
        post.title = 'Goodbye, Lenin';
        test.equal(post.title_was, hw);
        test.ok(post.propertyChanged('title'));
        // test.ok(post.isNewRecord());
        test.done();
    });

    it('should be expoted to JSON', function (test) {
        test.equal(JSON.stringify(new Post({id: 1, title: 'hello, json'})),
        '{"id":1,"title":"hello, json","content":null,"date":null,"published":null,"userId":null}');
        test.done();
    });

    it('should create object', function (test) {
        Post.create(function (err, post) {
            if (err) throw err;
            test.ok(post.id);
            test.ok(!post.title, 'Title is blank');
            test.ok(!post.date, 'Date is blank');
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
            test.ok(obj.id);
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
                test.equal(obj.date, date.toString());
                test.done();
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

    it('should update single attribute', function (test) {
        Post.create({title: 'title', content: 'content', published: true}, function (err, post) {
            post.content = 'New content';
            post.updateAttribute('title', 'New title', function () {
                test.equal(post.title, 'New title');
                test.ok(!post.propertyChanged('title'));
                test.equal(post.content, 'New content');
                test.ok(post.propertyChanged('content'));
                post.reload(function () {
                    test.equal(post.title, 'New title');
                    test.ok(!post.propertyChanged('title'));
                    test.equal(post.content, 'content');
                    test.ok(!post.propertyChanged('content'));
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
        Post.all({title: 'New title'}, function (err, res) {
            var pass = true;
            res.forEach(function (r) {
                if (r.title != 'New title') pass = false;
            });
            test.ok(res.length > 0);
            test.ok(pass, 'Exact match with string');
            done();
        });

        // matching null
        Post.all({date: null, title: null}, function (err, res) {
            var pass = true;
            res.forEach(function (r) {
                if (r.date != null || r.title != null) pass = false;
            });
            test.ok(res.length > 0);
            test.ok(pass, 'Matching null');
            done();
        });

        // matching regexp
        Post.all({title: /hello/i}, function (err, res) {
            var pass = true;
            res.forEach(function (r) {
                if (!r.title || !r.title.match(/hello/i)) pass = false;
            });
            test.ok(res.length > 0);
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
            test.ok(u.buildPost, 'Method defined: buildPost');
            test.ok(u.createPost, 'Method defined: createPost');
            u.createPost(function (err, post) {
                if (err) return console.log(err);
                test.ok(post.author(), u.id);
                u.posts(function (err, posts) {
                    test.strictEqual(posts.pop(), post);
                    test.done();
                });
            });
        });
    });

    it('should destroy all records', function (test) {
        Post.destroyAll(function (err) {
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
        console.log('Test done in %dms\n', Date.now() - start);
    }

}
