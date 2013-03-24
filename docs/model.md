jugglingdb-model(3) - Model methods, features and internals
===================

## DESCRIPTION

This section describes common methods of models managed by jugglingdb and
explains some model internals, such as data representation, setters, getters and
virtual attributes.

## ESSENTIALS

### Default values

## DB WRITE METHODS

### Model.create([data[, callback]])

Create instance of Model with given data and save to database, invoke callback
when ready. Callback accepts two arguments: error and model instance.

### Model.updateAttributes(data[, callback]);
### Model.updateAttributes(data[, callback]);

## DB READ METHODS

### Model.all([params[, callback]])

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

## SEE ALSO

jugglingdb-schema(3)
jugglingdb-validations(3)
jugglingdb-hooks(3)
jugglingdb-adapter(3)
