/**
 * Module dependencies
 */
var util = require('util');
var jutil = require('./jutil');
var Validatable = require('./validatable').Validatable;
var List = require('./list');
var Hookable = require('./hookable').Hookable;
var DEFAULT_CACHE_LIMIT = 1000;
var BASE_TYPES = ['String', 'Boolean', 'Number', 'Date', 'Text'];

exports.AbstractClass = AbstractClass;

AbstractClass.__proto__ = Validatable;
AbstractClass.prototype.__proto__ = Validatable.prototype;
jutil.inherits(AbstractClass, Hookable);

/**
 * Abstract class - base class for all persist objects
 * provides **common API** to access any database adapter.
 * This class describes only abstract behavior layer, refer to `lib/adapters/*.js`
 * to learn more about specific adapter implementations
 *
 * `AbstractClass` mixes `Validatable` and `Hookable` classes methods
 *
 * @constructor
 * @param {Object} data - initial object data
 */
function AbstractClass(data) {
    this._initProperties(data, true);
}

AbstractClass.prototype._initProperties = function (data, applySetters) {
    var self = this;
    var ctor = this.constructor;
    var ds = ctor.schema.definitions[ctor.modelName];
    var properties = ds.properties;
    data = data || {};

    Object.defineProperty(this, '__cachedRelations', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: {}
    });

    Object.defineProperty(this, '__data', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: {}
    });

    Object.defineProperty(this, '__dataWas', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: {}
    });

    for (var i in data) this.__data[i] = this.__dataWas[i] = data[i];

    if (applySetters && ctor.setter) {
        Object.keys(ctor.setter).forEach(function (attr) {
            if (self.__data.hasOwnProperty(attr)) {
                ctor.setter[attr].call(self, self.__data[attr]);
            }
        });
    }

    ctor.forEachProperty(function (attr) {

        if (!self.__data.hasOwnProperty(attr)) {
            self.__data[attr] = self.__dataWas[attr] = getDefault(attr);
        } else {
            self.__dataWas[attr] = self.__data[attr];
        }

    });

    ctor.forEachProperty(function (attr) {

        var type = properties[attr].type;

        if (BASE_TYPES.indexOf(type.name) === -1) {
            if (typeof self.__data[attr] !== 'object' && self.__data[attr]) {
                try {
                    self.__data[attr] = JSON.parse(self.__data[attr] + '');
                } catch (e) {
                    console.log(e.stack);
                }
            }
            if (type.name === 'Array' || typeof type === 'object' && type.constructor.name === 'Array') {
                self.__data[attr] = new List(self.__data[attr], type, self);
            }
        }

    });

    function getDefault(attr) {
        var def = properties[attr]['default'];
        if (isdef(def)) {
            if (typeof def === 'function') {
                return def();
            } else {
                return def;
            }
        } else {
            return null;
        }
    }

    this.trigger("initialize");
}

/**
 * @param {String} prop - property name
 * @param {Object} params - various property configuration
 */
AbstractClass.defineProperty = function (prop, params) {
    this.schema.defineProperty(this.modelName, prop, params);
};

AbstractClass.whatTypeName = function (propName) {
    var ds = this.schema.definitions[this.modelName];
    return ds.properties[propName] && ds.properties[propName].type.name;
};

AbstractClass._forDB = function (data) {
    var res = {};
    Object.keys(data).forEach(function (propName) {
        if (this.whatTypeName(propName) === 'JSON' || data[propName] instanceof Array) {
            res[propName] = JSON.stringify(data[propName]);
        } else {
            res[propName] = data[propName];
        }
    }.bind(this));
    return res;
};

AbstractClass.prototype.whatTypeName = function (propName) {
    return this.constructor.whatTypeName(propName);
};

/**
 * Create new instance of Model class, saved in database
 *
 * @param data [optional]
 * @param callback(err, obj)
 * callback called with arguments:
 *
 *   - err (null or Error)
 *   - instance (null or Model)
 */
AbstractClass.create = function (data, callback) {
    if (stillConnecting(this.schema, this, arguments)) return;

    var modelName = this.modelName;

    if (typeof data === 'function') {
        callback = data;
        data = {};
    }

    if (typeof callback !== 'function') {
        callback = function () {};
    }

    var obj = null;
    // if we come from save
    if (data instanceof this && !data.id) {
        obj = data;
        data = obj.toObject(true);
        obj._initProperties(data, false);
        create();
    } else {
        obj = new this(data);
        data = obj.toObject(true);

        // validation required
        obj.isValid(function (valid) {
            if (!valid) {
                callback(new Error('Validation error'), obj);
            } else {
                create();
            }
        });
    }

    function create() {
        obj.trigger('create', function (done) {

            var data = this.toObject(true);  // Added this to fix the beforeCreate trigger not fire.
                                             // The fix is per issue #72 and the fix was found by by5739.

            this._adapter().create(modelName, this.constructor._forDB(data), function (err, id, rev) {
                if (id) {
                    obj.__data.id = id;
                    obj.__dataWas.id = id;
                    defineReadonlyProp(obj, 'id', id);
                }
                if (rev) {
                    obj._rev = rev
                }
                done.call(this, function () {
                    if (callback) {
                        callback(err, obj);
                    }
                });
            }.bind(this));
        });
    }
};

function stillConnecting(schema, obj, args) {
    if (schema.connected) return false;
    var method = args.callee;
    schema.on('connected', function () {
        method.apply(obj, [].slice.call(args));
    });
    return true;
};

/**
 * Update or insert
 */
AbstractClass.upsert = AbstractClass.updateOrCreate = function upsert(data, callback) {
    if (stillConnecting(this.schema, this, arguments)) return;

    var Model = this;
    if (!data.id) return this.create(data, callback);
    if (this.schema.adapter.updateOrCreate) {
        var inst = new Model(data);
        this.schema.adapter.updateOrCreate(Model.modelName, inst.toObject(), function (err, data) {
            var obj;
            if (data) {
                inst._initProperties(data);
                obj = inst;
            } else {
                obj = null;
            }
            callback(err, obj);
        });
    } else {
        this.find(data.id, function (err, inst) {
            if (err) return callback(err);
            if (inst) {
                inst.updateAttributes(data, callback);
            } else {
                var obj = new Model(data);
                obj.save(data, callback);
            }
        });
    }
};

/**
 * Check whether object exitst in database
 *
 * @param {id} id - identifier of object (primary key value)
 * @param {Function} cb - callbacl called with (err, exists: Bool)
 */
AbstractClass.exists = function exists(id, cb) {
    if (stillConnecting(this.schema, this, arguments)) return;

    if (id) {
        this.schema.adapter.exists(this.modelName, id, cb);
    } else {
        cb(new Error('Model::exists requires positive id argument'));
    }
};

/**
 * Find object by id
 *
 * @param {id} id - primary key value
 * @param {Function} cb - callback called with (err, instance)
 */
AbstractClass.find = function find(id, cb) {
    if (stillConnecting(this.schema, this, arguments)) return;

    this.schema.adapter.find(this.modelName, id, function (err, data) {
        var obj = null;
        if (data) {
            data.id = id;
            obj = new this();
            obj._initProperties(data, false);
        }
        cb(err, obj);
    }.bind(this));
};

/**
 * Find all instances of Model, matched by query
 * make sure you have marked as `index: true` fields for filter or sort
 *
 * @param {Object} params (optional)
 *
 * - where: Object `{ key: val, key2: {gt: 'val2'}}`
 * - order: String
 * - limit: Number
 * - skip: Number
 *
 * @param {Function} callback (required) called with arguments:
 *
 * - err (null or Error)
 * - Array of instances
 */
AbstractClass.all = function all(params, cb) {
    if (stillConnecting(this.schema, this, arguments)) return;

    if (arguments.length === 1) {
        cb = params;
        params = null;
    }
    var constr = this;
    this.schema.adapter.all(this.modelName, params, function (err, data) {
        if (data && data.map) {
            data.forEach(function (d, i) {
                var obj = new constr;
                obj._initProperties(d, false);
                data[i] = obj;
            });
            if (data && data.countBeforeLimit) {
                data.countBeforeLimit = data.countBeforeLimit;
            }
            cb(err, data);
        }
        else
            cb(err, []);
    });
};

/**
 * Find one record, same as `all`, limited by 1 and return object, not collection
 * 
 * @param {Object} params - search conditions
 * @param {Function} cb - callback called with (err, instance)
 */
AbstractClass.findOne = function findOne(params, cb) {
    if (stillConnecting(this.schema, this, arguments)) return;

    if (typeof params === 'function') {
        cb = params;
        params = {};
    }
    params.limit = 1;
    this.all(params, function (err, collection) {
        if (err || !collection || !collection.length > 0) return cb(err);
        cb(err, collection[0]);
    });
};

function substractDirtyAttributes(object, data) {
    Object.keys(object.toObject()).forEach(function (attr) {
        if (data.hasOwnProperty(attr) && object.propertyChanged(attr)) {
            delete data[attr];
        }
    });
}

/**
 * Destroy all records
 * @param {Function} cb - callback called with (err)
 */
AbstractClass.destroyAll = function destroyAll(cb) {
    if (stillConnecting(this.schema, this, arguments)) return;

    this.schema.adapter.destroyAll(this.modelName, function (err) {
        cb(err);
    }.bind(this));
};

/**
 * Return count of matched records
 *
 * @param {Object} where - search conditions (optional)
 * @param {Function} cb - callback, called with (err, count)
 */
AbstractClass.count = function (where, cb) {
    if (stillConnecting(this.schema, this, arguments)) return;

    if (typeof where === 'function') {
        cb = where;
        where = null;
    }
    this.schema.adapter.count(this.modelName, cb, where);
};

/**
 * Return string representation of class
 *
 * @override default toString method
 */
AbstractClass.toString = function () {
    return '[Model ' + this.modelName + ']';
};

/**
 * Save instance. When instance haven't id, create method called instead.
 * Triggers: validate, save, update | create
 * @param options {validate: true, throws: false} [optional]
 * @param callback(err, obj)
 */
AbstractClass.prototype.save = function (options, callback) {
    if (stillConnecting(this.constructor.schema, this, arguments)) return;

    if (typeof options == 'function') {
        callback = options;
        options = {};
    }

    callback = callback || function () {};
    options = options || {};

    if (!('validate' in options)) {
        options.validate = true;
    }
    if (!('throws' in options)) {
        options.throws = false;
    }

    if (options.validate) {
        this.isValid(function (valid) {
            if (valid) {
                save.call(this);
            } else {
                var err = new Error('Validation error');
                // throws option is dangerous for async usage
                if (options.throws) {
                    throw err;
                }
                callback(err, this);
            }
        }.bind(this));
    } else {
        save.call(this);
    }

    function save() {
        this.trigger('save', function (saveDone) {
            var modelName = this.constructor.modelName;
            var data = this.toObject(true);
            var inst = this;
            if (inst.id) {
                inst.trigger('update', function (updateDone) {
                    inst._adapter().save(modelName, inst.constructor._forDB(data), function (err) {
                        if (err) {
                            console.log(err);
                        } else {
                            inst._initProperties(data, false);
                        }
                        updateDone.call(inst, function () {
                            saveDone.call(inst, function () {
                                callback(err, inst);
                            });
                        });
                    });
                }, data);
            } else {
                inst.constructor.create(inst, function (err) {
                    saveDone.call(inst, function () {
                        callback(err, inst);
                    });
                });
            }

        });
    }
};

AbstractClass.prototype.isNewRecord = function () {
    return !this.id;
};

/**
 * Return adapter of current record
 * @private
 */
AbstractClass.prototype._adapter = function () {
    return this.constructor.schema.adapter;
};

/**
 * Convert instance to Object
 *
 * @param {Boolean} onlySchema - restrict properties to schema only, default false
 * when onlySchema == true, only properties defined in schema returned, 
 * otherwise all enumerable properties returned
 * @returns {Object} - canonical object representation (no getters and setters)
 */
AbstractClass.prototype.toObject = function (onlySchema) {
    var data = {};
    var ds = this.constructor.schema.definitions[this.constructor.modelName];
    var properties = ds.properties;
    var self = this;

    this.constructor.forEachProperty(function (attr) {
        if (self[attr] instanceof List) {
            data[attr] = self[attr].toObject();
        } else if (self.__data.hasOwnProperty(attr)) {
            data[attr] = self[attr];
        } else {
            data[attr] = null;
        }
    });

    if (!onlySchema) {
        Object.keys(self).forEach(function (attr) {
            if (!data.hasOwnProperty(attr)) {
                data[attr] = this[attr];
            }
        });
    }

    return data;
};

// AbstractClass.prototype.hasOwnProperty = function (prop) {
//     return this.__data && this.__data.hasOwnProperty(prop) ||
//         Object.getOwnPropertyNames(this).indexOf(prop) !== -1;
// };

AbstractClass.prototype.toJSON = function () {
    return this.toObject();
};

/**
 * Delete object from persistence
 *
 * @triggers `destroy` hook (async) before and after destroying object
 */
AbstractClass.prototype.destroy = function (cb) {
    if (stillConnecting(this.constructor.schema, this, arguments)) return;

    this.trigger('destroy', function (destroyed) {
        this._adapter().destroy(this.constructor.modelName, this.id, function (err) {
            destroyed(function () {
                if(cb) cb(err);
            });
        }.bind(this));
    });
};

/**
 * Update single attribute
 *
 * equals to `updateAttributes({name: value}, cb)
 *
 * @param {String} name - name of property
 * @param {Mixed} value - value of property
 * @param {Function} callback - callback called with (err, instance)
 */
AbstractClass.prototype.updateAttribute = function updateAttribute(name, value, callback) {
    var data = {};
    data[name] = value;
    this.updateAttributes(data, callback);
};

/**
 * Update set of attributes
 *
 * this method performs validation before updating
 *
 * @trigger `validation`, `save` and `update` hooks
 * @param {Object} data - data to update
 * @param {Function} callback - callback called with (err, instance)
 */
AbstractClass.prototype.updateAttributes = function updateAttributes(data, cb) {
    if (stillConnecting(this.constructor.schema, this, arguments)) return;

    var inst = this;
    var model = this.constructor.modelName;

    // update instance's properties
    Object.keys(data).forEach(function (key) {
        inst[key] = data[key];
    });

    inst.isValid(function (valid) {
        if (!valid) {
            if (cb) {
                cb(new Error('Validation error'), inst);
            }
        } else {
            update();
        }
    });

    function update() {
        inst.trigger('save', function (saveDone) {
            inst.trigger('update', function (done) {

                Object.keys(data).forEach(function (key) {
                    data[key] = inst[key];
                });

                inst._adapter().updateAttributes(model, inst.id, inst.constructor._forDB(data), function (err) {
                    if (!err) {
                        // update _was attrs
                        Object.keys(data).forEach(function (key) {
                            inst.__dataWas[key] = inst.__data[key];
                        });
                    }
                    done.call(inst, function () {
                        saveDone.call(inst, function () {
                            cb(err, inst);
                        });
                    });
                });
            }, data);
        });
    }
};

AbstractClass.prototype.fromObject = function (obj) {
    Object.keys(obj).forEach(function (key) {
        this[key] = obj[key];
    }.bind(this));
};

/**
 * Checks is property changed based on current property and initial value
 *
 * @param {String} attr - property name
 * @return Boolean
 */
AbstractClass.prototype.propertyChanged = function propertyChanged(attr) {
    return this.__data[attr] !== this.__dataWas[attr];
};

/**
 * Reload object from persistence
 *
 * @requires `id` member of `object` to be able to call `find`
 * @param {Function} callback - called with (err, instance) arguments
 */
AbstractClass.prototype.reload = function reload(callback) {
    if (stillConnecting(this.constructor.schema, this, arguments)) return;

    this.constructor.find(this.id, callback);
};

/**
 * Reset dirty attributes
 *
 * this method does not perform any database operation it just reset object to it's
 * initial state
 */
AbstractClass.prototype.reset = function () {
    var obj = this;
    Object.keys(obj).forEach(function (k) {
        if (k !== 'id' && !obj.constructor.schema.definitions[obj.constructor.modelName].properties[k]) {
            delete obj[k];
        }
        if (obj.propertyChanged(k)) {
            obj[k] = obj[k + '_was'];
        }
    });
};

/**
 * Declare hasMany relation
 *
 * @param {Class} anotherClass - class to has many
 * @param {Object} params - configuration {as:, foreignKey:}
 * @example `User.hasMany(Post, {as: 'posts', foreignKey: 'authorId'});`
 */
AbstractClass.hasMany = function hasMany(anotherClass, params) {
    var methodName = params.as; // or pluralize(anotherClass.modelName)
    var fk = params.foreignKey;
    // each instance of this class should have method named
    // pluralize(anotherClass.modelName)
    // which is actually just anotherClass.all({where: {thisModelNameId: this.id}}, cb);
    defineScope(this.prototype, anotherClass, methodName, function () {
        var x = {};
        x[fk] = this.id;
        return {where: x};
    }, {
        find: find,
        destroy: destroy
    });

    // obviously, anotherClass should have attribute called `fk`
    anotherClass.schema.defineForeignKey(anotherClass.modelName, fk);

    function find(id, cb) {
        anotherClass.find(id, function (err, inst) {
            if (err) return cb(err);
            if (!inst) return cb(new Error('Not found'));
            if (inst[fk] == this.id) {
                cb(null, inst);
            } else {
                cb(new Error('Permission denied'));
            }
        }.bind(this));
    }

    function destroy(id, cb) {
        this.find(id, function (err, inst) {
            if (err) return cb(err);
            if (inst) {
                inst.destroy(cb);
            } else {
                cb(new Error('Not found'));
            }
        });
    }

};

/**
 * Declare belongsTo relation
 *
 * @param {Class} anotherClass - class to belong
 * @param {Object} params - configuration {as: 'propertyName', foreignKey: 'keyName'}
 *
 * **Usage examples**
 * Suppose model Post have a *belongsTo* relationship with User (the author of the post). You could declare it this way:
 * Post.belongsTo(User, {as: 'author', foreignKey: 'userId'});
 *
 * When a post is loaded, you can load the related author with:
 * post.author(function(err, user) {
 *     // the user variable is your user object
 * });
 *
 * The related object is cached, so if later you try to get again the author, no additional request will be made.
 * But there is an optional boolean parameter in first position that set whether or not you want to reload the cache:
 * post.author(true, function(err, user) {
 *     // The user is reloaded, even if it was already cached.
 * });
 *
 * This optional parameter default value is false, so the related object will be loaded from cache if available.
 */
AbstractClass.belongsTo = function (anotherClass, params) {
    var methodName = params.as;
    var fk = params.foreignKey;

    this.schema.defineForeignKey(this.modelName, fk);
    this.prototype['__finders__'] = this.prototype['__finders__'] || {};

    this.prototype['__finders__'][methodName] = function (id, cb) {
        anotherClass.find(id, function (err,inst) {
            if (err) return cb(err);
            if (!inst) return cb(null, null);
            if (inst[fk] === this.id) {
                cb(null, inst);
            } else {
                cb(new Error('Permission denied'));
            }
        }.bind(this));
    };

    this.prototype[methodName] = function (refresh, p) {
        if (arguments.length === 1) {
            p = refresh;
            refresh = false;
        } else if (arguments.length > 2) {
            throw new Error('Method can\'t be called with more than two arguments');
        }
        var self = this;
        var cachedValue;
        if (!refresh && this.__cachedRelations && (typeof this.__cachedRelations[methodName] !== 'undefined')) {
            cachedValue = this.__cachedRelations[methodName];
        }
        if (p instanceof AbstractClass) { // acts as setter
            this[fk] = p.id;
            this.__cachedRelations[methodName] = p;
        } else if (typeof p === 'function') { // acts as async getter
            if (typeof cachedValue === 'undefined') {
                this.__finders__[methodName](this[fk], function(err, inst) {
                    if (!err) {
                        self.__cachedRelations[methodName] = inst;
                    }
                    p(err, inst);
                });
                return this[fk];
            } else {
                p(null, cachedValue);
                return cachedValue;
            }
        } else if (typeof p === 'undefined') { // acts as sync getter
            return this[fk];
        } else { // setter
            this[fk] = p;
            delete this.__cachedRelations[methodName];
        }
    };

};

/**
 * Define scope
 * TODO: describe behavior and usage examples
 */
AbstractClass.scope = function (name, params) {
    defineScope(this, this, name, params);
};

function defineScope(cls, targetClass, name, params, methods) {

    // collect meta info about scope
    if (!cls._scopeMeta) {
        cls._scopeMeta = {};
    }

    // only makes sence to add scope in meta if base and target classes
    // are same
    if (cls === targetClass) {
        cls._scopeMeta[name] = params;
    } else {
        if (!targetClass._scopeMeta) {
            targetClass._scopeMeta = {};
        }
    }

    Object.defineProperty(cls, name, {
        enumerable: false,
        configurable: true,
        get: function () {
            var f = function caller(condOrRefresh, cb) {
                var actualCond = {};
                var actualRefresh = false;
                var saveOnCache = true;
                if (arguments.length === 1) {
                    cb = condOrRefresh;
                } else if (arguments.length === 2) {
                    if (typeof condOrRefresh === 'boolean') {
                        actualRefresh = condOrRefresh;
                    } else {
                        actualCond = condOrRefresh;
                        actualRefresh = true;
                        saveOnCache = false;
                    }
                } else {
                    throw new Error('Method can be only called with one or two arguments');
                }

                if (!this.__cachedRelations || (typeof this.__cachedRelations[name] == 'undefined') || actualRefresh) {
                    var self = this;
                    return targetClass.all(mergeParams(actualCond, caller._scope), function(err, data) {
                        if (!err && saveOnCache) {
                            self.__cachedRelations[name] = data;
                        }
                        cb(err, data);
                    });
                } else {
                    cb(null, this.__cachedRelations[name]);
                }
            };
            f._scope = typeof params === 'function' ? params.call(this) : params;
            f.build = build;
            f.create = create;
            f.destroyAll = destroyAll;
            for (var i in methods) {
                f[i] = methods[i].bind(this);
            }

            // define sub-scopes
            Object.keys(targetClass._scopeMeta).forEach(function (name) {
                Object.defineProperty(f, name, {
                    enumerable: false,
                    get: function () {
                        mergeParams(f._scope, targetClass._scopeMeta[name]);
                        return f;
                    }
                });
            }.bind(this));
            return f;
        }
    });

    // and it should have create/build methods with binded thisModelNameId param
    function build(data) {
        return new targetClass(mergeParams(this._scope, {where:data || {}}).where);
    }

    function create(data, cb) {
        if (typeof data === 'function') {
            cb = data;
            data = {};
        }
        this.build(data).save(cb);
    }

    /*
        Callback
        - The callback will be called after all elements are destroyed
        - For every destroy call which results in an error
        - If fetching the Elements on which destroyAll is called results in an error
    */
    function destroyAll(cb) {
        targetClass.all(this._scope, function (err, data) {
            if (err) {
                cb(err);
            } else {
                (function loopOfDestruction (data) {
                    if(data.length > 0) {
                        data.shift().destroy(function(err) {
                            if(err && cb) cb(err);
                            loopOfDestruction(data);
                        });
                    } else {
                        if(cb) cb();
                    }
                }(data));
            }
        });
    }

    function mergeParams(base, update) {
        if (update.where) {
            base.where = merge(base.where, update.where);
        }

        // overwrite order
        if (update.order) {
            base.order = update.order;
        }

        return base;

    }
}

AbstractClass.prototype.inspect = function () {
    return util.inspect(this.__data, false, 4, true);
};


/**
 * Check whether `s` is not undefined
 * @param {Mixed} s
 * @return {Boolean} s is undefined
 */
function isdef(s) {
    var undef;
    return s !== undef;
}

/**
 * Merge `base` and `update` params
 * @param {Object} base - base object (updating this object)
 * @param {Object} update - object with new data to update base
 * @returns {Object} `base`
 */
function merge(base, update) {
    base = base || {};
    if (update) {
        Object.keys(update).forEach(function (key) {
            base[key] = update[key];
        });
    }
    return base;
}

/**
 * Define readonly property on object
 *
 * @param {Object} obj
 * @param {String} key
 * @param {Mixed} value
 */
function defineReadonlyProp(obj, key, value) {
    Object.defineProperty(obj, key, {
        writable: false,
        enumerable: true,
        configurable: true,
        value: value
    });
}

