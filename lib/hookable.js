exports.Hookable = Hookable;

function Hookable() {
    // hookable class
};

Hookable.afterInitialize = function(){};
Hookable.beforeValidation = function(){};
Hookable.afterValidation = function(){};
Hookable.beforeSave = function(){};
Hookable.afterSave = function(){};
Hookable.beforeCreate = function(){};
Hookable.afterCreate = function(){};
Hookable.beforeUpdate = function(){};
Hookable.afterUpdate = function(){};
Hookable.beforeDestroy = function(){};
Hookable.afterDestroy = function(){};

Hookable.prototype.trigger = function (action, work){
    if (work) {
        bHook = this.constructor["before" + capitalize(action)];
        if (bHook) bHook.call(this);

        work.call(this);
    }
    aHook = this.constructor["after" + capitalize(action)];
    if (aHook) aHook.call(this);
};

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
