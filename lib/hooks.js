/**
 * Module exports
 */
exports.Hookable = Hookable;

/**
 * Hooks mixins for ./model.js
 */
var Hookable = require('./model.js');

/**
 * List of hooks available
 */
Hookable.afterInitialize = null;
Hookable.beforeValidate = null;
Hookable.afterValidate = null;
Hookable.beforeSave = null;
Hookable.afterSave = null;
Hookable.beforeCreate = null;
Hookable.afterCreate = null;
Hookable.beforeUpdate = null;
Hookable.afterUpdate = null;
Hookable.beforeDestroy = null;
Hookable.afterDestroy = null;

Hookable.prototype.trigger = function trigger(actionName, work, data, quit) {
    var capitalizedName = capitalize(actionName);
    var beforeHook = this.constructor["before" + capitalizedName];
    var afterHook = this.constructor["after" + capitalizedName];
    if (actionName === 'validate') {
        beforeHook = beforeHook || this.constructor.beforeValidation;
        afterHook = afterHook || this.constructor.afterValidation;
    }
    var inst = this;

    // we only call "before" hook when we have actual action (work) to perform
    if (work) {
        if (beforeHook) {
            // before hook should be called on instance with one param: callback
            beforeHook.call(inst, function (err) {
                if (err) {
                    if (quit) {
                        quit(err);
                    }
                    return;
                }
                // actual action also have one param: callback
                work.call(inst, next);
            }, data);
        } else {
            work.call(inst, next);
        }
    } else {
        next();
    }

    function next(done) {
        if (afterHook) {
            afterHook.call(inst, done);
        } else if (done) {
            done.call(this);
        }
    }
};

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
