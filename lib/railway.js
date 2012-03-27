var fs = require('fs');
var path = require('path');
var Schema = railway.orm.Schema;

railway.orm._schemas = [];

var confFile = app.root + '/config/database.json';
var config;

if (path.existsSync(confFile)) {
    try {
        config = JSON.parse(fs.readFileSync(confFile, 'utf-8'))[app.set('env')];
    } catch (e) {
        console.log('Could not parse config/database.json');
        throw e;
    }
} else {
    config = {};
}

var schema = new Schema(config && config.driver || 'memory', config);
schema.log = log;
railway.orm._schemas.push(schema);

context = prepareContext(schema);

// run schema first
var schemaFile = app.root + '/db/schema.';
if (path.existsSync(schemaFile + 'js')) {
    schemaFile += 'js';
} else if (path.existsSync(schemaFile + 'coffee')) {
    schemaFile += 'coffee';
} else {
    schemaFile = false;
}

if (schemaFile) {
    runCode(schemaFile, context);
}

// and freeze schemas
railway.orm._schemas.forEach(function (schema) {
    schema.freeze();
});

function log(str, startTime) {
    var $ = utils.stylize.$;
    var m = Date.now() - startTime;
    utils.debug(str + $(' [' + (m < 10 ? m : $(m).red) + ' ms]').bold);
    app.emit('app-event', {
        type: 'query',
        param: str,
        time: m
    });
}

function runCode(filename, context) {
    var isCoffee = filename.match(/coffee$/);

    context = context || {};

    var dirname = path.dirname(filename);

    // extend context
    context.require = context.require || function (apath) {
        var isRelative = apath.match(/^\.\.?\//);
        return require(isRelative ? path.resolve(dirname, apath) : apath);
    };
    context.app = app;
    context.railway = railway;
    context.console = console;
    context.setTimeout = setTimeout;
    context.setInterval = setInterval;
    context.clearTimeout = clearTimeout;
    context.clearInterval = clearInterval;
    context.__filename = filename;
    context.__dirname = dirname;
    context.process = process;
    context.t = context.t || t;
    context.Buffer = Buffer;

    var code = path.existsSync(filename) && require('fs').readFileSync(filename).toString();
    if (!code) return;
    if (isCoffee) {
        try {
            var cs = require('coffee-script');
        } catch (e) {
            throw new Error('Please install coffee-script npm package: `npm install coffee-script`');
        }
        try {
            code = require('coffee-script').compile(code);
        } catch (e) {
            console.log('Error in coffee code compilation in file ' + filename);
            throw e;
        }
    }

    try {
        var m = require('vm').createScript(code.toString('utf8'), filename);
        m.runInNewContext(context);
    } catch (e) {
        console.log('Error while executing ' + filename);
        throw e;
    }

}

function prepareContext(defSchema, done) {
    var ctx = {app: app},
        models = {},
        settings = {},
        cname,
        schema,
        wait = connected = 0,
        nonJugglingSchema = false;

    done = done || function () {};

    /**
     * Multiple schemas support
     * example:
     * schema('redis', {url:'...'}, function () {
     *     describe models using redis connection
     *     ...
     * });
     * schema(function () {
     *     describe models stored in memory
     *     ...
     * });
     */
    ctx.schema = function () {
        var name = argument('string');
        var opts = argument('object') || {};
        var def = argument('function') || function () {};
        schema = new Schema(name || opts.driver || 'memory', opts);
        railway.orm._schemas.push(schema);
        wait += 1;
        ctx.gotSchema = true;
        schema.on('log', log);
        schema.on('connected', function () {
            if (wait === ++connected) done();
        });
        def();
        schema = false;
    };

    /**
     * Use custom schema driver
     */
    ctx.customSchema = function () {
        var def = argument('function') || function () {};
        nonJugglingSchema = true;
        def();
        Object.keys(ctx.exports).forEach(function (m) {
            ctx.define(m, ctx.exports[m]);
        });
        nonJugglingSchema = false;
    };
    ctx.exports = {};
    ctx.module = { exports: ctx.exports };

    /**
     * Define a class in current schema
     */
    ctx.describe = ctx.define = function (className, callback) {
        var m;
        cname = className;
        models[cname] = {};
        settings[cname] = {};
        if (nonJugglingSchema) {
            m = callback;
        } else {
            callback && callback();
            m = (schema || defSchema).define(className, models[cname], settings[cname]);
        }
        return global[cname] = app.models[cname] = ctx[cname] = m;
    };

    /**
     * Define a property in current class
     */
    ctx.property = function (name, type, params) {
        if (!params) params = {};
        if (typeof type !== 'function' && typeof type === 'object') {
            params = type;
            type = String;
        }
        params.type = type || String;
        models[cname][name] = params;
    };

    /**
     * Set custom table name for current class
     * @param name - name of table
     */
    ctx.setTableName = function (name) {
        if (cname) settings[cname].table = name;
    };

    ctx.Text = Schema.Text;

    return ctx;

    function argument(type) {
        var r;
        [].forEach.call(arguments.callee.caller.arguments, function (a) {
            if (!r && typeof a === type) r = a;
        });
        return r;
    }
}
