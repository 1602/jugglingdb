## About [<img src="https://secure.travis-ci.org/1602/jugglingdb.png" />](http://travis-ci.org/#!/1602/jugglingdb)

JugglingDB is cross-db ORM for nodejs, providing **common interface** to access most popular database formats. 
Currently supported are: mysql, sqlite3, postgres, couchdb, mongodb, redis, neo4j
and js-memory-storage (yep, 
self-written engine for test-usage only). You can add your favorite database adapter, checkout one of the 
existing adapters to learn how, it's super-easy, I guarantee.

## Installation

    npm install jugglingdb

plus you should install appropriated adapter, for example for redis:

    npm install jugglingdb-redis

check following list of available adapters

## JugglingDB adapters

<table>
  <thead>
    <tr>
      <th>Database type</th>
      <th>Package name</th>
      <th>Maintainer</th>
      <th>Build status</th>
    </tr>
  </thead>
  <tbody>
    <!-- Firebird -->
    <tr>
      <td><a href="http://firebirdsql.org"><img src="http://firebirdsql.org/favicon.ico" alt="Firebird"/></a> Firebird</td>
      <td><a href="http://github.com/hgourvest/jugglingdb-firebird">jugglingdb-firebird</a></td>
      <td><a href="http://github.com/hgourvest">Henri Gourvest</a></td>
      <td></td>
    </tr>

    <!-- MongoDB -->
    <tr>
      <td><a href="http://www.mongodb.org"><img src="http://mongodb.ru/favicon.ico" alt="MongoDB" /></a> MongoDB</td>
      <td><a href="/1602/jugglingdb-mongodb">jugglingdb-mongodb</a></td>
      <td><a href="/anatoliychakkaev">Anatoliy Chakkaev</a></td>
      <td><a href="https://travis-ci.org/1602/jugglingdb-mongodb"><img src="https://travis-ci.org/1602/jugglingdb-mongodb.png?branch=master" alt="Build Status" /></a></td>
    </tr>

    <!-- MySQL -->
    <tr>
      <td><a href="http://www.mysql.com/"><img src="/1602/jugglingdb/raw/master/media/mysql.ico" style="vertical-align:middle"" alt="MySQL" /></a> MySQL</td>
      <td><a href="/1602/jugglingdb-mysql">jugglingdb-mysql</a></td>
      <td><a href="/anatoliychakkaev">Anatoliy Chakkaev</a></td>
      <td><a href="https://travis-ci.org/1602/jugglingdb-mysql"><img src="https://travis-ci.org/1602/jugglingdb-mysql.png?branch=master" alt="Build Status" /></a></td>
    </tr>

    <!-- CouchDB / nano -->
    <tr>
      <td><a href="http://couchdb.apache.org/"><img width="16" src="http://couchdb.apache.org/favicon.ico" style="vertical-align:middle"" alt="CouchDB" /></a> CouchDB / nano</td>
      <td><a href="/1602/jugglingdb-nano">jugglingdb-nano</a></td>
      <td><a href="/nrw">Nicholas Westlake</a></td>
      <td><a href="https://travis-ci.org/1602/jugglingdb-nano"><img src="https://travis-ci.org/1602/jugglingdb-nano.png?branch=master" alt="Build Status" /></a></td>
    </tr>

    <!-- PostgreSQL -->
    <tr>
      <td><a href="http://www.postgresql.org/"><img src="http://www.postgresql.org/favicon.ico" style="vertical-align:middle"" alt="PostgreSQL" /></a> PostgreSQL</td>
      <td><a href="/1602/jugglingdb-postgres">jugglingdb-postgres</a></td>
      <td><a href="/anatoliychakkaev">Anatoliy Chakkaev</a></td>
      <td><a href="https://travis-ci.org/1602/jugglingdb-postgres"><img src="https://travis-ci.org/1602/jugglingdb-postgres.png?branch=master" alt="Build Status" /></a></td>
    </tr>

    <!-- Redis -->
    <tr>
      <td><a href="http://redis.io/"><img src="http://redis.io/images/favicon.png" alt="Redis" /></a> Redis</td>
      <td><a href="/1602/jugglingdb-redis">jugglingdb-redis</a></td>
      <td><a href="/anatoliychakkaev">Anatoliy Chakkaev</a></td>
      <td><a href="https://travis-ci.org/1602/jugglingdb-redis"><img src="https://travis-ci.org/1602/jugglingdb-redis.png?branch=master" alt="Build Status" /></a></td>
    </tr>

    <!-- SQLite -->
    <tr>
      <td><a href="http://www.sqlite.org/"><img width="16" src="/1602/jugglingdb/raw/master/media/sqlite.png" style="vertical-align:middle"" alt="SQLite" /></a> SQLite</td>
      <td><a href="/1602/jugglingdb-sqlite3">jugglingdb-sqlite3</a></td>
      <td><a href="/anatoliychakkaev">Anatoliy Chakkaev</a></td>
      <td><a href="https://travis-ci.org/1602/jugglingdb-sqlite3"><img src="https://travis-ci.org/1602/jugglingdb-sqlite3.png?branch=master" alt="Build Status" /></a></td>
    </tr>

  </tbody>
</table>

## Participation

- Check status of project on trello board: https://trello.com/board/jugglingdb/4f0a0b1e27d3103c64288388
- Make sure all tests pass (`npm test` command)
- Feel free to vote and comment on cards (tickets/issues), if you want to join team -- send me a message with your email.

If you want to create your own jugglingdb adapter, you should publish your
adapter package with name `jugglingdb-ADAPTERNAME`. Creating adapter is simple,
check [jugglingdb-redis](/1602/jugglingdb-redis) for example. JugglingDB core
exports common tests each adapter should pass, you could create your adapter in
TDD style, check that adapter pass all tests defined in `test/common_test.js`.

## Usage

```javascript
var Schema = require('jugglingdb').Schema;
var schema = new Schema('redis', {port: 6379}); //port number depends on your configuration
// define models
var Post = schema.define('Post', {
    title:     { type: String, length: 255 },
    content:   { type: Schema.Text },
    date:      { type: Date,    default: Date.now },
    published: { type: Boolean, default: false, index: true }
});

// simplier way to describe model
var User = schema.define('User', {
    name:         String,
    bio:          Schema.Text,
    approved:     Boolean,
    joinedAt:     Date,
    age:          Number
});

// define any custom method
User.prototype.getNameAndAge = function () {
    return this.name + ', ' + this.age;
};

// models also accessible in schema:
schema.models.User;
schema.models.Post;

// setup relationships
User.hasMany(Post,   {as: 'posts',  foreignKey: 'userId'});
// creates instance methods:
// user.posts(conds)
// user.posts.build(data) // like new Post({userId: user.id});
// user.posts.create(data) // build and save

Post.belongsTo(User, {as: 'author', foreignKey: 'userId'});
// creates instance methods:
// post.author(callback) -- getter when called with function
// post.author() -- sync getter when called without params
// post.author(user) -- setter when called with object

schema.automigrate(); // required only for mysql NOTE: it will drop User and Post tables

// work with models:
var user = new User;
user.save(function (err) {
    var post = user.posts.build({title: 'Hello world'});
    post.save(console.log);
});

// or just call it as function (with the same result):
var user = User();
user.save(...);

// Common API methods

// just instantiate model
new Post
// save model (of course async)
Post.create(cb);
// all posts
Post.all(cb)
// all posts by user
Post.all({where: {userId: user.id}, order: 'id', limit: 10, skip: 20});
// the same as prev
user.posts(cb)
// get one latest post
Post.findOne({where: {published: true}, order: 'date DESC'}, cb);
// same as new Post({userId: user.id});
user.posts.build
// save as Post.create({userId: user.id}, cb);
user.posts.create(cb)
// find instance by id
User.find(1, cb)
// count instances
User.count([conditions, ]cb)
// destroy instance
user.destroy(cb);
// destroy all instances
User.destroyAll(cb);

// Setup validations
User.validatesPresenceOf('name', 'email')
User.validatesLengthOf('password', {min: 5, message: {min: 'Password is too short'}});
User.validatesInclusionOf('gender', {in: ['male', 'female']});
User.validatesExclusionOf('domain', {in: ['www', 'billing', 'admin']});
User.validatesNumericalityOf('age', {int: true});
User.validatesUniquenessOf('email', {message: 'email is not unique'});

user.isValid(function (valid) {
    if (!valid) {
        user.errors // hash of errors {attr: [errmessage, errmessage, ...], attr: ...}    
    }
})

```

## Callbacks

The following callbacks supported:

    - afterInitialize
    - beforeCreate
    - afterCreate
    - beforeSave
    - afterSave
    - beforeUpdate
    - afterUpdate
    - beforeDestroy
    - afterDestroy
    - beforeValidation
    - afterValidation

Each callback is class method of the model, it should accept single argument: `next`, this is callback which
should be called after end of the hook. Except `afterInitialize` because this method is syncronous (called after `new Model`).

## Object lifecycle:

```javascript
var user = new User;
// afterInitialize
user.save(callback);
// beforeValidation
// afterValidation
// beforeSave
// beforeCreate
// afterCreate
// afterSave
// callback
user.updateAttribute('email', 'email@example.com', callback);
// beforeValidation
// afterValidation
// beforeUpdate
// afterUpdate
// callback
user.destroy(callback);
// beforeDestroy
// afterDestroy
// callback
User.create(data, callback);
// beforeValidate
// afterValidate
// beforeCreate
// afterCreate
// callback
```

Read the tests for usage examples: ./test/common_test.js
Validations: ./test/validations_test.js

## Your own database adapter

To use custom adapter, pass it's package name as first argument to `Schema` constructor:

    mySchema = new Schema('couch-db-adapter', {host:.., port:...});

Make sure, your adapter can be required (just put it into ./node_modules):

    require('couch-db-adapter');
    
## Jugglingdb Adapters

- Firebird: https://github.com/hgourvest/jugglingdb-firebird
- Couchdb: TODO: add link for external couchdb adapter

## Running tests

To run all tests (requires all databases):

    npm test

If you run this line, of course it will fall, because it requres different databases to be up and running, 
but you can use js-memory-engine out of box! Specify ONLY env var:

    ONLY=memory nodeunit test/common_test.js

of course, if you have redis running, you can run

    ONLY=redis nodeunit test/common_test.js

## Package structure

Now all common logic described in `./lib/*.js`, and database-specific stuff in `./lib/adapters/*.js`. It's super-tiny, right?

## Contributing

If you have found a bug please write unit test, and make sure all other tests still pass before pushing code to repo.

## License

MIT
