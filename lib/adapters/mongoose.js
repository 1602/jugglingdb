var safeRequire = require('../utils').safeRequire;

/**
 * Module dependencies
 */
var mongoose = safeRequire('mongoose');

exports.initialize = function initializeSchema(schema, callback) {
    if (!mongoose) return;

    if (!schema.settings.url) {
        var url = schema.settings.host || 'localhost';
        if (schema.settings.port) url += ':' + schema.settings.port;
        var auth = '';
        if (schema.settings.username) {
            auth = schema.settings.username;
            if (schema.settings.password) {
                auth += ':' + schema.settings.password;
            }
        }
        if (auth) {
            url = auth + '@' + url;
        }
        if (schema.settings.database) {
            url += '/' + schema.settings.database;
        } else {
            url += '/';
        }
        url = 'mongodb://' + url;
        schema.settings.url = url;
    }
    if (!schema.settings.rs) {
        schema.client = mongoose.connect(schema.settings.url);
    } else {
        schema.client = mongoose.connectSet(schema.settings.url, {rs_name: schema.settings.rs});
    }
    
    schema.adapter = new MongooseAdapter(schema.client);
    process.nextTick(callback);
};

function MongooseAdapter(client) {
    this._models = {};
    this.client = client;
    this.cache = {};
}

MongooseAdapter.prototype.define = function (descr) {
    var props = {};
    Object.keys(descr.properties).forEach(function (key) {
        props[key] = descr.properties[key].type;
        if (props[key].name === 'Text' || props[key].name === 'JSON') props[key] = String;
    });
    var schema = new mongoose.Schema(props);
    this._models[descr.model.modelName] = mongoose.model(descr.model.modelName, schema);
    this.cache[descr.model.modelName] = {};
};

MongooseAdapter.prototype.defineForeignKey = function (model, key, cb) {
    var piece = {};
    piece[key] = {type: mongoose.Schema.ObjectId, index: true};
    this._models[model].schema.add(piece);
    cb(null, String);
};

MongooseAdapter.prototype.setCache = function (model, instance) {
    this.cache[model][instance.id] = instance;
};

MongooseAdapter.prototype.getCached = function (model, id, cb) {
    if (this.cache[model][id]) {
        cb(null, this.cache[model][id]);
    } else {
        this._models[model].findById(id, function (err, instance) {
            if (err) {
                return cb(err);
            }
            this.cache[model][id] = instance;
            cb(null, instance);
        }.bind(this));
    }
};

MongooseAdapter.prototype.create = function (model, data, callback) {
    var m = new this._models[model](data);
    m.save(function (err) {
        callback(err, err ? null : m.id);
    });
};

MongooseAdapter.prototype.save = function (model, data, callback) {
    this.getCached(model, data.id, function (err, inst) {
        if (err) {
            return callback(err);
        }
        merge(inst, data);
        inst.save(callback);
    });
};

MongooseAdapter.prototype.exists = function (model, id, callback) {
    delete this.cache[model][id];
    this.getCached(model, id, function (err, data) {
        if (err) {
            return callback(err);
        }
        callback(err, !!data);
    });
};

MongooseAdapter.prototype.find = function find(model, id, callback) {
    delete this.cache[model][id];
    this.getCached(model, id, function (err, data) {
        if (err) {
            return callback(err);
        }
        callback(err, data ? data.toObject() : null);
    });
};

MongooseAdapter.prototype.destroy = function destroy(model, id, callback) {
    this.getCached(model, id, function (err, data) {
        if (err) {
            return callback(err);
        }
        if (data) {
            data.remove(callback);
        } else {
            callback(null);
        }
    });
};

MongooseAdapter.prototype.all = function all(model, filter, callback) {
    if (!filter) {
        filter = {};
    }
    var query = this._models[model].find({});
    if (filter.where) {
        Object.keys(filter.where).forEach(function (k) {
            var cond = filter.where[k];
            var spec = false;
            if (cond && cond.constructor.name === 'Object') {
                spec = Object.keys(cond)[0];
                cond = cond[spec];
            }
            if (spec) {
                if (spec === 'between') {
                    query.where(k).gte(cond[0]).lte(cond[1]);
                } else {
                    query.where(k)[spec](cond);
                }
            } else {
                query.where(k, cond);
            }
        });
    }
    if (filter.order) {
        var m = filter.order.match(/\s+(A|DE)SC$/);
        var key = filter.order;
        var reverse = false;
        if (m) {
            key = key.replace(/\s+(A|DE)SC$/, '');
            if (m[1] === 'DE') reverse = true;
        }
        if (reverse) {
            query.sort('-' + key);
        } else {
            query.sort(key);
        }
    }
    if (filter.limit) {
        query.limit(filter.limit);
    }
    if (filter.skip) {
        query.skip(filter.skip);
    } else if (filter.offset) {
        query.skip(filter.offset);
    }
    query.exec(function (err, data) {
        if (err) return callback(err);
        callback(null, data);
    });
};

MongooseAdapter.prototype.destroyAll = function destroyAll(model, callback) {
    var wait = 0;
    this._models[model].find(function (err, data) {
        if (err) return callback(err);
        wait = data.length;
        if (!data.length) return callback(null);
        data.forEach(function (obj) {
            obj.remove(done)
        });
    });

    var error = null;
    function done(err) {
        error = error || err;
        if (--wait === 0) {
            callback(error);
        }
    }

};

MongooseAdapter.prototype.count = function count(model, callback, where) {
    this._models[model].count(where || {}, callback);
};

MongooseAdapter.prototype.updateAttributes = function updateAttrs(model, id, data, cb) {
    this.getCached(model, id, function (err, inst) {
        if (err) {
            return cb(err);
        } else if (inst) {
            merge(inst, data);
            inst.save(cb);
        } else cb();
    });
};

MongooseAdapter.prototype.disconnect = function () {
    this.client.connection.close();
};

function merge(base, update) {
    Object.keys(update).forEach(function (key) {
        base[key] = update[key];
    });
    return base;
}

