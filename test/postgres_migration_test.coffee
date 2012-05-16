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
    query 'CREATE DATABASE ' + db, cb

getColumnDescriptions = (model, cb)->
  query "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.COLUMNS WHERE table_name = '#{model}'", (err, res)->
    if err
      cb err
    else
      fields = {}
      fields[entry.column_name] = entry for entry in res
      cb err, fields

it 'should run migration', (test)->
  withBlankDatabase (err)->
    schema.automigrate ->
      getColumnDescriptions 'User', (err, fields)->
        test.deepEqual fields,
          id:
              column_name: 'id'
              data_type: 'integer'
              is_nullable: 'NO'
              column_default: 'nextval(\'"User_id_seq"\'::regclass)'
          email:
              column_name: 'email'
              data_type: 'character varying'
              is_nullable: 'NO'
              column_default: null
          name:
              column_name: 'name'
              data_type: 'character varying'
              is_nullable: 'YES'
              column_default: null
          bio:
              column_name: 'bio'
              data_type: 'text'
              is_nullable: 'YES'
              column_default: null
          password:
              column_name: 'password'
              data_type: 'character varying'
              is_nullable: 'YES'
              column_default: null
          birthDate:
              column_name: 'birthDate'
              data_type: 'timestamp without time zone'
              is_nullable: 'YES'
              column_default: null
          pendingPeriod:
              column_name: 'pendingPeriod'
              data_type: 'integer'
              is_nullable: 'YES'
              column_default: null
          createdByAdmin:
              column_name: 'createdByAdmin'
              data_type: 'boolean'
              is_nullable: 'YES'
              column_default: null
        test.done()

it 'should autoupdate', (test) ->
  getColumnDescriptions 'User', (err, fields)->

  userExists = (cb) ->
    query 'SELECT * FROM "User"', (err, res) ->
      cb(not err and res[0].email == 'test@example.com')

  User.create email: 'test@example.com', (err, user) ->
    test.ok not err, "error occurred while creating User: #{err}"
    userExists (yep) ->
      test.ok yep, 'userExists returned false'
      User.defineProperty 'email', type: String
      User.defineProperty 'createdByAdmin', type: String
      User.defineProperty 'newProperty', type: Number
      User.defineProperty 'pendingPeriod', false
      schema.autoupdate (err) ->
        getColumnDescriptions 'User', (err, fields) ->
          # email should now be nullable
          test.equal fields.email.is_nullable, 'YES', "email's nullability did not change to nullable"
          # change type of createdByAdmin
          test.equal fields.createdByAdmin.data_type, 'character varying', "createdByAdmin's data type did not change"
          # new column should be added
          test.ok fields.newProperty, 'New column was not added'
          if fields.newProperty
            test.equal fields.newProperty.data_type, 'integer', 'New column type is not integer'
          # pendingPeriod should be dropped
          test.ok not fields.pendingPeriod, 'pendingPeriod was not dropped'

          # user should still exist 
          userExists (yep) ->
            test.ok yep, 'user does not still exist after update'
            test.done()

it 'should check actuality of schema', (test) ->
  # drop column
  User.schema.isActual (err, ok) ->
    test.ok ok, "User is not actual before schema is modified"
    User.defineProperty 'email', false
    User.schema.isActual (err, ok) ->
      test.ok not ok, "User should not be actual after schema is modified"
      test.done()

it 'should disconnect when done', (test)->
  schema.disconnect()
  test.done()
