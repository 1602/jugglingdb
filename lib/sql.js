module.exports = BaseSQL;

/**
 * Base SQL class
 */
function BaseSQL() {
}

BaseSQL.prototype.query = function() {
    throw new Error('query method should be declared in adapter');
};

BaseSQL.prototype.command = function(sql, callback) {
    return this.query(sql, callback);
};

BaseSQL.prototype.queryOne = function(sql, callback) {
    return this.query(sql, (err, data) => {
        if (err) {
            return callback(err);
        }
        callback(err, data[0]);
    });
};

BaseSQL.prototype.table = function(model) {
    return this._models[model].model.tableName;
};

BaseSQL.prototype.escapeName = function() {
    throw new Error('escapeName method should be declared in adapter');
};

BaseSQL.prototype.tableEscaped = function(model) {
    return this.escapeName(this.table(model));
};

BaseSQL.prototype.define = function(descr) {
    if (!descr.settings) {
        descr.settings = {};
    }
    this._models[descr.model.modelName] = descr;
};

BaseSQL.prototype.defineProperty = function(model, prop, params) {
    this._models[model].properties[prop] = params;
};

BaseSQL.prototype.escapeId = function(id) {
    if (this.schema.settings.slave) {
        if (id === null) {
            return 'NULL';
        }
        return '"' + (typeof id === 'undefined' ? '' : id.toString().replace(/["\n]/g, '')) + '"';
    }

    const idNumber = Number(id);
    if (isNaN(idNumber)) {
        return '\'' + String(id).replace(/'/g, '') + '\'';
    }

    return idNumber;
};

BaseSQL.prototype.save = function(model, data, callback) {
    const sql = 'UPDATE ' + this.tableEscaped(model) + ' SET ' + this.toFields(model, data) + ' WHERE ' + this.escapeName('id') + ' = ' + this.escapeId(data.id);

    this.query(sql, err => callback(err));
};


BaseSQL.prototype.exists = function(model, id, callback) {
    const sql = 'SELECT 1 FROM ' +
        this.tableEscaped(model) + ' WHERE ' + this.escapeName('id') + ' = ' + this.escapeId(id) + ' LIMIT 1';

    this.query(sql, (err, data) => {
        if (err) {
            return callback(err);
        }
        callback(null, data.length === 1);
    });
};

BaseSQL.prototype.find = function find(model, id, callback) {
    const idNumber = this.escapeId(id);
    const sql = 'SELECT * FROM ' +
        this.tableEscaped(model) + ' WHERE ' + this.escapeName('id') + ' = ' + idNumber + ' LIMIT 1';

    this.query(sql, (err, data) => {
        if (data && data.length === 1) {
            data[0].id = id;
        } else {
            data = [null];
        }
        callback(err, this.fromDatabase(model, data[0]));
    });
};

BaseSQL.prototype.destroy = function destroy(model, id, callback) {
    const sql = 'DELETE FROM ' +
        this.tableEscaped(model) + ' WHERE ' + this.escapeName('id') + ' = ' + this.escapeId(id);

    this.command(sql, err => callback(err));
};

BaseSQL.prototype.destroyAll = function destroyAll(model, callback) {
    this.command('DELETE FROM ' + this.tableEscaped(model), err => {
        if (err) {
            return callback(err, []);
        }
        callback(err);
    });
};

BaseSQL.prototype.count = function count(model, callback, where) {
    const self = this;
    const props = this._models[model].properties;

    this.queryOne(
        'SELECT count(*) as cnt FROM ' +
        this.tableEscaped(model) + ' ' + buildWhere(where),
        (err, res) => {
            if (err) {
                return callback(err);
            }
            callback(err, res && res.cnt);
        });

    function buildWhere(conds) {
        const cs = [];
        Object.keys(conds || {}).forEach(key => {
            const keyEscaped = self.escapeName(key);
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

BaseSQL.prototype.disconnect = function disconnect(cb) {
    this.client.end(cb);
};

BaseSQL.prototype.automigrate = function(cb) {
    const self = this;
    let wait = 0;
    Object.keys(this._models).forEach(model => {
        wait += 1;
        self.dropTable(model, () => {
            // console.log('drop', model);
            self.createTable(model, err => {
                // console.log('create', model);
                if (err) {
                    console.log(err);
                }
                done();
            });
        });
    });

    if (wait === 0) {
        cb();
    }

    function done() {
        wait += -1;
        if (wait === 0 && cb) {
            cb();
        }
    }
};

BaseSQL.prototype.dropTable = function(model, cb) {
    this.command('DROP TABLE IF EXISTS ' + this.tableEscaped(model), cb);
};

BaseSQL.prototype.createTable = function(model, cb) {
    this.command('CREATE TABLE ' + this.tableEscaped(model) +
        ' (\n  ' + this.propertiesSQL(model) + '\n)', cb);
};

