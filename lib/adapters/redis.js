/**
 * Module dependencies
 */
var redis = require('redis');

exports.initialize = function initializeSchema(schema, callback) {
    schema.client = redis.createClient(
        schema.settings.port,
        schema.settings.host,
        schema.settings.options
    );

    schema.client.auth(schema.settings.password, callback);

    schema.adapter = new BridgeToRedis(schema.client);
};

function BridgeToRedis(client) {
    this._models = {};
    this.client = client;
    this.indexes = {};
}

BridgeToRedis.prototype.define = function (descr) {
    var m = descr.model.modelName;
    this._models[m] = descr;
    this.indexes[m] = {};
    Object.keys(descr.properties).forEach(function (prop) {
        if (descr.properties[prop].index) {
            this.indexes[m][prop] = descr.properties[prop].type;
        }
    }.bind(this));
};

BridgeToRedis.prototype.defineForeignKey = function (model, key, cb) {
    this.indexes[model][key] = Number;
    cb(null, Number);
};

BridgeToRedis.prototype.save = function (model, data, callback) {
    this.client.hmset(model + ':' + data.id, data, function (err) {
        if (err) return callback(err);
        this.updateIndexes(model, data, callback);
    }.bind(this));
};

BridgeToRedis.prototype.updateIndexes = function (model, data, callback) {
    var i = this.indexes[model];
    var schedule = [];
    Object.keys(data).forEach(function (key) {
        if (i[key]) {
            schedule.push([
                'sadd',
                'i:' + model + ':' + key + ':' + data[key],
                model + ':' + data.id
            ]);
        }
    }.bind(this));

    if (schedule.length) {
        this.client.multi(schedule).exec(function (err) {
            callback(err);
        });
    } else {
        callback(null);
    }
};

BridgeToRedis.prototype.create = function (model, data, callback) {
    this.client.incr('id:' + model, function (err, id) {
        data.id = id;
        this.save(model, data, function (err) {
            if (callback) {
                callback(err, id);
            }
        });
    }.bind(this));
};

BridgeToRedis.prototype.exists = function (model, id, callback) {
    this.client.exists(model + ':' + id, function (err, exists) {
        if (callback) {
            callback(err, exists);
        }
    });
};

BridgeToRedis.prototype.find = function find(model, id, callback) {
    this.client.hgetall(model + ':' + id, function (err, data) {
        if (data && data.id) {
            data.id = id;
        } else {
            data = null;
        }
        callback(err, data);
    });
};

BridgeToRedis.prototype.destroy = function destroy(model, id, callback) {
    this.client.del(model + ':' + id, function (err) {
        callback(err);
    });
};

BridgeToRedis.prototype.possibleIndexes = function (model, filter) {
    if (!filter || Object.keys(filter).length === 0) return false;

    var foundIndex = [];
    Object.keys(filter).forEach(function (key) {
        if (this.indexes[model][key]) {
            foundIndex.push('i:' + model + ':' + key + ':' + filter[key]);
        }
    }.bind(this));

    return foundIndex;
};

BridgeToRedis.prototype.all = function all(model, filter, callback) {
    var ts = Date.now();
    var client = this.client;

    var indexes = this.possibleIndexes(model, filter);
    if (indexes.length) {
        indexes.push(handleKeys);
        client.sinter.apply(client, indexes);
    } else {
        client.keys(model + ':*', handleKeys);
    }

    function handleKeys(err, keys) {
        if (err) {
            return callback(err, []);
        }
        var query = keys.map(function (key) {
            return ['hgetall', key];
        });
        client.multi(query).exec(function (err, replies) {
            // console.log('Redis time: %dms', Date.now() - ts);
            callback(err, filter ? replies.filter(applyFilter(filter)) : replies);
        });
    }
};

function applyFilter(filter) {
    if (typeof filter === 'function') {
        return filter;
    }
    var keys = Object.keys(filter);
    return function (obj) {
        var pass = true;
        keys.forEach(function (key) {
            if (!test(filter[key], obj[key])) {
                pass = false;
            }
        });
        return pass;
    }

    function test(example, value) {
        if (typeof value === 'string' && example && example.constructor.name === 'RegExp') {
            return value.match(example);
        }
        // not strict equality
        return example == value;
    }
}

BridgeToRedis.prototype.destroyAll = function destroyAll(model, callback) {
    this.client.keys(model + ':*', function (err, keys) {
        if (err) {
            return callback(err, []);
        }
        var query = keys.map(function (key) {
            return ['del', key];
        });
        this.client.multi(query).exec(function (err, replies) {
            callback(err);
        });
    }.bind(this));
};

BridgeToRedis.prototype.count = function count(model, callback) {
    this.client.keys(model + ':*', function (err, keys) {
        callback(err, err ? null : keys.length);
    });
};

BridgeToRedis.prototype.updateAttributes = function updateAttrs(model, id, data, cb) {
    this.client.hmset(model + ':' + id, data, cb);
};

