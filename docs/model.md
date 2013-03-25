jugglingdb-model(3) - Model methods, features and internals
===================

## DESCRIPTION

This section describes common methods of models managed by jugglingdb and
explains some model internals, such as data representation, setters, getters and
virtual attributes.

## DB WRITE METHODS

Database write methods performs hooks and validations. See jugglingdb-hooks(3)
and jugglingdb-validations(3) to learn how hooks and validations works.

### Model.create([data[, callback]]);

Create instance of Model with given data and save to database.
Invoke callback when ready. Callback accepts two arguments: error and model
instance.

    User.create({name: 'Jared Hanson'}, function(err, user) {
        console.log(user instanceof User);
    });

### Model.prototype.save([options[, callback]]);

Save instance to database, options is an object {validate: true, throws: false},
it allows to turn off validation (turned on by default) and throw error on
validation error (doesn't throws by default).

    user.email = 'incorrect email';
    user.save({throws: true}, callback); // will throw ValidationError
    user.save({validate: false}, callback); // will save incorrect data
    user.save(function(err, user) {
        console.log(err); // ValidationError
        console.log(user.errors); // some errors
    });

### Model.prototype.updateAttributes(data[, callback]);

Save specified attributes database.
Invoke callback when ready. Callback accepts two arguments: error and model
instance.

    user.updateAttributes({
        email: 'new-email@example.com',
        name: 'New Name'
    }, callback);

### Model.prototype.updateAttribute(key, value[, callback]);

Shortcut for updateAttributes, but for one field, works in the save way as
updateAttributes.

    user.updateAttribute('email', 'new-email@example.com', callback);

### Model.upsert(data, callback)

Update when record with id=data.id found, insert otherwise. Be aware: no
setters, validations or hooks applied when use upsert. This is seed-friendly
method.

### Model.prototype.destroy([callback]);

Delete database record.
Invoke callback when ready. Callback accepts two arguments: error and model
instance.

    model.destroy(function(err) {
        // model instance destroyed
    });

### Model.destroyAll(callback)

Delete all Model instances from database. Be aware: `destroyAll` method doesn't
perform destroy hooks.

## DB READ METHODS

### Model.find(id, callback);

Find instance by id.
Invoke callback when ready. Callback accepts two arguments: error and model
instance.

### Model.all([params, ]callback);

Find all instances of Model, matched by query. Fields used for filter and sort
should be declared with `{index: true}` in model definition.

* `param`:
  * where: Object `{ key: val, key2: {gt: 'val2'}}`
  * include: String, Object or Array. See AbstractClass.include documentation.
  * order: String
  * limit: Number
  * skip: Number

* `callback`:
 Accepts two arguments:
  * err (null or Error)
  * Array of instances

### Model.count([query, ]callback);

Query count of instances stored in database. Optional `query` param allows to
count filtered set of records. Callback called with error and count arguments.

    User.count({approved: true}, function(err, count) {
        console.log(count); // count of approved users stored in database
    });

## ESSENTIALS

### Default values

## SEE ALSO

jugglingdb-schema(3)
jugglingdb-validations(3)
jugglingdb-hooks(3)
jugglingdb-adapter(3)
