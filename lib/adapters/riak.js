/**
 * Module dependencies
 */
var riak= require('riak-js');

exports.initialize = function initializeSchema(schema, callback) {
    var config = {
        host = schema.settings.host || '127.0.0.1',
        port = schema.settings.port || 8098
    };

    schema.client = riak_lib.getClient(config);
    schema.adapter = new BridgeToRedis(schema.client);
};

function BridgeToRedis(client) {
    this._models = {};
    this.client = client;
}

BridgeToRedis.prototype.define = function (descr) {
    this._models[descr.model.modelName] = descr;
};

BridgeToRedis.prototype.save = function (model, data, callback) {
    this.client.hmset(model + ':' + data.id, data, callback);
};

BridgeToRedis.prototype.create = function (model, data, callback) {
    this.client.incr(model + ':id', function (err, id) {
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

BridgeToRedis.prototype.all = function all(model, filter, callback) {
    this.client.keys(model + ':*', function (err, keys) {
        if (err) {
            return callback(err, []);
        }
        var query = keys.map(function (key) {
            return ['hgetall', key];
        });
        this.client.multi(query).exec(function (err, replies) {
            callback(err, filter ? replies.filter(applyFilter(filter)) : replies);
        });
    }.bind(this));
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

