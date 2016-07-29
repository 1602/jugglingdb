const fs = require('fs');
const path = require('path');
const Schema = require('./schema').Schema;

const existsSync = fs.existsSync || path.existsSync;

/* global railway */

if (global.railway) {
    railway.orm._schemas = [];
}

module.exports = function init(root) {
    let railway, app, models;

    if (typeof root !== 'object' || (root.constructor.name !== 'Compound' && root.constructor.name !== 'CompoundServer')) {
        railway = global.railway;
        app = global.app;
        models = app.models;
    } else {
        railway = root;
        app = railway.app;
        root = railway.root;
        models = railway.models;
    }

    railway.orm._schemas = [];

    const confFile = (root || app.root) + '/config/database';
    const appConf = app.get('database');
    let config = railway.orm.config = appConf || {};
    const env = app.set('env');
    let schema;

    if (!railway.parent) {
        if (!appConf) {
            try {
                let cf = require(confFile);
                if (cf instanceof Array) {
                    cf = cf[0];
                }
                if (typeof cf === 'function') {
                    config = cf(railway);
                } else {
                    config = cf[env];
                }
            } catch (e) {
                console.log('Could not load config/database.{js|json|yml}');
                throw e;
            }
        }

        if (!config) {
            console.log('No environment ' + env + ' found in config/database.{js|json|yml}');
            throw new Error('No environment ' + env + ' found in config/database.{js|json|yml}');
        }

        // when driver name started with point - look for driver in app root (relative path)
        if (config.driver && config.driver.match(/^\./)) {
            config.driver = path.join(app.root, config.driver);
        }

        schema = new Schema(config && config.driver || 'memory', config);
        schema.log = log;
        if (!schema.adapter) {
            throw new Error('Adapter is not defined');
        }

    } else {
        schema = railway.parent.orm._schemas[0];
    }

    if (schema.waitForConnect) {
        schema.on('connected', () => loadSchema(schema, railway, app, models));
    } else {
        loadSchema(schema, railway, app, models);
    }

    // check validations and display warning

    function loadSchema(schema, railway, app, models) {
        railway.orm._schemas.push(schema);

        const context = prepareContext(models, railway, app, schema);

        // run schema first
        let schemaFile = (root || app.root) + '/db/schema.';
        if (existsSync(schemaFile + 'js')) {
            schemaFile += 'js';
        } else if (existsSync(schemaFile + 'coffee')) {
            schemaFile += 'coffee';
        } else {
            schemaFile = false;
        }

        if (schemaFile) {
            let code = fs.readFileSync(schemaFile).toString();
            if (schemaFile.match(/\.coffee$/)) {
                code = require('coffee-script').compile(code);
            }
            /*jshint evil: true */
            const fn = new Function('context', 'require', 'with(context){(function(){' + code + '})()}');
            fn(context, require);
        }

        // autoupdate if set app.enable('autoupdate')  or freeze schemas by default
        railway.orm._schemas.forEach(schema => {
            if (app.enabled('autoupdate')) {
                schema.autoupdate();
            } else {
                schema.freeze();
            }
        });
    }

    function log(str, startTime) {
        const $ = railway.utils.stylize.$;
        const m = Date.now() - startTime;
        railway.utils.debug(str + $(' [' + (m < 10 ? m : $(m).red) + ' ms]').bold);
        app.emit('app-event', {
            type: 'query',
            param: str,
            time: m
        });
    }

    function prepareContext(models, railway, app, defSchema, done) {
        const ctx = { app },
            _models = {},
            settings = {};
        let cname,
            schema,
            connected = 0,
            wait = 0,
            nonJugglingSchema = false;

        done = done || function() {};

        /**
         * Multiple schemas support
         * example:
         * schema('redis', {url:'...'}, function() {
         *     describe models using redis connection
         *     ...
         * });
         * schema(function() {
         *     describe models stored in memory
         *     ...
         * });
         */
        ctx.schema = function() {
            const name = argument('string');
            const opts = argument('object') || {};
            const def = argument('function') || function() {};
            schema = new Schema(name || opts.driver || 'memory', opts);
            railway.orm._schemas.push(schema);
            wait += 1;
            ctx.gotSchema = true;
            schema.on('log', log);
            schema.on('connected', () => {
                connected += 1;
                if (wait === connected) {
                    done();
                }
            });
            def();
            schema = false;
        };

        /**
         * Use custom schema driver
         */
        ctx.customSchema = function() {
            const def = argument('function') || function() {};
            nonJugglingSchema = true;
            def();
            Object.keys(ctx.exports).forEach(m => {
                ctx.define(m, ctx.exports[m]);
            });
            nonJugglingSchema = false;
        };
        ctx.exports = {};
        ctx.module = { exports: ctx.exports };

        /**
         * Define a class in current schema
         */
        ctx.describe = ctx.define = function(className, callback) {
            let m;
            cname = className;
            _models[cname] = {};
            settings[cname] = {};
            if (nonJugglingSchema) {
                m = callback;
            } else {
                if (typeof callback === 'function') {
                    callback();
                }
                m = (schema || defSchema).define(className, _models[cname], settings[cname]);
            }
            if (global.railway) {
                global[cname] = m;
            }
            models[cname] = ctx[cname] = m;
            return m;
        };

        /**
         * Define a property in current class
         */
        ctx.property = function(name, type, params) {
            if (!params) {
                params = {};
            }

            if (typeof type !== 'function' && typeof type === 'object' && !(type instanceof Array)) {
                params = type;
                type = String;
            }

            params.type = type || String;
            _models[cname][name] = params;
        };

        /**
         * Set custom table name for current class
         * @param name - name of table
         */
        ctx.setTableName = function(name) {
            if (cname) {
                settings[cname].table = name;
            }
        };

        /**
         * Set configuration param
         *
         * @param name - name of param.
         * @param value - value.
         */
        ctx.set = function(name, value) {
            if (cname) {
                settings[cname][name] = value;
            }
        };

        ctx.pathTo = railway.map && railway.map.pathTo || {};

        /**
         * If the Schema has additional types, add them to the context
         * e.g. MySQL has an additional Point type
         */
        if (Schema.types && Object.keys(Schema.types).length) {
            Object.keys(Schema.types).forEach(typeName => {
                ctx[typeName] = Schema.types[typeName];
            });
        }

        return ctx;

        function argument(type) {
            let r;
            [].forEach.call(arguments.callee.caller.arguments, a => {
                if (!r && typeof a === type) {
                    r = a;
                }
            });
            return r;
        }
    }

};
