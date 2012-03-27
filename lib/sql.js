module.exports = BaseSQL;

/**
 * Base SQL class
 */
function BaseSQL() {
}

BaseSQL.prototype.query = function () {
    throw new Error('query method should be declared in adapter');
};

BaseSQL.prototype.command = function (sql, callback) {
    return this.query(sql, callback);
};

BaseSQL.prototype.queryOne = function (sql, callback) {
    return this.query(sql, function (err, data) {
        if (err) return callback(err);
        callback(err, data[0]);
    });
};

BaseSQL.prototype.table = function (model) {
    return this._models[model].model.schema.tableName(model);
};

BaseSQL.prototype.escapeName = function (name) {
    throw new Error('escapeName method should be declared in adapter');
};

BaseSQL.prototype.tableEscaped = function (model) {
    return this.escapeName(this.table(model));
};

BaseSQL.prototype.define = function (descr) {
    if (!descr.settings) descr.settings = {};
    this._models[descr.model.modelName] = descr;
};

BaseSQL.prototype.defineProperty = function (model, prop, params) {
    this._models[model].properties[prop] = params;
};

BaseSQL.prototype.save = function (model, data, callback) {
    var sql = 'UPDATE ' + this.tableEscaped(model) + ' SET ' + this.toFields(model, data) + ' WHERE ' + this.escapeName('id') + ' = ' + data.id;

    this.query(sql, function (err) {
        callback(err);
    });
};


BaseSQL.prototype.exists = function (model, id, callback) {
    var sql = 'SELECT 1 FROM ' +
        this.tableEscaped(model) + ' WHERE ' + this.escapeName('id') + ' = ' + id + ' LIMIT 1';

    this.query(sql, function (err, data) {
        if (err) return callback(err);
        callback(null, data.length === 1);
    });
};

BaseSQL.prototype.find = function find(model, id, callback) {
    var sql = 'SELECT * FROM ' +
        this.tableEscaped(model) + ' WHERE ' + this.escapeName('id') + ' = ' + id + ' LIMIT 1';

    this.query(sql, function (err, data) {
        if (data && data.length === 1) {
            data[0].id = id;
        } else {
            data = [null];
        }
        callback(err, this.fromDatabase(model, data[0]));
    }.bind(this));
};

BaseSQL.prototype.destroy = function destroy(model, id, callback) {
    var sql = 'DELETE FROM ' +
        this.tableEscaped(model) + ' WHERE ' + this.escapeName('id') + ' = ' + id;

    this.command(sql, function (err) {
        callback(err);
    });
};

BaseSQL.prototype.destroyAll = function destroyAll(model, callback) {
    this.command('DELETE FROM ' + this.tableEscaped(model), function (err) {
        if (err) {
            return callback(err, []);
        }
        callback(err);
    }.bind(this));
};

BaseSQL.prototype.count = function count(model, callback, where) {
    var self = this;
    var props = this._models[model].properties;

    this.queryOne('SELECT count(*) as cnt FROM ' +
        this.tableEscaped(model) + ' ' + buildWhere(where), function (err, res) {
        if (err) return callback(err);
        callback(err, res && res.cnt);
    });

    function buildWhere(conds) {
        var cs = [];
        Object.keys(conds || {}).forEach(function (key) {
            var keyEscaped = self.escapeName(key);
            if (conds[key] === null) {
                cs.push(keyEscaped + ' IS NULL');
            } else {
                cs.push(keyEscaped + ' = ' + self.toDatabase(props[key], conds[key]));
            }
        });
        return cs.length ? ' WHERE ' + cs.join(' AND ') : '';
    }
};

BaseSQL.prototype.updateAttributes = function updateAttrs(model, id, data, cb) {
    data.id = id;
    this.save(model, data, cb);
};

BaseSQL.prototype.disconnect = function disconnect() {
    this.client.end();
};

BaseSQL.prototype.automigrate = function (cb) {
    var self = this;
    var wait = 0;
    Object.keys(this._models).forEach(function (model) {
        wait += 1;
        self.dropTable(model, function () {
            // console.log('drop', model);
            self.createTable(model, function (err) {
                // console.log('create', model);
                if (err) console.log(err);
                done();
            });
        });
    });
    if (wait === 0) cb();

    function done() {
        if (--wait === 0 && cb) {
            cb();
        }
    }
};

BaseSQL.prototype.dropTable = function (model, cb) {
    this.command('DROP TABLE IF EXISTS ' + this.tableEscaped(model), cb);
};

BaseSQL.prototype.createTable = function (model, cb) {
    this.command('CREATE TABLE ' + this.tableEscaped(model) +
        ' (\n  ' + this.propertiesSQL(model) + '\n)', cb);
};

