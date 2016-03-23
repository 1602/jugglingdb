/**
 * Dependencies
 */
var when = require('when');
var i8n = require('inflection');
var defineScope = require('./scope.js').defineScope;

/**
 * Relations mixins for ./model.js
 */
var Model = require('./model.js');

Model.relationNameFor = function relationNameFor(foreignKey) {
    for (var rel in this.relations) {
        if (this.relations[rel].type === 'belongsTo' && this.relations[rel].keyFrom === foreignKey) {
            return rel;
        }
    }
};

/**
 * Declare hasMany relation
 *
 * @param {Model} anotherClass - class to has many
 * @param {Object} params - configuration {as:, foreignKey:}
 * @example `User.hasMany(Post, {as: 'posts', foreignKey: 'authorId'});`
 */
Model.hasMany = function hasMany(anotherClass, params) {
    var thisClass = this, thisClassName = this.modelName;
    params = params || {};
    if (typeof anotherClass === 'string') {
        params.as = anotherClass;
        if (params.model) {
            anotherClass = params.model;
        } else {
            var anotherClassName = i8n.singularize(anotherClass).toLowerCase();
            for(var name in this.schema.models) {
                if (name.toLowerCase() === anotherClassName) {
                    anotherClass = this.schema.models[name];
                }
            }
        }
    }
    var methodName = params.as ||
        i8n.camelize(i8n.pluralize(anotherClass.modelName), true);
    var fk = params.foreignKey || i8n.camelize(thisClassName + '_id', true);

    this.relations[methodName] = {
        type: 'hasMany',
        keyFrom: 'id',
        keyTo: fk,
        modelTo: anotherClass,
        multiple: true
    };
    // each instance of this class should have method named
    // pluralize(anotherClass.modelName)
    // which is actually just anotherClass.all({where: {thisModelNameId: this.id}}, cb);
    var scopeMethods = {
        find: find,
        destroy: destroy
    };
    if (params.through) {

        // Append through relation, like modelTo
        this.relations[methodName].modelThrough = params.through;

        var fk2 = i8n.camelize(anotherClass.modelName + '_id', true);
        scopeMethods.create = function create(data, done) {
            if (typeof data !== 'object') {
                done = data;
                data = {};
            }
            var self = this;
            var id = this.id;
            return anotherClass.create(data)
                .then(function(ac) {
                    var d = {};
                    d[params.through.relationNameFor(fk)] = self;
                    d[params.through.relationNameFor(fk2)] = ac;
                    return params.through.create(d)
                        .then(function() {
                            return ac;
                        })
                        .catch(function(e) {
                            return ac.destroy()
                                .then(function() {
                                    throw e;
                                });
                        });
                })
                .then(function(ac) {
                    if ('function' === typeof done) {
                        done(null, ac);
                    } else {
                        return ac;
                    }
                })
                .catch(function(err) {
                    if ('function' === typeof done) {
                        done(err, ac);
                    } else {
                        throw err;
                    }
                });
        };
        scopeMethods.add = function(acInst, data, done) {
            if (typeof data === 'function') {
                done = data;
                data = {};
            }
            if (typeof data === 'undefined') {
                data = {};
            }
            var query = {};
            query[fk] = this.id;
            data[params.through.relationNameFor(fk)] = this;
            query[fk2] = acInst.id || acInst;
            data[params.through.relationNameFor(fk2)] = acInst;
            return params.through.findOrCreate({where: query}, data)
                .then(function(through) {
                    if ('function' === typeof done) {
                        done(null, through);
                    } else {
                        return through;
                    }
                })
                .catch(function(err) {
                    if ('function' === typeof done) {
                        done(err);
                    } else {
                        throw err;
                    }
                });
        };
        scopeMethods.remove = function(acInst, done) {
            var q = {};
            q[fk] = this.id;
            q[fk2] = acInst.id || acInst;
            return params.through.findOne({where: q})
                .then(function(d) {
                    if (d) {
                        return d.destroy();
                    }
                })
                .then(function() {
                    if ('function' === typeof done) {
                        done();
                    }
                })
                .catch(function(e) {
                    if ('function' === typeof done) {
                        done(e);
                    } else {
                        throw e;
                    }
                });
        };
        delete scopeMethods.destroy;
    }

    defineScope(this.prototype, params.through || anotherClass, methodName, function () {
        var filter = {};
        filter.where = {};
        filter.where[fk] = this.id;
        if (params.through) {
            filter.collect = i8n.camelize(anotherClass.modelName, true);
            filter.include = filter.collect;
        }
        return filter;
    }, scopeMethods);

    if (!params.through) {
        // obviously, anotherClass should have attribute called `fk`
        anotherClass.schema.defineForeignKey(anotherClass.modelName, fk, this.modelName);
    }

    function find(id, cb) {
        var id_ = this.id;
        return anotherClass.find(id)
            .then(function(inst) {
                if (!inst) {
                    throw new Error('Not found');
                }
                if (inst[fk] && inst[fk].toString() == id_.toString()) {
                    if ('function' === typeof cb) {
                        cb(null, inst);
                    } else {
                        return inst;
                    }
                } else {
                    throw new Error('Permission denied');
                }
            })
            .catch(function(err) {
                if ('function' === typeof cb) {
                    cb(err);
                } else {
                    throw err;
                }
            });
    }

    function destroy(id, cb) {
        var id_ = this.id;
        return anotherClass.find(id)
            .then(function (inst) {
                if (!inst) {
                    throw new Error('Not found');
                }
                if (inst[fk] && inst[fk].toString() == id_.toString()) {
                    return inst.destroy()
                        .then(function() {
                            if ('function' === typeof cb) {
                                cb();
                            }
                        });
                } else {
                    throw new Error('Permission denied');
                }
            })
            .catch(function(err) {
                if ('function' === typeof cb) {
                    cb(err);
                } else {
                    throw err;
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
Model.belongsTo = function (anotherClass, params) {
    params = params || {};
    if ('string' === typeof anotherClass) {
        params.as = anotherClass;
        if (params.model) {
            anotherClass = params.model;
        } else {
            var anotherClassName = anotherClass.toLowerCase();
            for(var name in this.schema.models) {
                if (name.toLowerCase() === anotherClassName) {
                    anotherClass = this.schema.models[name];
                }
            }
        }
    }
    var methodName = params.as || i8n.camelize(anotherClass.modelName, true);
    var fk = params.foreignKey || methodName + 'Id';

    this.relations[methodName] = {
        type: 'belongsTo',
        keyFrom: fk,
        keyTo: 'id',
        modelTo: anotherClass,
        multiple: false
    };

    this.schema.defineForeignKey(this.modelName, fk, anotherClass.modelName);
    this.prototype.__finders__ = this.prototype.__finders__ || {};

    this.prototype.__finders__[methodName] = function (id) {
        if (id === null || !this[fk]) {
            return when.resolve(null);
        }
        var fk_ = this[fk].toString();
        return anotherClass.find(id)
            .then(function (inst) {
                if (!inst) {
                    return null;
                }
                if (inst.id.toString() === fk_) {
                    return inst;
                } else {
                    throw new Error('Permission denied');
                }
            });
    };

    this.prototype[methodName] = function (p) {
        var self = this;
        var cachedValue = this.__cachedRelations && this.__cachedRelations[methodName];
        // acts as setter
        if (p instanceof Model) {
            this.__cachedRelations[methodName] = p;
            return this.updateAttribute(fk, p.id);
        }
        // acts as async getter
        if (typeof cachedValue === 'undefined') {
            return this.__finders__[methodName].call(self, this[fk])
                .then(function(inst) {
                    self.__cachedRelations[methodName] = inst;
                    if ('function' === typeof p) {
                        p(null, inst);
                    } else {
                        return inst;
                    }
                });
        }
        // return cached relation
        if ('function' === typeof p) {
            p(null, cachedValue);
        } else {
            return when.resolve(cachedValue);
        }
    };

};

/**
 * Many-to-many relation
 *
 * Post.hasAndBelongsToMany('tags'); creates connection model 'PostTag'
 */
Model.hasAndBelongsToMany = function hasAndBelongsToMany(anotherClass, params) {
    params = params || {};
    var models = this.schema.models;

    if ('string' === typeof anotherClass) {
        params.as = anotherClass;
        if (params.model) {
            anotherClass = params.model;
        } else {
            anotherClass = lookupModel(i8n.singularize(anotherClass)) ||
                anotherClass;
        }
        if (typeof anotherClass === 'string') {
            throw new Error('Could not find "' + anotherClass + '" relation for ' + this.modelName);
        }
    }

    if (!params.through) {
        var name1 = this.modelName + anotherClass.modelName;
        var name2 = anotherClass.modelName + this.modelName;
        params.through = lookupModel(name1) || lookupModel(name2) ||
            this.schema.define(name1);
    }
    params.through.belongsTo(this);
    params.through.belongsTo(anotherClass);

    this.hasMany(anotherClass, {as: params.as, through: params.through});

    function lookupModel(modelName) {
        var lookupClassName = modelName.toLowerCase();
        for (var name in models) {
            if (name.toLowerCase() === lookupClassName) {
                return models[name];
            }
        }
    }

};
