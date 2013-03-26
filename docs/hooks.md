jugglingdb-hooks(3) - Hooks and object lifecycle.
===================

## DESCRIPTION

Hook is a class method called on object when some event happens. List of events:

* initialize - called after `new Model` called
* create - called before and after create
* update - called before and after save (except create)
* save   - called before and after save (including both create and update)
* validate - called before and after validations
* destroy - called before and after destroy on instance

Each hook except `initialize` accepts callback as first argument. This callback
should be called when hook done. All hooks called on object instance, but it's
not recommended to use `this` for updating in all hooks where data argument
available (second arguments for all data-related before-hooks: save, update,
create).

## INITIALIZE

Initialize hook called when new object created after all setters and default
being applied.

    Model.afterInitialize = function() {
        this.property = 'some value;
        console.log('afterInitialize called');
    };
    new Model; // afterInitialize called

## CREATE

Create hooks called when object created.
The `beforeCreate` hook accepts data as second arguments.

    Model.beforeCreate = function(next, data) {
        // use data argument to update object
        data.createdAt = new Date();
        console.log('before');
        next();
    };

    Model.afterCreate = function(next) {
        this.notifySocialNetworks();
        this.sendEmailNotifications();
        console.log('after');
        next();
    };

    Model.create({foo: 'bar'}, function(err, model) {
        console.log('callback');
    });

Example output will be:

    before
    after
    callback

## UPDATE

Update hooks called on each save except create. 
The `beforeUpdate` hook accepts data as second arguments.
Data argument only containing actual data for update, not full object data.

    Model.beforeUpdate = function(next, data) {
        // use data argument to update object
        // in update hook data argumen only contains data for update (not
        // full object)
        data.updatedAt = new Date();
        console.log('before');
        next();
    };

    Model.afterUpdate = function(next) {
        this.scheduleFulltextIndexUpdate();
        console.log('after');
        next();
    };

    model.updateAttributes({foo: 'bar'}, function(err, model) {
        console.log('callback');
    });

Example output will be:

    before
    after
    callback

## SAVE

Save hooks called on each save, both update and create.
The `beforeSave` hook accepts data as second arguments.
For before save hook data argument is the same as this.

    Model.beforeSave = function(next, data) {
        data.tags = JSON.parse(data.tags);
        next();
    };

    Model.afterSave = function(next) {
        next();
    };

## DESTROY

Destroy hooks called when `model.destroy()` called. Please note that
`destroyAll` method doesn't call destroy hooks.

## VALIDATE

Validate hooks callen before and after validation and should be used for data
modification and not for validation. Use custom validation described in
jugglingdb-validations(3) man section.

## SEE ALSO

jugglingdb-model(3)
jugglingdb-validations(3)
