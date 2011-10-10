## About

JugglingDB is cross-db ORM, providing **common interface** to access most popular database formats. 
Currently supported are: mysql, mongodb, redis, neo4j and js-memory-storage (yep, 
self-written engine for test-usage only). You can add your favorite database adapter, checkout one of the 
existing adapters to learn how, it's super-easy, I guarantee.

## Installation

    git clone git://github.com/1602/jugglingdb.git

## Usage

```javascript
var Schema = require('./jugglingdb').Schema;
var s = new Schema('redis');
// define models
var Post = schema.define('Post', {
    title:     { type: String, length: 255 },
    content:   { type: Schema.Text },
    date:      { type: Date,    detault: Date.now },
    published: { type: Boolean, default: false }
});
// simplier way to describe model
var User = schema.define('User', {
    name:         String,
    bio:          Schema.Text,
    approved:     Boolean,
    joinedAt:     Date,
    age:          Number
});

// setup relationships
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

s.automigrate(); // required only for mysql NOTE: it will drop User and Post tables

// work with models:
var user = new User;
user.save(function (err) {
    var post = user.buildPost({title: 'Hello world'});
    post.save(console.log);
});

// Common API methods

// just instantiate model
new Post
// save model (of course async)
Post.create(cb);
// all posts
Post.all(cb)
// all posts by user
Post.all({userId: user.id});
// the same as prev
user.posts(cb)
// same as new Post({userId: user.id});
user.buildPost
// save as Post.create({userId: user.id}, cb);
user.createPost(cb)
// find instance by id
User.find(1, cb)
// count instances
User.count(cb)
// destroy instance
user.destroy(cb);
// destroy all instances
User.destroyAll(cb);
```

Read the tests for usage examples: ./test/common_test.js

## Your own database adapter

To use custom adapter, pass it's package name as first argument to `Schema` constructor:

    mySchema = new Schema('couch-db-adapter', {host:.., port:...});

Make sure, your adapter can be required (just put it into ./node_modules):

    require('couch-db-adapter');

## Running tests

All tests are written using nodeunit:

    nodeunit test/common_test.js

If you run this line, of course it will fall, because it requres different databases to be up and running, 
but you can use js-memory-engine out of box! Specify ONLY env var:

    ONLY=memory nodeunit test/common_test.js

of course, if you have redis running, you can run

    ONLY=redis nodeunit test/common_test.js

## Package structure

Now all common logic described in ./index.js, and database-specific stuff in ./lib/*.js. It's super-tiny, right?

## Project status

This project was written in one weekend (1,2 oct 2011), and of course does not claim to be production-ready,
but I plan to use this project as default ORM for RailwayJS in nearest future.
So, if you are familiar with some database engines - please help me to improve adapter for that database.

For example, I know, mysql implementation sucks now, 'cause I'm not digging too deep into SequelizeJS code,
and I think it would be better to replace sequelize with something low-level in nearest future, such
as `mysql` package from npm.

## Contributing

If you have found a bug please write unit test, and make sure all other tests still pass before pushing code to repo.

## Roadmap

### Common:

+ transparent interface to APIs
+ validations
+ -before and -after hooks on save, update, destroy
+ default values
+ more relationships stuff
+ docs

### Databases:

+ riak
+ couchdb
+ low-level mysql
+ postgres
+ sqlite

## License

MIT
