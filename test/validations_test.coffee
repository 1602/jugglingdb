juggling = require('../index')
Schema = juggling.Schema
AbstractClass = juggling.AbstractClass
Validatable = juggling.Validatable

require('./spec_helper').init module.exports

schema = new Schema 'memory'
User = schema.define 'User',
    email: String
    name: String
    password: String
    state: String
    age: Number
    gender: String
    domain: String
    pendingPeriod: Number
    createdByAdmin: Boolean
    updatedAt: Date

validAttributes =
    name: 'Anatoliy'
    email: 'email@example.com'
    state: ''
    age: 26
    gender: 'male'
    domain: '1602'
    createdByAdmin: false
    createdByScript: true

getValidAttributes = ->
    name: 'Anatoliy'
    email: 'email@example.com'
    state: ''
    age: 26
    gender: 'male'
    domain: '1602'
    createdByAdmin: false
    createdByScript: true

it 'should validate presence', (test) ->
    User.validatesPresenceOf 'email', 'name'

    user = new User
    test.ok not user.isValid(), 'User is not valid'
    test.ok user.errors.email, 'Attr email in errors'
    test.ok user.errors.name, 'Attr name in errors'

    user.name = 'Anatoliy'
    test.ok not user.isValid(), 'User is still not valid'
    test.ok user.errors.email, 'Attr email still in errors'
    test.ok not user.errors.name, 'Attr name valid'

    user.email = 'anatoliy@localhost'
    test.ok user.isValid(), 'User is valid'
    test.ok not user.errors, 'No errors'
    test.ok not user.errors.email, 'Attr email valid'
    test.ok not user.errors.name, 'Attr name valid'
    test.done()

it 'should allow to skip validations', (test) ->
    User.validatesPresenceOf 'pendingPeriod', if: 'createdByAdmin'
    User.validatesLengthOf 'domain', is: 2, unless: 'createdByScript'

    user = new User validAttributes
    test.ok user.isValid()

    user.createdByAdmin = true
    test.ok not user.isValid()
    test.ok user.errors.pendingPeriod.length

    user.pendingPeriod = 1
    test.ok user.isValid()

    user.createdByScript = false
    test.ok not user.isValid()
    test.ok user.errors.domain.length

    user.domain = '12'
    test.ok user.isValid()

    User.validatesLengthOf 'domain', is: 3, unless: -> @domain != 'xyz'
    test.ok user.isValid()

    user.domain = 'xyz'
    test.ok not user.isValid() # is: 3 passed, but is: 2 failed


    test.done()

it 'should throw error on save if required', (test) ->
    user = new User

    test.throws () ->
        user.save throws: true

    test.done()


it 'should allow to skip validation on save', (test) ->
    user = new User
    test.ok user.isNewRecord(), 'User not saved yet'
    test.ok not user.isValid(), 'User not valid'

    user.save validate: false

    test.ok not user.isNewRecord(), 'User saved'
    test.ok not user.isValid(), 'User data still not valid'
    test.done()

it 'should perform validation on updateAttributes', (test) ->
    User.create email: 'anatoliy@localhost', name: 'anatoliy', (err, user) ->
        user.updateAttributes name: null, (err, name) ->
            test.ok(err)
            test.ok user.errors
            test.ok user.errors.name
            test.done()

it 'should perform validation on create', (test) ->
    User.create (err, user) ->
        test.ok err, 'We have an error'
        # we got an user,
        test.ok user, 'We got an user'
        # but it's not saved
        test.ok user.isNewRecord(), 'User not saved'
        # and we have errors
        test.ok user.errors, 'User have errors'
        # explaining what happens
        test.ok user.errors.name, 'Errors contain name'
        test.ok user.errors.email, 'Errors contain email'

        test.done()

it 'should validate length', (test) ->
    User.validatesLengthOf 'password', min: 3, max: 10, allowNull: true
    User.validatesLengthOf 'state', is: 2, allowBlank: true
    user = new User validAttributes

    user.password = 'qw'
    test.ok not user.isValid(), 'Invalid: too short'
    test.equal user.errors.password[0], 'too short'

    user.password = '12345678901'
    test.ok not user.isValid(), 'Invalid: too long'
    test.equal user.errors.password[0], 'too long'

    user.password = 'hello'
    test.ok user.isValid(), 'Valid with value'
    test.ok not user.errors

    user.password = null
    test.ok user.isValid(), 'Valid without value'
    test.ok not user.errors

    user.state = 'Texas'
    test.ok not user.isValid(), 'Invalid state'
    test.equal user.errors.state[0], 'length is wrong'

    user.state = 'TX'
    test.ok user.isValid(), 'Valid with value of state'
    test.ok not user.errors

    test.done()

it 'should validate numericality', (test) ->
    User.validatesNumericalityOf 'age', int: true
    user = new User validAttributes

    user.age = '26'
    test.ok not user.isValid(), 'User is not valid: not a number'
    test.equal user.errors.age[0], 'is not a number'

    user.age = 26.1
    test.ok not user.isValid(), 'User is not valid: not integer'
    test.equal user.errors.age[0], 'is not an integer'

    user.age = 26
    test.ok user.isValid(), 'User valid: integer age'
    test.ok not user.errors

    test.done()

it 'should validate inclusion', (test) ->
    User.validatesInclusionOf 'gender', in: ['male', 'female']
    user = new User validAttributes

    user.gender = 'any'
    test.ok not user.isValid()
    test.equal user.errors.gender[0], 'is not included in the list'

    user.gender = 'female'
    test.ok user.isValid()

    user.gender = 'male'
    test.ok user.isValid()

    user.gender = 'man'
    test.ok not user.isValid()
    test.equal user.errors.gender[0], 'is not included in the list'

    test.done()

it 'should validate exclusion', (test) ->
    User.validatesExclusionOf 'domain', in: ['www', 'admin']
    user = new User validAttributes

    user.domain = 'www'
    test.ok not user.isValid()
    test.equal user.errors.domain[0], 'is reserved'

    user.domain = 'my'
    test.ok user.isValid()

    test.done()

it 'should validate format', (test) ->
    User.validatesFormatOf 'email', with: /^([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})$/i
    user = new User validAttributes

    user.email = 'invalid email'
    test.ok not user.isValid()

    user.email = 'valid@email.tld'
    test.ok user.isValid()

    test.done()

it 'should validate a field using a custom validator', (test) ->

    validator = (err) ->
        err('crash') if @name == 'bad name'

    User.validate 'name', validator, message: crash: 'custom message'

    user = new User validAttributes
    test.ok user.isValid()

    user = new User validAttributes
    user.name = 'bad name'
    test.ok not user.isValid(), 'invalid due custom name validator'
    test.equal user.errors.name[0], 'custom message'

    test.done()

it 'should validate asynchronously', (test) ->

    validator = (err, done) ->
        setTimeout =>
            err 'async' if @name == 'bad name'
            done()
        , 10

    User.validateAsync 'name', validator, message: async: 'hello'

    user = new User validAttributes
    test.ok not user.isValid(), 'not valid because async validation'
    user.isValid (valid) ->
        test.ok valid, 'valid name'

        user.name = 'bad name'
        user.isValid (valid) ->
            test.ok not valid, 'not valid name'
            test.done()

it 'should validate uniqueness', (test) ->
    User.validatesUniquenessOf 'email'
    User.create getValidAttributes(), (err, user) ->
        user = new User getValidAttributes()

        # test.ok not user.isValid(), 'not valid because async validation'
        user.isValid (valid) ->
            test.ok not valid, 'email is not unique'
            user.email = 'unique@email.tld'
            user.isValid (valid) ->
                test.ok valid, 'valid with unique email'
                user.save (err) ->
                    test.ok not user.propertyChanged('email'), 'Email changed'
                    user.updateAttributes { updatedAt: new Date, createdByAdmin: false }, (err) ->
                        User.all where: email: 'unique@email.tld', (err, users) ->
                            test.ok users[0]
                            test.ok users[0].email == 'unique@email.tld'
                            test.ok !err, 'Updated'
                            test.done()

it 'should save dirty state when validating uniqueness', (test) ->
    User.all where: email: 'unique@email.tld', (err, users) ->
        u = users[0]
        u.name = 'Hulk'
        u.isValid (valid) ->
            test.ok valid, 'Invalid user'
            test.equal u.name, 'Hulk'
            test.done()

