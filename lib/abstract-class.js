/**
 * Module deps
 */
var Validatable = require('./validatable').Validatable;
var Hookable = require('./hookable').Hookable;
var util = require('util');
var jutil = require('./jutil');

exports.AbstractClass = AbstractClass;

jutil.inherits(AbstractClass, Validatable);
jutil.inherits(AbstractClass, Hookable);

/**
 * Abstract class constructor
 */
function AbstractClass(data) {
    var self = this;
    var ds = this.constructor.schema.definitions[this.constructor.modelName];
    var properties = ds.properties;
    var settings = ds.setings;
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

        // Public setters and getters
        Object.defineProperty(this, attr, {
            get: function () {
                if (this.constructor.getter[attr]) {
                    return this.constructor.getter[attr].call(this);
                } else {
                    return this[_attr];
                }
            },
            set: function (value) {
                if (this.constructor.setter[attr]) {
                    this.constructor.setter[attr].call(this, value);
                } else {
                    this[_attr] = value;
                }
            },
            configurable: true,
            enumerable: true
        });

        if (data.hasOwnProperty(attr)) {
            // Getter for initial property
            Object.defineProperty(this, attr_was, {
                writable: true,
                value: data[attr],
                configurable: true,
                enumerable: false
            });
        }

    }.bind(this));

    function getDefault(attr) {
        var def = properties[attr]['default']
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
};

AbstractClass.setter = {};
AbstractClass.getter = {};

AbstractClass.defineProperty = function (prop, params) {
    this.schema.defineProperty(this.modelName, prop, params);
};

AbstractClass.whatTypeName = function (propName) {
    var ds = this.schema.definitions[this.modelName];
    return ds.properties[propName].type.name;
};

AbstractClass.prototype.whatTypeName = function (propName) {
    return this.constructor.whatTypeName(propName);
};

/**
 * @param data [optional]
 * @param callback(err, obj)
 */
AbstractClass.create = function (data, callback) {
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
        // recall constructor to update _was property states (maybe bad idea)
        this.call(obj, data);
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
            this._adapter().create(modelName, data, function (err, id) {
                if (id) {
                    defineReadonlyProp(obj, 'id', id);
                    this.constructor.cache[id] = obj;
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

AbstractClass.exists = function exists(id, cb) {
    if (id) {
        this.schema.adapter.exists(this.modelName, id, cb);
    } else {
        cb(new Error('Model::exists requires positive id argument'));
    }
};

AbstractClass.find = function find(id, cb) {
    this.schema.adapter.find(this.modelName, id, function (err, data) {
        var obj = null;
        if (data) {
            if (this.cache[data.id]) {
                obj = this.cache[data.id];
                substractDirtyAttributes(obj, data);
                this.call(obj, data);
            } else {
                data.id = id;
                obj = new this(data);
                this.cache[data.id] = obj;
            }
        }
        cb(err, obj);
    }.bind(this));
};

/**
 * Query collection of objects
 * @param params {where: {}, order: '', limit: 1, offset: 0,...}
 * @param cb (err, array of AbstractClass)
 */
AbstractClass.all = function all(params, cb) {
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
                if (d.id && constr.cache[d.id]) {
                    obj = constr.cache[d.id];
                    // keep dirty attributes untouthed (remove from dataset)
                    substractDirtyAttributes(obj, d);
                    constr.call(obj, d);
                } else {
                    obj = new constr(d);
                    if (d.id) constr.cache[d.id] = obj;
                }
                return obj;
            });
            cb(err, collection);
        }
    });
};

AbstractClass.findOne = function findOne(params, cb) {
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

AbstractClass.destroyAll = function destroyAll(cb) {
    this.schema.adapter.destroyAll(this.modelName, function (err) {
        if (!err) {
            Object.keys(this.cache).forEach(function (id) {
                delete this.cache[id];
            }.bind(this));
        }
        cb(err);
    }.bind(this));
};

AbstractClass.count = function (where, cb) {
    if (typeof where === 'function') {
        cb = where;
        where = null;
    }
    this.schema.adapter.count(this.modelName, cb, where);
};

AbstractClass.toString = function () {
    return '[Model ' + this.modelName + ']';
}

/**
 * Save instance. When instance haven't id, create method called instead.
 * Triggers: validate, save, update | create
 * @param options {validate: true, throws: false} [optional]
 * @param callback(err, obj)
 */
AbstractClass.prototype.save = function (options, callback) {
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
                    inst._adapter().save(modelName, data, function (err) {
                        if (err) {
                            console.log(err);
                        } else {
                            inst.constructor.call(inst, data);
                        }
                        updateDone.call(inst, function () {
                            saveDone.call(inst, function () {
                                callback(err, inst);
                            });
                        });
                    });
                });
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

AbstractClass.prototype._adapter = function () {
    return this.constructor.schema.adapter;
};

AbstractClass.prototype.propertyChanged = function (name) {
    return this[name + '_was'] !== this['_' + name];
};

AbstractClass.prototype.toObject = function (onlySchema) {
    var data = {};
    var ds = this.constructor.schema.definitions[this.constructor.modelName];
    var properties = ds.properties;
    // weird
    Object.keys(onlySchema ? properties : this).concat(['id']).forEach(function (property) {
        data[property] = this[property];
    }.bind(this));
    return data;
};

AbstractClass.prototype.destroy = function (cb) {
    this.trigger('destroy', function (destroyed) {
        this._adapter().destroy(this.constructor.modelName, this.id, function (err) {
            delete this.constructor.cache[this.id];
            destroyed(function () {
                cb && cb(err);
            });
        }.bind(this));
    });
};

AbstractClass.prototype.updateAttribute = function (name, value, cb) {
    data = {};
    data[name] = value;
    this.updateAttributes(data, cb);
};

AbstractClass.prototype.updateAttributes = function updateAttributes(data, cb) {
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

                inst._adapter().updateAttributes(model, inst.id, data, function (err) {
                    if (!err) {
                        inst.constructor.call(inst, data);
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
                            cb(err);
                        });
                    });
                });
            });
        });
    }
};

/**
 * Checks is property changed based on current property and initial value
 * @param {attr} String - property name
 * @return Boolean
 */
AbstractClass.prototype.propertyChanged = function (attr) {
    return this['_' + attr] !== this[attr + '_was'];
};

AbstractClass.prototype.reload = function (cb) {
    var obj = this.constructor.cache[this.id];
    if (obj) {
        obj.reset();
    }
    this.constructor.find(this.id, cb);
};

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

// relations
AbstractClass.hasMany = function (anotherClass, params) {
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
            if (inst[fk] === this.id) {
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

AbstractClass.belongsTo = function (anotherClass, params) {
    var methodName = params.as;
    var fk = params.foreignKey;

    this.schema.defineForeignKey(this.modelName, fk);
    this.prototype['__finders__'] = this.prototype['__finders__'] || {}

    this.prototype['__finders__'][methodName] = function (id, cb) {
        anotherClass.find(id, function (err,inst) {
            if (err) return cb(err);
            if (inst[fk] === this.id) {
                cb(null, inst);
            } else {
                cb(new Error('Permission denied'));
            }
        }.bind(this));
    }

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
                f[i] = methods;
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

    function destroyAll(id, cb) {
        // implement me
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

// helper methods
//
function isdef(s) {
    var undef;
    return s !== undef;
}

function merge(base, update) {
    base = base || {};
    if (update) {
        Object.keys(update).forEach(function (key) {
            base[key] = update[key];
        });
    }
    return base;
}

function defineReadonlyProp(obj, key, value) {
    Object.defineProperty(obj, key, {
        writable: false,
        enumerable: true,
        configurable: true,
        value: value
    });
}

