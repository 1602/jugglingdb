/**
 * Dependencies
 */
var i8n = require('inflection');

/**
 * Include mixin for ./model.js
 */
var AbstractClass = require('./model.js');

/**
 * Allows you to load relations of several objects and optimize numbers of requests.
 *
 * @param {Array} objects - array of instances
 * @param {String}, {Object} or {Array} populate - which relations you want to load.
 * @param {Function} cb - Callback called when relations are loaded
 *
 * Examples:
 *
 * - User.populate(users, 'posts', function() {}); will load all users posts with only one additional request.
 * - User.populate(users, ['posts'], function() {}); // same
 * - User.populate(users, ['posts', 'passports'], function() {}); // will load all users posts and passports with two
 *     additional requests.
 * - Passport.populate(passports, {owner: { populate: 'posts'} }, function() {}); // will load all passports owner (users), and all
 *     posts of each owner loaded
 * - Passport.populate(passports, {owner: { populate: ['posts', 'passports'] }); // ...
 * - Passport.populate(passports, {owner: { populdate: [{posts: { populate: 'images' }}, 'passports'] }); // ...
 *
 */

 /*jshint sub: true */

AbstractClass.populate = function (objects, populate, cb) {

    if ((populate.constructor.name == 'Array' && populate.length === 0) || (populate.constructor.name == 'Object' && Object.keys(populate).length === 0)) {
        cb(null, objects);
        return;
    }

    populate = processPopulateJoin(populate);

    var keyVals = {};
    var objsByKeys = {};

    var nbCallbacks = 0;
    var totalCallbacks = 0;

    for (var i = 0; i < populate.length; i++) {
        var callback = processPopulatedItem(this, objects, populate[i], keyVals, objsByKeys);
        if (callback !== null) {
            totalCallbacks++;
            if (callback instanceof Error) {
                return cb(callback);
            } else {
                populatedItemCallback(callback);
            }
        }
    }

    if (totalCallbacks === 0) {
        cb(null, objects);
    }

    function populatedItemCallback(itemCb) {
        nbCallbacks++;
        itemCb(function () {
            nbCallbacks--;
            if (nbCallbacks === 0) {
                cb(null, objects);
            }
        });
    }

    function processPopulateJoin(ij) {
        if (typeof ij === 'string') {
            ij = [ij];
        }
        if (ij.constructor.name === 'Object') {
            var newIj = [];
            for (var key in ij) {
                var obj = {};
                obj[key] = ij[key];
                newIj.push(obj);
            }
            return newIj;
        }
        return ij;
    }
};

function processPopulatedItem(cls, objs, populate, keyVals, objsByKeys) {
    var relations = cls.relations;
    var relationName, subInclude;

    var where = {};

    if (populate.constructor.name === 'Object') {
        relationName = Object.keys(populate)[0];
        var attrs = populate[relationName];
        where = attrs.where || {};
        subInclude = attrs.populate || [];
    } else {
        relationName = populate;
        subInclude = [];
    }

    var relation = relations[relationName];

    if (!relation) {
        return new Error('Relation "' + relationName + '" is not defined for ' + cls.modelName + ' model');
    }

    var req = {
        'where': where
    };

    if (!keyVals[relation.keyFrom]) {
        objsByKeys[relation.keyFrom] = {};
        objs.filter(Boolean).forEach(function (obj) {
            if (!objsByKeys[relation.keyFrom][obj[relation.keyFrom]]) {
                objsByKeys[relation.keyFrom][obj[relation.keyFrom]] = [];
            }
            objsByKeys[relation.keyFrom][obj[relation.keyFrom]].push(obj);
        });
        keyVals[relation.keyFrom] = Object.keys(objsByKeys[relation.keyFrom]);
    }

    // deep clone is necessary since inq seems to change the processed array
    var keysToBeProcessed = {};
    var inValues = [];
    for (var j = 0; j < keyVals[relation.keyFrom].length; j++) {
        keysToBeProcessed[keyVals[relation.keyFrom][j]] = true;
        if (keyVals[relation.keyFrom][j] !== 'null' && keyVals[relation.keyFrom][j] !== 'undefined') {
            inValues.push(keyVals[relation.keyFrom][j]);
        }
    }

    var _model, _through;

    function done(err, objsIncluded, cb) {
        var objectsFrom;

        for (var i = 0; i < objsIncluded.length; i++) {
            delete keysToBeProcessed[objsIncluded[i][relation.keyTo]];
            objectsFrom = objsByKeys[relation.keyFrom][objsIncluded[i][relation.keyTo]];

            for (var j = 0; j < objectsFrom.length; j++) {
                if (!objectsFrom[j].__cachedRelations) {
                    objectsFrom[j].__cachedRelations = {};
                }
                if (relation.multiple) {
                    if (!objectsFrom[j].__cachedRelations[relationName]) {
                        objectsFrom[j].__cachedRelations[relationName] = [];
                    }

                    if (_through) {
                        objectsFrom[j].__cachedRelations[relationName].push(objsIncluded[i].__cachedRelations[_through]);
                    } else {
                        objectsFrom[j].__cachedRelations[relationName].push(objsIncluded[i]);
                    }
                } else {
                    if (_through) {
                        objectsFrom[j].__cachedRelations[relationName] = objsIncluded[i].__cachedRelations[_through];
                    } else {
                        objectsFrom[j].__cachedRelations[relationName] = objsIncluded[i];
                    }
                }
            }
        }

        // No relation have been found for these keys
        for (var key in keysToBeProcessed) {
            objectsFrom = objsByKeys[relation.keyFrom][key];
            for (var k = 0; k < objectsFrom.length; k++) {
                if (!objectsFrom[k].__cachedRelations) {
                    objectsFrom[k].__cachedRelations = {};
                }
                objectsFrom[k].__cachedRelations[relationName] = relation.multiple ? [] : null;
            }
        }

        cb(err, objsIncluded);
    }

    if (keyVals[relation.keyFrom].length > 0) {

        if (relation.modelThrough) {
            req['where'][relation.keyTo] = { inq: inValues };

            _model = cls.schema.models[relation.modelThrough.modelName];
            _through = i8n.camelize(relation.modelTo.modelName, true);

        } else {
            req['where'][relation.keyTo] = { inq: inValues };
            req['populate'] = subInclude;
        }

        return function (cb) {

            if (_through) {

                relation.modelThrough.all(req, function (err, objsIncluded) {

                    _model.populate(objsIncluded, _through, function (err, throughIncludes) {

                        done(err, throughIncludes, cb);
                    });
                });

            } else {

                relation.modelTo.all(req, function (err, objsIncluded) {

                    done(err, objsIncluded, cb);
                });
            }
        };
    }

    return null;
}