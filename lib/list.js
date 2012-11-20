
module.exports = List;

/**
 * List class provides functionality of nested collection
 *
 * @param {Array} data - array of items.
 * @param {Crap} type - array with some type information? TODO: rework this API.
 * @param {AbstractClass} parent - owner of list.
 * @constructor
 */
function List(data, type, parent) {
    var list = this;

    Object.defineProperty(list, 'parent', {
        writable: false,
        enumerable: false,
        configurable: false,
        value: parent
    });

    Object.defineProperty(list, 'nextid', {
        writable: true,
        enumerable: false,
        value: 1
    });

    data = list.items = data || [];
    var Item = list.ItemType = ListItem;

    if (typeof type === 'object' && type.constructor.name === 'Array') {
        list.ItemType = type[0] || ListItem;
    }

    data.forEach(function(item, i) {
        data[i] = new Item(item, list);
        Object.defineProperty(list, data[i].id, {
            writable: true,
            enumerable: false,
            configurable: true,
            value: data[i]
        });
        if (list.nextid <= data[i].id) {
            list.nextid = data[i].id + 1;
        }
    });

    Object.defineProperty(list, 'length', {
        enumerable: false,
        configurable: true,
        get: function() {
            return list.items.length;
        }
    });

    return list;

}

var _;
try {
    _ = require('underscore');
} catch (e) {
    _ = false;
}

if (_) {
    var _import = [
        // collection methods
        'each',
        'map',
        'reduce',
        'reduceRight',
        'find',
        'filter',
        'reject',
        'all',
        'any',
        'include',
        'invoke',
        'pluck',
        'max',
        'min',
        'sortBy',
        'groupBy',
        'sortedIndex',
        'shuffle',
        'toArray',
        'size',
        // array methods
        'first',
        'initial',
        'last',
        'rest',
        'compact',
        'flatten',
        'without',
        'union',
        'intersection',
        'difference',
        'uniq',
        'zip',
        'indexOf',
        'lastIndexOf',
        'range'
    ];

    _import.forEach(function(name) {
        List.prototype[name] = function() {
            var args = [].slice.call(arguments);
            args.unshift(this.items);
            return _[name].apply(_, args);
        };
    });
}

List.prototype.toObject = function() {
    return this.items;
};

List.prototype.toJSON = function() {
    return this.items;
};

List.prototype.toString = function() {
    return JSON.stringify(this.items);
};

List.prototype.autoincrement = function() {
    return this.nextid++;
};

List.prototype.push = function(obj) {
    var item = new ListItem(obj, this);
    this.items.push(item);
    return item;
};

List.prototype.remove = function(obj) {
    var id = obj.id ? obj.id : obj;
    var found = false;
    this.items.forEach(function(o, i) {
        if (id && o.id == id) {
            found = i;
            if (o.id !== id) {
                console.log('WARNING! Type of id not matched');
            }
        }
    });
    if (found !== false) {
        delete this[id];
        this.items.splice(found, 1);
    }
};

List.prototype.forEach = function(cb) {
    this.items.forEach(cb);
};

List.prototype.sort = function(cb) {
    return this.items.sort(cb);
};

List.prototype.map = function(cb) {
    if (typeof cb === 'function') return this.items.map(cb);
    if (typeof cb === 'string') return this.items.map(function(el) {
        if (typeof el[cb] === 'function') return el[cb]();
        if (el.hasOwnProperty(cb)) return el[cb];
    });
};

function ListItem(data, parent) {
    for (var i in data) this[i] = data[i];
    Object.defineProperty(this, 'parent', {
        writable: false,
        enumerable: false,
        configurable: true,
        value: parent
    });
    if (!this.id) {
        this.id = parent.autoincrement();
    }
    if (parent.ItemType) {
        this.__proto__ = parent.ItemType.prototype;
        if (parent.ItemType !== ListItem) {
            parent.ItemType.apply(this);
        }
    }

    this.save = function(c) {
        parent.parent.save(c);
    };
}

