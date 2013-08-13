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

When called with array of objects as first argument `Model.create` creates bunch
of records. Both `err` and `model instance` arguments passed to callback will be
arrays then. When no errors happened `err` argument will be null.

The value returned from `Model.create` depends on second argument too. In case
of Array it will return an array of instances, otherwise single instance. But be
away, this instance(s) aren't save to database yet and you have to wait until
callback called to be able to do id-sensitive stuff.

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

### Model.iterate(options, iterator, callback)

Iterate through dataset and perform async method iterator. This method designed
to work with large datasets loading data by batches. First argument (options) is
optional and have same signature as for Model.all, it has additional member
`batchSize` which allows to specify size of batch loaded into memory from the
database.

Iterator argument is a function that accepts three arguments: item, callback and
index in collection.

    Model.iterate({batchSize: 100}, function(obj, next, i) {
        doSomethingAsync(obj, next);
    }, function(err) {
        // all done
    });

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

## RELATIONS

### hasMany

Define all necessary stuff for "one to many" relation:

* foreign key in "many" model
* named scope in "one" model

Example:

    var Book = db.define('Book');
    var Chapter = db.define('Chapters');

    // syntax 1 (old):
    Book.hasMany(Chapter);
    // syntax 2 (new):
    Book.hasMany('chapters');

Syntax 1 and 2 does same things in different ways: adds `chapters` method to
`Book.prototype` and add `bookId` property to `Chapter` model. Foreign key name
(`bookId`) could be specified manually using second param:

    Book.hasMany('chapters', {foreignKey: `chapter_id`});

When using syntax 2 jugglingdb looking for model with singularized name:

    'chapters' => 'chapter' => 'Chapter'

But it's possible to specify model manually using second param:

    Book.hasMany('stories', {model: Chapter});

Syntax 1 allows to override scope name using `as` property of second param:

    Book.hasMany(Chapter, {as: 'stories'});

**Scope methods** created on BaseClass by hasMany allows to build, create and
query instances of other class. For example:

    Book.create(function(err, book) {
        // using 'chapters' scope for build:
        var c = book.chapters.build({name: 'Chapter 1'});
        // same as:
        c = new Chapter({name: 'Chapter 1', bookId: book.id});
        // using 'chapters' scope for create:
        book.chapters.create();
        // same as:
        Chapter.create({bookId: book.id});

        // using scope for querying:
        book.chapters(function() {/* all chapters with bookId = book.id */ });
        book.chapters({where: {name: 'test'}, function(err, chapters) {
            // all chapters with bookId = book.id and name = 'test'
        });
    });

### belongsTo

TODO: document

### hasAndBelongsToMany

TODO: document

## SEE ALSO

jugglingdb-schema(3)
jugglingdb-validations(3)
jugglingdb-hooks(3)
jugglingdb-adapter(3)
