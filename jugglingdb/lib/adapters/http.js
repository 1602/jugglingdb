exports.initialize = function initializeSchema(schema, callback) {
    schema.adapter = new WebService();
    process.nextTick(callback);
};

function WebService() {
    this._models = {};
    this.cache = {};
    this.ids = {};
}

WebService.prototype.installPostProcessor = function installPostProcessor(descr) {
    var dates = [];
    Object.keys(descr.properties).forEach(function(column) {
        if (descr.properties[column].type.name === 'Date') {
            dates.push(column);
        }
    });

    var postProcessor = function(model) {
        var max = dates.length;
        for (var i = 0; i < max; i++) {
            var column = dates[i];
            if (model[column]) {
                model[column] = new Date(model[column]);
            }
        };
    };

    descr.postProcessor = postProcessor;
};

WebService.prototype.preProcess = function preProcess(data) {
    var result = {};
    Object.keys(data).forEach(function(key) {
        if (data[key] != null) {
            result[key] = data[key];
        }
    })
    return result;
};

WebService.prototype.postProcess = function postProcess(model, data) {
    var postProcessor = this._models[model].postProcessor;
    if (postProcessor && data) {
        postProcessor(data);
    }
};

WebService.prototype.postProcessMultiple = function postProcessMultiple(model, data) {
    var postProcessor = this._models[model].postProcessor;
    if (postProcessor) {
        var max = data.length;
        for (var i = 0; i < max; i++) {
            if (data[i]) {
                postProcessor(data[i]);
            }
        };
    }
};

WebService.prototype.define = function defineModel(descr) {
    var m = descr.model.modelName;
    this.installPostProcessor(descr);
    this._models[m] = descr;
};

WebService.prototype.getResourceUrl = function getResourceUrl(model) {
    var url = this._models[model].settings.restPath;
    if (!url) throw new Error('Resource url (restPath) for ' + model + ' is not defined');
    return url;
};

WebService.prototype.getBlankReq = function () {
    if (!this.csrfToken) {
        this.csrfToken = $('meta[name=csrf-token]').attr('content');
        this.csrfParam = $('meta[name=csrf-param]').attr('content');
    }
    var req = {};
    req[this.csrfParam] = this.csrfToken;
    return req;
}

WebService.prototype.create = function create(model, data, callback) {
    var req = this.getBlankReq();
    req[model] = this.preProcess(data);
    $.post(this.getResourceUrl(model) + '.json', req, function (res) {
        if (res.code === 200) {
            callback(null, res.data.id);
        } else {
            callback(res.error);
        }
    }, 'json');
    // this.cache[model][id] = data;
};

WebService.prototype.updateOrCreate = function (model, data, callback) {
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

WebService.prototype.save = function save(model, data, callback) {
    var _this = this;
    var req = this.getBlankReq();
    req._method = 'PUT';
    req[model] = this.preProcess(data);
    $.post(this.getResourceUrl(model) + '/' + data.id + '.json', req, function (res) {
        if (res.code === 200) {
            _this.postProcess(model, res.data);
            callback(null, res.data);
        } else {
            callback(res.error);
        }
    }, 'json');
};

WebService.prototype.exists = function exists(model, id, callback) {
    $.getJSON(this.getResourceUrl(model) + '/' + id + '.json', function (res) {
        if (res.code === 200) {
            callback(null, true);
        } else if (res.code === 404) {
            callback(null, false);
        } else {
            callback(res.error);
        }
    });
};

WebService.prototype.find = function find(model, id, callback) {
    var _this = this;
    $.getJSON(this.getResourceUrl(model) + '/' + id + '.json', function (res) {
        if (res.code === 200) {
            _this.postProcess(model, res.data);
            callback(null, res.data);
        } else {
            callback(res.error);
        }
    });
};

WebService.prototype.destroy = function destroy(model, id, callback) {
    var _this = this;
    var req = this.getBlankReq();
    req._method = 'DELETE';
    $.post(this.getResourceUrl(model) + '/' + id + '.json', req, function (res) {
        if (res.code === 200) {
            //delete _this.cache[model][id];
            callback(null, res.data);
        } else {
            callback(res.error);
        }
    }, 'json');
};

WebService.prototype.all = function all(model, filter, callback) {
    var _this = this;
    $.getJSON(this.getResourceUrl(model) + '.json?query=' + encodeURIComponent(JSON.stringify(filter)), function (res) {
        if (res.code === 200) {
            _this.postProcessMultiple(model, res.data);
            callback(null, res.data);
        } else {
            callback(res.error);
        }
    });
};

WebService.prototype.destroyAll = function destroyAll(model, callback) {
    throw new Error('Not supported');
};

WebService.prototype.count = function count(model, callback, where) {
    throw new Error('Not supported');
};

WebService.prototype.updateAttributes = function (model, id, data, callback) {
    data.id = id;
    this.save(model, data, callback);
};

