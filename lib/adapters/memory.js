exports.initialize = function initializeSchema(schema, callback) {
    schema.adapter = new Memory();
    schema.adapter.connect(callback);
};

function Memory(m) {
    if (m) {
        this.isTransaction = true;
        this.cache = m.cache;
        this.ids = m.ids;
        this._models = m._models;
    } else {
        this.isTransaction = false;
        this.cache = {};
        this.ids = {};
        this._models = {};
    }
}

Memory.prototype.connect = function(callback) {
    if (this.isTransaction) {
        this.onTransactionExec = callback;
    } else {
        process.nextTick(callback);
    }
};

Memory.prototype.define = function defineModel(descr) {
    var m = descr.model.modelName;
    this._models[m] = descr;
    this.cache[m] = {};
    this.ids[m] = 1;
};

Memory.prototype.create = function create(model, data, callback) {
    var id = data.id || this.ids[model]++;
    data.id = id;
    this.cache[this.table(model)][id] = JSON.stringify(data);
    process.nextTick(function() {
        callback(null, id);
    });
};

Memory.prototype.updateOrCreate = function (model, data, callback) {
    var mem = this;
    this.exists(model, data.id, function (err, exists) {
        if (exists) {
            mem.save(model, data, callback);
        } else {
            mem.create(model, data, function (err, id) {
                data.id = id;
                callback(err, data);
            });
        }
    });
};

Memory.prototype.save = function save(model, data, callback) {
    this.cache[this.table(model)][data.id] = JSON.stringify(data);
    process.nextTick(function () {
        callback(null, data);
    });
};

Memory.prototype.exists = function exists(model, id, callback) {
    var table = this.table(model);
    process.nextTick(function () {
        callback(null, this.cache[table].hasOwnProperty(id));
    }.bind(this));
};

Memory.prototype.find = function find(model, id, callback) {
    var table = this.table(model);
    process.nextTick(function () {
        callback(null, id in this.cache[table] && this.fromDb(model, this.cache[table][id]));
    }.bind(this));
};

Memory.prototype.destroy = function destroy(model, id, callback) {
    delete this.cache[this.table(model)][id];
    process.nextTick(callback);
};

Memory.prototype.fromDb = function(model, data) {
    if (!data) return null;
    data = JSON.parse(data);
    var props = this._models[model].properties;
    Object.keys(data).forEach(function (key) {
        var val = data[key];
        if (typeof val === 'undefined' || val === null) {
            return;
        }
        if (props[key]) {
            switch(props[key].type.name) {
                case 'Date':
                val = new Date(val.toString().replace(/GMT.*$/, 'GMT'));
                break;
                case 'Boolean':
                val = new Boolean(val);
                break;
            }
        }
        data[key] = val;
    });
    return data;
};

Memory.prototype.all = function all(model, filter, callback) {
    var self = this;
    var table = this.table(model);
    var nodes = Object.keys(this.cache[table]).map(function (key) {
        return this.fromDb(model, this.cache[table][key]);
    }.bind(this));

    if (filter) {

        // do we need some sorting?
        if (filter.order) {
            var props = this._models[model].properties;
            var orders = filter.order;
            if (typeof filter.order === "string") {
                orders = [filter.order];
            }
            orders.forEach(function (key, i) {
                var reverse = 1;
                var m = key.match(/\s+(A|DE)SC$/i);
                if (m) {
                    key = key.replace(/\s+(A|DE)SC/i, '');
                    if (m[1].toLowerCase() === 'de') reverse = -1;
                }
                orders[i] = {"key": key, "reverse": reverse};
            });
            nodes = nodes.sort(sorting.bind(orders));
        }

        // do we need some filtration?
        if (filter.where) {
            nodes = nodes ? nodes.filter(applyFilter(filter)) : nodes;
        }

        // limit/skip
        filter.skip = filter.skip || 0;
        filter.limit = filter.limit || nodes.length;
        nodes = nodes.slice(filter.skip, filter.skip + filter.limit);

    }

    process.nextTick(function () {
        if (filter && filter.include) {
            self._models[model].model.include(nodes, filter.include, callback);
        } else {
            callback(null, nodes);
        }
    });

    function sorting(a, b) {
        for (var i=0, l=this.length; i<l; i++) {
            if (a[this[i].key] > b[this[i].key]) {
                return 1*this[i].reverse;
            } else  if (a[this[i].key] < b[this[i].key]) {
                return -1*this[i].reverse;
            }
        }
        return 0;
    }
};

function applyFilter(filter) {
    if (typeof filter.where === 'function') {
        return filter.where;
    }
    var keys = Object.keys(filter.where);
    return function (obj) {
        var pass = true;
        keys.forEach(function (key) {
            if (!test(filter.where[key], obj[key])) {
                pass = false;
            }
        });
        return pass;
    }

    function test(example, value) {
        if (typeof value === 'string' && example && example.constructor.name === 'RegExp') {
            return value.match(example);
        }
        if (typeof example === 'undefined') return undefined;
        if (typeof value === 'undefined') return undefined;
        if (typeof example === 'object') {
            if (example.inq) {
                if (!value) return false;
                for (var i = 0; i < example.inq.length; i += 1) {
                    if (example.inq[i] == value) return true;
                }
                return false;
            }
        }
        // not strict equality
        return (example !== null ? example.toString() : example) == (value !== null ? value.toString() : value);
    }
}

Memory.prototype.destroyAll = function destroyAll(model, callback) {
    var table = this.table(model);
    Object.keys(this.cache[table]).forEach(function (id) {
        delete this.cache[table][id];
    }.bind(this));
    this.cache[table] = {};
    process.nextTick(callback);
};

Memory.prototype.count = function count(model, callback, where) {
    var cache = this.cache[this.table(model)];
    var data = Object.keys(cache)
    if (where) {
        data = data.filter(function (id) {
            var ok = true;
            Object.keys(where).forEach(function (key) {
                if (JSON.parse(cache[id])[key] != where[key]) {
                    ok = false;
                }
            });
            return ok;
        });
    }
    process.nextTick(function () {
        callback(null, data.length);
    });
};

Memory.prototype.updateAttributes = function updateAttributes(model, id, data, cb) {
    data.id = id;
    var base = JSON.parse(this.cache[this.table(model)][id]);
    this.save(model, merge(base, data), cb);
};

Memory.prototype.transaction = function () {
    return new Memory(this);
};

Memory.prototype.exec = function(callback) {
    this.onTransactionExec();
    setTimeout(callback, 50);
};

Memory.prototype.table = function (model) {
    return this._models[model].model.tableName;
};

function merge(base, update) {
    if (!base) return update;
    Object.keys(update).forEach(function (key) {
        base[key] = update[key];
    });
    return base;
}

