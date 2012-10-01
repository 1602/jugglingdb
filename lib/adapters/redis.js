var safeRequire = require('../utils').safeRequire;

/**
 * Module dependencies
 */
var redis = safeRequire('redis');

exports.initialize = function initializeSchema(schema, callback) {
    console.log('GOOD NEWS! This redis adapter version is deprecated, use redis2 instead. A lot of improvements, and new indexes incompatible with old (sorry about that): now we only store id and not ModelName:id in indexes. Also dates format in indexes changed to unix timestamp for better sorting and filtering performance');
    if (!redis) return;

    if (schema.settings.url) {
        var url = require('url');
        var redisUrl = url.parse(schema.settings.url);
        var redisAuth = (redisUrl.auth || '').split(':');
        schema.settings.host = redisUrl.hostname;
        schema.settings.port = redisUrl.port;

        if (redisAuth.length == 2) {
            schema.settings.db = redisAuth[0];
            schema.settings.password = redisAuth[1];
        }
    }

    schema.client = redis.createClient(
        schema.settings.port,
        schema.settings.host,
        schema.settings.options
    );
    schema.client.auth(schema.settings.password);
    var callbackCalled = false;
    var database = schema.settings.hasOwnProperty('database') && schema.settings.database;
    schema.client.on('connect', function () {
        if (!callbackCalled && database === false) {
            callbackCalled = true;
            callback();
        } else if (database !== false) {
            if (callbackCalled) {
                return schema.client.select(schema.settings.database);
            } else {
                callbackCalled = true;
                return schema.client.select(schema.settings.database, callback);
            }
        }
    });

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
    deleteNulls(data);
    var log = this.logger('HMSET ' + model + ':' + data.id + ' ...');
    this.client.hmset(model + ':' + data.id, data, function (err) {
        log();
        if (err) return callback(err);
        this.updateIndexes(model, data.id, data, callback);
    }.bind(this));
};

BridgeToRedis.prototype.updateIndexes = function (model, id, data, callback) {
    var i = this.indexes[model];
    var schedule = [['sadd', 's:' + model, id]];
    Object.keys(data).forEach(function (key) {
        if (i[key]) {
            schedule.push([
                'sadd',
                'i:' + model + ':' + key + ':' + data[key],
                model + ':' + id
            ]);
        }
    }.bind(this));

    if (schedule.length) {
        this.client.multi(schedule).exec(function (err) {
            callback(err, data);
        });
    } else {
        callback(null);
    }
};

BridgeToRedis.prototype.create = function (model, data, callback) {
    if (data.id) return create.call(this, data.id, true);

    var log = this.logger('INCR id:' + model);
    this.client.incr('id:' + model, function (err, id) {
        log();
        create.call(this, id);
    }.bind(this));

    function create(id, upsert) {
        data.id = id;
        this.save(model, data, function (err) {
            if (callback) {
                callback(err, id);
            }
        });

        // push the id to the list of user ids for sorting
        log('SADD s:' + model + ' ' + data.id);
        this.client.sadd("s:" + model, upsert ? data : data.id);
    }
};

BridgeToRedis.prototype.updateOrCreate = function (model, data, callback) {
    if (!data.id) return this.create(model, data, callback);
    this.save(model, data, callback);
};

BridgeToRedis.prototype.exists = function (model, id, callback) {
    var log = this.logger('EXISTS ' + model + ':' + id);
    this.client.exists(model + ':' + id, function (err, exists) {
        log();
        if (callback) {
            callback(err, exists);
        }
    });
};

BridgeToRedis.prototype.find = function find(model, id, callback) {
    var t1 = Date.now();
    this.client.hgetall(model + ':' + id, function (err, data) {
        this.log('HGETALL ' + model + ':' + id, t1);
        if (data && Object.keys(data).length > 0) {
            data.id = id;
        } else {
            data = null;
        }
        callback(err, data);
    }.bind(this));
};

BridgeToRedis.prototype.destroy = function destroy(model, id, callback) {
    var t1 = Date.now();
    this.client.del(model + ':' + id, function (err) {
        this.log('DEL ' + model + ':' + id, t1);
        callback(err);
    }.bind(this));
    this.log('SREM s:' + model, t1);
    this.client.srem("s:" + model, id);
};

BridgeToRedis.prototype.possibleIndexes = function (model, filter) {
    if (!filter || Object.keys(filter.where || {}).length === 0) return false;

    var foundIndex = [];
    var noIndex = [];
    Object.keys(filter.where).forEach(function (key) {
        if (this.indexes[model][key] && (typeof filter.where[key] === 'string' || typeof filter.where[key] === 'number')) {
            foundIndex.push('i:' + model + ':' + key + ':' + filter.where[key]);
        } else {
            noIndex.push(key);
        }
    }.bind(this));

    return [foundIndex, noIndex];
};

BridgeToRedis.prototype.all = function all(model, filter, callback) {
    var ts = Date.now();
    var client = this.client;
    var log = this.log;
    var t1 = Date.now();
    var cmd;
    var that = this;
    var sortCmd = [];
    var props = this._models[model].properties;
    var allNumeric = true;

    // TODO: we need strict mode when filtration only possible when we have indexes
    // WHERE
    if (filter && filter.where) {
        var pi = this.possibleIndexes(model, filter);
        var indexes = pi[0];
        var noIndexes = pi[1];

        if (indexes && indexes.length) {
            cmd = 'SINTER "' + indexes.join('" "') + '"';
            if (noIndexes.length) {
                log(model + ': no indexes found for ', noIndexes.join(', '),
                    'slow sorting and filtering');
            }
            indexes.push(noIndexes.length ? orderLimitStageBad : orderLimitStage);
            client.sinter.apply(client, indexes);
        } else {
            // filter manually
            cmd = 'KEYS ' + model + ':*';
            client.keys(model + ':*', orderLimitStageBad);
        }
    } else {
        // no filtering, just sort/limit (if any)
        gotKeys('*');
    }

    // bad case when we trying to filter on non-indexed fields
    // in bad case we need retrieve all data and filter/limit/sort manually
    function orderLimitStageBad(err, keys) {
        log(cmd, t1);
        var t2 = Date.now();
        if (err) {
            return callback(err, []);
        }
        var query = keys.map(function (key) {
            return ['hgetall', key];
        });
        client.multi(query).exec(function (err, replies) {
            log(query, t2);
            gotFilteredData(err, replies.filter(applyFilter(filter)));
        });

        function gotFilteredData(err, nodes) {
            if (err) return callback(null);

            if (filter.order) {
                var allNumeric = true;
                var orders = filter.order;
                if (typeof filter.order === "string") {
                    orders = [filter.order];
                }
                orders.forEach(function (key) {
                    key = key.split(' ')[0];
                    if (props[key].type.name !== 'Number' && props[key].type.name !== 'Date') {
                        allNumeric = false;
                    }
                });
                if (allNumeric) {
                    nodes = nodes.sort(numerically.bind(orders));
                } else {
                    nodes = nodes.sort(literally.bind(orders));
                }
            }

            // LIMIT
            if (filter && filter.limit) {
                var from = (filter.offset || 0), to = from + filter.limit;
                callback(null, nodes.slice(from, to));
            } else {
                callback(null, nodes);
            }
        }
    }

    function orderLimitStage(err, keys) {
        log(cmd, t1);
        var t2 = Date.now();
        if (err) {
            return callback(err, []);
        }

        gotKeys(keys);
    }

    function gotKeys(keys) {

        // ORDER
        var reverse = false;
        if (filter && filter.order) {
            var orders = filter.order;
            if (typeof filter.order === "string"){
                orders = [filter.order];
            }
            orders.forEach(function (key) {
                var m = key.match(/\s+(A|DE)SC$/i);
                if (m) {
                    key = key.replace(/\s+(A|DE)SC/i, '');
                    if (m[1] === 'DE') reverse = true;
                }
                if (key !== 'id') {
                    if (props[key].type.name !== 'Number' && props[key].type.name !== 'Date') {
                        allNumeric = false;
                    }
                }
                sortCmd.push("BY", model + ":*->" + key);
            });
        }

        // LIMIT
        if (keys === '*' && filter && filter.limit){
            var from = (filter.offset || 0), to = from + filter.limit;
            sortCmd.push("LIMIT", from, to);
        }

        // we need ALPHA modifier when sorting string values
        // the only case it's not required - we sort numbers
        // TODO: check if we sort numbers
        if (!allNumeric) {
            sortCmd.push('ALPHA');
        }

        if (reverse) {
            sortCmd.push('DESC');
        }

        if (sortCmd.length) {
            sortCmd.unshift("s:" + model);
            sortCmd.push("GET", "#");
            cmd = "SORT " + sortCmd.join(" ");
            var ttt = Date.now();
            sortCmd.push(function(err, ids){
                if (err) {
                    return callback(err, []);
                }
                log(cmd, ttt);
                var sortedKeys = ids.map(function (i) {
                    return model + ":" + i;
                });
                handleKeys(err, intersect(sortedKeys, keys));
            });
            client.sort.apply(client, sortCmd);
        } else {
            // no sorting or filtering: just get all keys
            if (keys === '*') {
                cmd = 'KEYS ' + model + ':*';
                client.keys(model + ':*', handleKeys);
            } else {
                handleKeys(null, keys);
            }
        }
    }

    function handleKeys(err, keys) {
        var t2 = Date.now();
        var query = keys.map(function (key) {
            return ['hgetall', key];
        });
        client.multi(query).exec(function (err, replies) {
            log(query, t2);
            // console.log('Redis time: %dms', Date.now() - ts);
            callback(err, filter ? replies.filter(applyFilter(filter)) : replies);
        });
    }

    return;

    function numerically(a, b) {
        return a[this[0]] - b[this[0]];
    }

    function literally(a, b) {
        return a[this[0]] > b[this[0]];
    }

    // TODO: find better intersection method
    function intersect(sortedKeys, filteredKeys) {
        if (filteredKeys === '*') return sortedKeys;
        var index = {};
        filteredKeys.forEach(function (x) {
            index[x] = true;
        });
        return sortedKeys.filter(function (x) {
            return index[x];
        });
    }
};

function applyFilter(filter) {
    if (typeof filter.where === 'function') {
        return filter.where;
    }
    var keys = Object.keys(filter.where || {});
    return function (obj) {
        var pass = true;
        if (!obj) return false;
        keys.forEach(function (key) {
            if (!test(filter.where[key], obj[key])) {
                pass = false;
            }
        });
        return pass;
    };

    function test(example, value) {
        if (typeof value === 'string' && example && example.constructor.name === 'RegExp') {
            return value.match(example);
        }
        // not strict equality
        return example == value;
    }
}

BridgeToRedis.prototype.destroyAll = function destroyAll(model, callback) {
    var keysQuery = model + ':*';
    var t1 = Date.now();
    this.client.keys(keysQuery, function (err, keys) {
        this.log('KEYS ' + keysQuery, t1);
        if (err) {
            return callback(err, []);
        }
        var query = keys.map(function (key) {
            return ['del', key];
        });
        var t2 = Date.now();
        this.client.multi(query).exec(function (err, replies) {
            this.log(query, t2);
            this.client.del('s:' + model, function () {
                callback(err);
            });
        }.bind(this));
    }.bind(this));
};

BridgeToRedis.prototype.count = function count(model, callback, where) {
    var keysQuery = model + ':*';
    var t1 = Date.now();
    if (where && Object.keys(where).length) {
        this.all(model, {where: where}, function (err, data) {
            callback(err, err ? null : data.length);
        });
    } else {
        this.client.keys(keysQuery, function (err, keys) {
            this.log('KEYS ' + keysQuery, t1);
            callback(err, err ? null : keys.length);
        }.bind(this));
    }
};

BridgeToRedis.prototype.updateAttributes = function updateAttrs(model, id, data, cb) {
    var t1 = Date.now();
    deleteNulls(data);
    this.client.hmset(model + ':' + id, data, function () {
        this.log('HMSET ' + model + ':' + id, t1);
        this.updateIndexes(model, id, data, cb);
    }.bind(this));
};

function deleteNulls(data) {
    Object.keys(data).forEach(function (key) {
        if (data[key] === null) delete data[key];
    });
}

BridgeToRedis.prototype.disconnect = function disconnect() {
    this.log('QUIT', Date.now());
    this.client.quit();
};

