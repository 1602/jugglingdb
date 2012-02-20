juggling = require('../index')
Schema = juggling.Schema
Text = Schema.Text

DBNAME = process.env.DBNAME || 'myapp_test'
DBUSER = process.env.DBUSER || 'root'
DBPASS = ''
DBENGINE = process.env.DBENGINE || 'mysql'

require('./spec_helper').init module.exports

schema = new Schema DBENGINE, database: '', username: DBUSER, password: DBPASS
schema.log = (q) -> console.log q

query = (sql, cb) ->
    schema.adapter.query sql, cb

User = schema.define 'User',
    email: { type: String, null: false, index: true }
    name: String
    bio: Text
    password: String
    birthDate: Date
    pendingPeriod: Number
    createdByAdmin: Boolean

withBlankDatabase = (cb) ->
    db = schema.settings.database = DBNAME
    query 'DROP DATABASE IF EXISTS ' + db, (err) ->
        query 'CREATE DATABASE ' + db, (err) ->
            query 'USE '+ db, cb

getFields = (model, cb) ->
    query 'SHOW FIELDS FROM ' + model, (err, res) ->
        if err
            cb err
        else
            fields = {}
            res.forEach (field) -> fields[field.Field] = field
            cb err, fields

it 'should run migration', (test) ->
    withBlankDatabase (err) ->
        schema.automigrate ->
            getFields 'User', (err, fields) ->
                test.deepEqual fields,
                    id:
                        Field: 'id'
                        Type: 'int(11)'
                        Null: 'NO'
                        Key: 'PRI'
                        Default: null
                        Extra: 'auto_increment'
                    email:
                        Field: 'email'
                        Type: 'varchar(255)'
                        Null: 'NO'
                        Key: ''
                        Default: null
                        Extra: ''
                    name:
                        Field: 'name'
                        Type: 'varchar(255)'
                        Null: 'YES'
                        Key: ''
                        Default: null
                        Extra: '' 
                    bio:
                        Field: 'bio'
                        Type: 'text'
                        Null: 'YES'
                        Key: ''
                        Default: null
                        Extra: ''
                    password:
                        Field: 'password'
                        Type: 'varchar(255)'
                        Null: 'YES'
                        Key: ''
                        Default: null
                        Extra: ''
                    birthDate:
                        Field: 'birthDate'
                        Type: 'datetime'
                        Null: 'YES'
                        Key: ''
                        Default: null
                        Extra: ''
                    pendingPeriod:
                        Field: 'pendingPeriod'
                        Type: 'int(11)'
                        Null: 'YES'
                        Key: ''
                        Default: null
                        Extra: ''
                    createdByAdmin:
                        Field: 'createdByAdmin'
                        Type: 'tinyint(1)'
                        Null: 'YES'
                        Key: ''
                        Default: null
                        Extra: ''

                test.done()

it 'should autoupgrade', (test) ->
    userExists = (cb) ->
        query 'SELECT * FROM User', (err, res) ->
            cb(not err and res[0].email == 'test@example.com')

    User.create email: 'test@example.com', (err, user) ->
        test.ok not err
        userExists (yep) ->
            test.ok yep
            User.defineProperty 'email', type: String
            User.defineProperty 'name', type: String, limit: 50
            User.defineProperty 'newProperty', type: Number
            User.defineProperty 'pendingPeriod', false
            schema.autoupdate (err) ->
                getFields 'User', (err, fields) ->
                    # change nullable for email
                    test.equal fields.email.Null, 'YES', 'Email is not null'
                    # change type of name
                    test.equal fields.name.Type, 'varchar(50)', 'Name is not varchar(50)'
                    # add new column
                    test.ok fields.newProperty, 'New column was not added'
                    if fields.newProperty
                        test.equal fields.newProperty.Type, 'int(11)', 'New column type is not int(11)'
                    # drop column
                    test.ok not fields.pendingPeriod, 'drop column'

                    # user still exists
                    userExists (yep) ->
                        test.ok yep
                        test.done()

it 'should check actuality of schema', (test) ->
    # drop column
    User.schema.isActual (err, ok) ->
        test.ok ok
        User.defineProperty 'email', false
        User.schema.isActual (err, ok) ->
            test.ok not ok
            test.done()

it 'should disconnect when done', (test) ->
    schema.disconnect()
    test.done()

