exports.initialize = function initializeSchema(schema, callback) {
    schema.adapter = new Memory();
    process.nextTick(callback);
};

function Memory() {
    this._models = {};
    this.cache = {};
    this.ids = {};
}

Memory.prototype.define = function defineModel(descr) {
    var m = descr.model.modelName;
    this._models[m] = descr;
    this.cache[m] = {};
    this.ids[m] = 1;
};

Memory.prototype.create = function create(model, data, callback) {
    var id = this.ids[model]++;
    data.id = id;
    this.cache[model][id] = data;
    callback(null, id);
};

Memory.prototype.save = function save(model, data, callback) {
    this.cache[model][data.id] = data;
    callback();
};

Memory.prototype.exists = function exists(model, id, callback) {
    callback(null, this.cache[model].hasOwnProperty(id));
};

Memory.prototype.find = function find(model, id, callback) {
    callback(null, this.cache[model][id]);
};

Memory.prototype.destroy = function destroy(model, id, callback) {
    delete this.cache[model][id];
    callback();
};

Memory.prototype.all = function all(model, filter, callback) {
    var nodes = Object.keys(this.cache[model]).map(function (key) {
        return this.cache[model][key];
    }.bind(this));
    process.nextTick(function () {
        callback(null, filter && nodes ? nodes.filter(applyFilter(filter)) : nodes);
    });
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
        // not strict equality
        return example == value;
    }
}

Memory.prototype.destroyAll = function destroyAll(model, callback) {
    Object.keys(this.cache[model]).forEach(function (id) {
        delete this.cache[model][id];
    }.bind(this));
    this.cache[model] = {};
    callback();
};

Memory.prototype.count = function count(model, callback) {
    callback(null, Object.keys(this.cache[model]).length);
};

Memory.prototype.updateAttributes = function updateAttributes(model, id, data, cb) {
    data.id = id;
    var base = this.cache[model][id];
    this.save(model, merge(base, data), cb);
};

function merge(base, update) {
    Object.keys(update).forEach(function (key) {
        base[key] = update[key];
    });
    return base;
}

