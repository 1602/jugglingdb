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

    if (data.id) {
        defineReadonlyProp(this, 'id', data.id);
    }

    Object.defineProperty(this, 'cachedRelations', {
        writable: true,
        enumerable: false,
        configurable: true,
        value: {}
    });

    Object.keys(properties).forEach(function (attr) {
        var _attr    = '_' + attr,
            attr_was = attr + '_was';

        // Hidden property to store currrent value
        Object.defineProperty(this, _attr, {
            writable: true,
            enumerable: false,
            configurable: true,
            value: isdef(data[attr]) ? data[attr] :
            (isdef(this[attr]) ? this[attr] : (
                getDefault(attr)
            ))
        });

        var type = properties[attr].type;

        if (BASE_TYPES.indexOf(type.name) === -1) {
            if (typeof this[_attr] !== 'object' && this[_attr]) {
                try {
                    this[_attr] = JSON.parse(this[_attr] + '');
                } catch (e) {
                    console.log(e.stack);
                }
            }
            if (type.name === 'Array' || typeof type === 'object' && type.constructor.name === 'Array') {
                this[_attr] = new List(this[_attr], type, this);
            }
        }

        // Public setters and getters
        Object.defineProperty(this, attr, {
            get: function () {
                if (ctor.getter[attr]) {
                    return ctor.getter[attr].call(this);
                } else {
                    return this[_attr];
                }
            },
            set: function (value) {
                if (ctor.setter[attr]) {
                    ctor.setter[attr].call(this, value);
                } else {
                    this[_attr] = value;
                }
            },
            configurable: true,
            enumerable: true
        });

        if (data.hasOwnProperty(attr)) {
            if (applySetters && ctor.setter[attr]) {
                ctor.setter[attr].call(this, data[attr]);
            }

            // Getter for initial property
            Object.defineProperty(this, attr_was, {
                writable: true,
                value: this[_attr],
                configurable: true,
                enumerable: false
            });
        }

    }.bind(this));

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

AbstractClass.setter = {};
AbstractClass.getter = {};

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
    if (data instanceof AbstractClass && !data.id) {
        obj = data;
        data = obj.toObject(true);
        this.prototype._initProperties.call(obj, data, false);
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

            this._adapter().create(modelName, this.constructor._forDB(data), function (err, id) {
                if (id) {
                    defineReadonlyProp(obj, 'id', id);
                    addToCache(this.constructor, obj);
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
            if (obj) {
                addToCache(Model, obj);
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
            var cached = getCached(this, data.id);
            if (cached) {
                obj = cached;
                substractDirtyAttributes(obj, data);
                // maybe just obj._initProperties(data); instead of
                this.prototype._initProperties.call(obj, data);
            } else {
                data.id = id;
                obj = new this();
                obj._initProperties(data, false);
                addToCache(this, id);
            }
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
        var collection = null;
        if (data && data.map) {
            collection = data.map(function (d) {
                var obj = null;
                // do not create different instances for the same object
                var cached = d && getCached(constr, d.id);
                if (cached) {
                    obj = cached;
                    // keep dirty attributes untouthed (remove from dataset)
                    substractDirtyAttributes(obj, d);
                    // maybe just obj._initProperties(d);
                    constr.prototype._initProperties.call(obj, d);
                } else {
                    obj = new constr;
                    obj._initProperties(d, false);
                    if (obj.id) addToCache(constr, obj);
                }
                return obj;
            });
            if (data && data.countBeforeLimit) {
                collection.countBeforeLimit = data.countBeforeLimit;
            }
            cb(err, collection);
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
        clearCache(this);
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
    // weird
    Object.keys(onlySchema ? properties : this).concat(['id']).forEach(function (property) {
        if (this[property] instanceof List) {
            data[property] = this[property].toObject();
        } else {
            data[property] = this[property];
        }
    }.bind(this));
    return data;
};

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
            removeFromCache(this.constructor, this.id);
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
                cb(new Error('Validation error'));
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
                        inst._initProperties(data, false);
                        /*
                        Object.keys(data).forEach(function (key) {
                            inst[key] = data[key];
                            Object.defineProperty(inst, key + '_was', {
                                writable:     false,
                                configurable: true,
                                enumerable:   false,
                                value:        data[key]
                            });
                        });
                        */
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
    return this['_' + attr] !== this[attr + '_was'];
};

/**
 * Reload object from persistence
 *
 * @requires `id` member of `object` to be able to call `find`
 * @param {Function} callback - called with (err, instance) arguments
 */
AbstractClass.prototype.reload = function reload(callback) {
    if (stillConnecting(this.constructor.schema, this, arguments)) return;

    var obj = getCached(this.constructor, this.id);
    if (obj) obj.reset();
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

    this.prototype[methodName] = function (p) {
        if (p instanceof AbstractClass) { // acts as setter
            this[fk] = p.id;
            this.cachedRelations[methodName] = p;
        } else if (typeof p === 'function') { // acts as async getter
            this.__finders__[methodName](this[fk], p);
            return this[fk];
        } else if (typeof p === 'undefined') { // acts as sync getter
            return this[fk];
        } else { // setter
            this[fk] = p;
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

    // anly make sence to add scope in meta if base and target classes
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
            var f = function caller(cond, cb) {
                var actualCond;
                if (arguments.length === 1) {
                    actualCond = {};
                    cb = cond;
                } else if (arguments.length === 2) {
                    actualCond = cond;
                } else {
                    throw new Error('Method only can be called with one or two arguments');
                }

                return targetClass.all(mergeParams(actualCond, caller._scope), cb);
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
        data = data || {};
        return new targetClass(mergeParams(this._scope, {where:data}).where);
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

/**
 * Add object to cache
 */
function addToCache(constr, obj) {
    return;
    touchCache(constr, obj.id);
    constr.cache[obj.id] = obj;
}

/**
 * Renew object position in LRU cache index
 */
function touchCache(constr, id) {
    var cacheLimit = constr.CACHE_LIMIT || DEFAULT_CACHE_LIMIT;

    var ind = constr.mru.indexOf(id);
    if (~ind) constr.mru.splice(ind, 1);
    if (constr.mru.length >= cacheLimit * 2) {
        for (var i = 0; i < cacheLimit;i += 1) {
            delete constr.cache[constr.mru[i]];
        }
        constr.mru.splice(0, cacheLimit);
    }
}

/**
 * Retrieve cached object
 */
function getCached(constr, id) {
    if (id) touchCache(constr, id);
    return id && constr.cache[id];
}

/**
 * Clear cache (fully)
 *
 * removes both cache and LRU index
 *
 * @param {Class} constr - class constructor
 */
function clearCache(constr) {
    constr.cache = {};
    constr.mru = [];
}

/**
 * Remove object from cache
 *
 * @param {Class} constr
 * @param {id} id
 */
function removeFromCache(constr, id) {
    var ind = constr.mru.indexOf(id);
    if (!~ind) constr.mru.splice(ind, 1);
    delete constr.cache[id];
}

