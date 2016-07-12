'use strict';

module.exports = function(compound) {

    if (global.railway) {
        global.railway.orm = exports;
    } else {
        compound.orm = {
            Schema: exports.Schema,
            AbstractClass: exports.AbstractClass
        };
        if (compound.app.enabled('noeval schema')) {
            compound.orm.schema = exports.loadSchema(
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
