'use strict';

var loadSchema = require('./legacy-compound-schema-loader');

module.exports = function init(compound, Schema, AbstractClass) {

    if (global.railway) {
        global.railway.orm = exports;
    } else {
        compound.orm = {
            Schema,
            AbstractClass
        };
        if (compound.app.enabled('noeval schema')) {
            compound.orm.schema = loadSchema(
                Schema,
                compound.root + '/db/schema',
                compound.app.get('database'),
                compound
            );
            if (compound.app.enabled('autoupdate')) {
                compound.on('ready', function() {
                    compound.orm.schema.forEach(function(s) {
                        s.autoupdate();
                        if (s.backyard) {
                            s.backyard.autoupdate();
                            s.backyard.log = s.log;
                        }
                    });
                });
            }
            return;
        }
    }

    // legacy stuff

    if (compound.version > '1.1.5-15') {
        compound.on('after routes', initialize);
    } else {
        initialize();
    }

    function initialize() {
        var railway = './lib/railway', init;
        try {
            init = require(railway);
        } catch (e) {
            console.log(e.stack);
        }
        if (init) {
            init(compound);
        }
    }

};
