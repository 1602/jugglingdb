Schema = require('../index').Schema
Text = Schema.Text

require('./spec_helper').init exports

schemas =
    neo4j:
        url: 'http://localhost:7474/'
    mongoose:
        url: 'mongodb://localhost/test'
    redis:     {}
    memory:    {}
    cradle:    {}
    nano:
        url: 'http://localhost:5984/nano-test'

testOrm = (schema) ->

    User = Post = 'unknown'
    maxUsers = 100
    maxPosts = 50000
    users = []

    it 'should define simple', (test) ->

        User = schema.define 'User', {
            name:         String,
            bio:          Text,
            approved:     Boolean,
            joinedAt:     Date,
            age:          Number
        }

        Post = schema.define 'Post',
            title:     { type: String, length: 255, index: true }
            content:   { type: Text }
            date:      { type: Date,    detault: Date.now }
            published: { type: Boolean, default: false }

        User.hasMany(Post,   {as: 'posts',  foreignKey: 'userId'})
        Post.belongsTo(User, {as: 'author', foreignKey: 'userId'})

        test.done()

    it 'should create users', (test) ->
        wait = maxUsers
        done = (e, u) ->
            users.push(u)
            test.done() if --wait == 0
        User.create(done) for i in [1..maxUsers]

    it 'should create bunch of data', (test) ->
        wait = maxPosts
        done = -> test.done() if --wait == 0
        rnd  = (title) ->
            {
                userId: users[Math.floor(Math.random() * maxUsers)].id
                title: 'Post number ' + (title % 5)
            }
        Post.create(rnd(num), done) for num in [1..maxPosts]

    it 'do some queries using foreign keys', (test) ->
        wait = 4
        done = -> test.done() if --wait == 0
        ts = Date.now()
        query = (num) ->
            users[num].posts { title: 'Post number 3' }, (err, collection) ->
                console.log('User ' + num + ':', collection.length, 'posts in', Date.now() - ts,'ms')
                done()
        query num for num in [0..4]

    return

    it 'should destroy all data', (test) ->
        Post.destroyAll ->
            User.destroyAll(test.done)

Object.keys(schemas).forEach (schemaName) ->
    return if process.env.ONLY && process.env.ONLY != schemaName
    context schemaName, ->
        schema = new Schema schemaName, schemas[schemaName]
        testOrm(schema)

