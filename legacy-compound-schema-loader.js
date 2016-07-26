
module.exports = function(Schema, filename, settings, compound) {
    var schema = [];
    var definitions = require(filename);
    Object.keys(definitions).forEach(function(k) {
        var conf = settings[k];
        if (!conf) {
            console.log('No config found for ' + k + ' schema, using in-memory schema');
            conf = {driver: 'memory'};
        }
        schema[k] = new Schema(conf.driver, conf);
        schema[k].on('define', function(m, name, prop, sett) {
            compound.models[name] = m;
            if (conf.backyard) {
                schema[k].backyard.define(name, prop, sett);
            }
        });
        schema[k].name = k;
        schema.push(schema[k]);
        if (conf.backyard) {
            schema[k].backyard = new Schema(conf.backyard.driver, conf.backyard);
        }
        if ('function' === typeof definitions[k]) {
            define(schema[k], definitions[k]);
            if (conf.backyard) {
                define(schema[k].backyard, definitions[k]);
            }
        }
    });

    return schema;

    function define(db, def) {
        def(db, compound);
    }
};
