
module.exports = List;

function List(data, type, parent) {
    this.parent = parent;
    this.nextid = 1;
    data = this.items = data || [];
    var Item = this.ItemType = ListItem;

    if (typeof type === 'object' && type.constructor.name === 'Array') {
        this.ItemType = Item = type[0] || ListItem;
    }

    data.forEach(function (item) {
        data[i] = new Item(item, parent);
    });
}

List.prototype.toObject = function () {
    return this.items;
};

List.prototype.autoincrement = function () {
    return this.nextid++;
};

List.prototype.push = function (obj) {
    var item = new ListItem(obj, this);
    if (this.ItemType) {
        item.__proto__ = this.ItemType.prototype;
    }
    item.id = this.autoincrement();
    this.items.push(item);
    return item;
};

List.prototype.remove = function (obj) {
    var found;
    this.items.forEach(function (o, i) {
        if (o.id === obj.id) found = i;
    });
    if (found) {
        this.items.splice(i, 1);
    }
};

List.prototype.forEach = function (cb) {
    this.items.forEach(cb);
};

List.prototype.sort = function (cb) {
    return this.items.sort(cb);
};

List.prototype.map = function (cb) {
    if (typeof cb === 'function') return this.items.map(cb);
    if (typeof cb === 'string') return this.items.map(function (el) {
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
}

