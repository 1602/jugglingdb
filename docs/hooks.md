jugglingdb-hooks(3) - Hooks and object lifecycle.
===================

## DESCRIPTION

Hook is a class method called on object when some event happens. List of events:

* `initialize`:
Called after `new Model` called.

* `create`:
Called before and after create.

* `update`:
Called before and after save (except create).

* `save`:
Called before and after save (including both create and update).

* `validate`:
Called before and after validations.

* `destroy`:
Called before and after destroy on instance.


Each hook except `initialize` accepts callback as the first argument. This callback
should be called when hook is done. All hooks are called on object instance, but it's
not recommended to use `this` for updating all hooks where data argument is
available (second argument for all data-related before-hooks: save, update,
create).

## INITIALIZE

Initialize hook called when new object created after all setters and defaults
being applied.

    Model.afterInitialize = function() {
        this.property = 'some value;
        console.log('afterInitialize called');
    };
    new Model; // afterInitialize called

## CREATE

Create hooks is being called when object is created.
The `beforeCreate` hook accepts `data` as a second argument.

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
The `beforeUpdate` hook accepts data as second argument.
The data argument contains only actual data for update, not full object data.

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

Save hooks called on each save, both during update and create.
The `beforeSave` hook accepts `data` as a second argument. For this cook hook `data` argument is the same as `this` when model.save() is called.  When model.updateAttributes() called data argument contains only actual changes. 

    Model.beforeSave = function(next, data) {
        if ('string' !== typeof data.tags) {
            data.tags = JSON.stringify(data.tags);
        }
        next();
    };

    Model.afterSave = function(next) {
        next();
    };

## DESTROY

Hook is called once `model.destroy()` is called. Please note that
`destroyAll` method doesn't call destroy hooks.

    Model.beforeDestroy = function(next, data) {
        next();
    };

    Model.afterDestroy = function(next) {
        next();
    };

## VALIDATE

Validate hooks called before and after validation and should be used for data
modification and not for validation. Use custom validation described in
jugglingdb-validations(3) man section.

## SEE ALSO

jugglingdb-model(3)
jugglingdb-validations(3)
