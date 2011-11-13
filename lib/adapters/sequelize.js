var Sequelize = require('sequelize');

exports.initialize = function initializeSchema(schema, callback) {
    schema.adapter = new SequelizeAdapter(schema);
    process.nextTick(callback);
};

function SequelizeAdapter(schema) {
    this.schema = schema;
    this._models = {};
    this._modelDefinitions = {};
    this._modelSettings = {};
    this.client = new Sequelize(
        schema.settings.database,
        schema.settings.username,
        schema.settings.password, {
            host: schema.settings.host,
            port: schema.settings.port,
            logging: schema.settings.port,
            maxConcurrentQueries: schema.settings.maxConcurrentQueries
        }
    );
}

SequelizeAdapter.prototype.define = function (d) {
    var model = d.model;
    var settings = d.settings;
    var properties = d.properties;
    var m = model.modelName;
    var translate = {
        'String':  Sequelize.STRING,
        'Text':    Sequelize.TEXT,
        'Number':  Sequelize.INTEGER,
        'Boolean': Sequelize.BOOLEAN,
        'Date':    Sequelize.DATE
    };

    var props = {};

    Object.keys(properties).forEach(function (property) {
        props[property] = translate[properties[property].type.name];
    });

    this._modelDefinitions[m] = props;
    this._modelSettings[m] = settings;
};

SequelizeAdapter.prototype.defineSequelizeModel = function (m) {
    this._models[m] = this.client.define(m, this._modelDefinitions[m], this._modelSettings[m]);
};

SequelizeAdapter.prototype.defineForeignKey = function (model, key, cb) {
    this._modelDefinitions[model][key] = {type: Sequelize.INTEGER, index: true};
    cb(null, Number);
};


SequelizeAdapter.prototype.model = function getModel(name) {
    return this._models[name];
};

SequelizeAdapter.prototype.cleanup = function (model, obj) {
    if (!obj) {
        return null;
    }
    var def = this._modelDefinitions[model];
    var data = {};
    Object.keys(def).concat(['id']).forEach(function (key) {
        data[key] = obj[key];
    });
    return data;
};

SequelizeAdapter.prototype.save = function (model, data, callback) {
    this.model(model).find(data.id)
    .on('success', function (record) {
        record.updateAttributes(data)
        .on('success', callback.bind(data, null))
        .on('failure', callback);
    })
    .on('failure', callback);
    
};

SequelizeAdapter.prototype.updateAttributes = function (model, id, data, callback) {
    data.id = id;
    this.save(model, data, callback);
};

SequelizeAdapter.prototype.create = function (model, data, callback) {
    this.model(model)
    .build(data)
    .save()
    .on('success', function (obj) {
        callback(null, obj.id);
    })
    .on('failure', callback);
};

SequelizeAdapter.prototype.freezeSchema = function () {
    Object.keys(this._modelDefinitions).forEach(function (m) {
        this.defineSequelizeModel(m);
    }.bind(this));
};

SequelizeAdapter.prototype.automigrate = function (cb) {
    this.client.sync({force: true})
    .on('success', cb.bind(this, null))
    .on('failure', cb);
};

SequelizeAdapter.prototype.exists = function (model, id, callback) {
    this.model(model)
    .find(id)
    .on('success', function (data) {
        if (callback) {
            callback.calledOnce = true;
            callback(null, data);
        }
    })
    .on('failure', co(callback));
};

function co(cb, args) {

    return function () {
        if (!cb.calledOnce) {
            cb.calledOnce = true;
            cb.call.apply(cb, args || []);
        }
    }
}

SequelizeAdapter.prototype.find = function find(model, id, callback) {
    this.model(model)
    .find(id)
    .on('success', function (data) {
        callback(null, this.cleanup(model, data));
    }.bind(this))
    .on('failure', callback);
};

SequelizeAdapter.prototype.destroy = function destroy(model, id, callback) {
    this.model(model)
    .find(id)
    .on('success', function (data) {
        data.destroy()
        .on('success', callback.bind(null, null))
        .on('failure', callback);
    }.bind(this))
    .on('failure', callback);
};

SequelizeAdapter.prototype.all = function all(model, filter, callback) {
    this.model(model).all.on('success', function (data) {
        // TODO: filter
        callback(null, filter ? data.filter(applyFilter(filter)) : data);
    }).on('failure', callback);
};

function applyFilter(filter) {
    if (typeof filter.where === 'function') {
        return filter.where;
    }
    var keys = Object.keys(filter.where || {});
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

SequelizeAdapter.prototype.destroyAll = function destroyAll(model, callback) {
    var wait;
    this.model(model)
    .all
    .on('success', function (data) {
        wait = data.length;
        data.forEach(function (obj) {
            obj.destroy()
            .on('success', done)
            .on('false', error)
        });
    }.bind(this))
    .on('failure', callback);

    var err = null;
    function done() {
        if (--wait === 0) callback(err);
    }
    function error(e) {
        err = e;
        if (--wait === 0) callback(err);
    }
};

SequelizeAdapter.prototype.count = function count(model, callback) {
    this.model(model).count()
    .on('success', function (c) {
        if (callback) callback(null, c);
    })
    .on('failure', callback);
};

