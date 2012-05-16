juggling = require('../index')
Schema = juggling.Schema
Text = Schema.Text

DBNAME = process.env.DBNAME || 'myapp_test' #this db must already exist and will be destroyed
DBUSER = process.env.DBUSER || 'root'
DBPASS = ''
DBENGINE = process.env.DBENGINE || 'postgres'

require('./spec_helper').init module.exports

schema = new Schema DBENGINE, database: '', username: DBUSER, password: DBPASS
schema.log = (q) -> console.log q

query = (sql, cb) ->
  schema.adapter.query sql, cb

User = schema.define 'User',
  name: {type: String, default: "guest"}
  credits: {type: Number, default: 0}

withBlankDatabase = (cb) ->
  db = schema.settings.database = DBNAME
  query 'DROP DATABASE IF EXISTS ' + db, (err) ->
    query 'CREATE DATABASE ' + db, ->
      schema.automigrate(cb)

it 'default values should not interfere with fully specified objects', (test)->
  withBlankDatabase (err)->
    test.ok !err, "error while setting up blank database"
    new User()
    User.create {name: "Steve", credits: 47}, (err, obj)->
      console.log "error creating user: #{err}"
      test.ok !err, "error occurred when saving user with all values specified"
      test.ok obj.id?, 'saved object has no id'
      console.log "id: #{obj.id}"
      test.equals obj.name, "Steve", "User's name didn't save correctly"
      test.equals obj.credits, 47, "User's credits didn't save correctly"
      test.done()

it 'objects should have default values when some fields are unspecified', (test)->
  User.create {credits: 2}, (err, obj)->
    console.log "error creating user: #{err}"
    test.ok !err, "error occurred when saving user with some values unspecified"
    test.ok obj.id?, 'saved object has no id'
    test.equals obj.name, "guest", "User's name didn't save correctly"
    test.equals obj.credits, 2, "User's credits didn't save correctly"
    User.create {name: "Jeanette Adele McKenzie"}, (err, obj)->
      console.log "error creating user: #{err}"
      test.ok !err, "error occurred when saving user with some values unspecified"
      test.ok obj.id?, 'saved object has no id'
      test.equals obj.name, "Jeanette Adele McKenzie", "User's name didn't save correctly"
      test.equals obj.credits, 0, "User's credits didn't save correctly"
      test.done()

it 'objects should have default values when all fields are left unspecified', (test)->
  User.create {}, (err, obj)->
    console.log "error creating user: #{err}"
    test.ok !err, "error occurred when saving user with all values specified"
    test.ok obj.id?, 'saved object has no id'
    test.equals obj.name, "guest", "User's name didn't save correctly"
    test.equals obj.credits, 0, "User's credits didn't save correctly"
    test.done()

it 'should disconnect when done', (test)->
  schema.disconnect()
  test.done()
