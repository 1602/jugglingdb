
module.exports = List;

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

    data.forEach(function (item, i) {
        data[i] = new Item(item, parent);
        list[data[i].id] = data[i];
        if (list.nextid <= data[i].id) {
            list.nextid = data[i].id + 1;
        }
    });

    Object.defineProperty(list, 'length', {
        enumerable: false,
        configurable: true,
        get: function () {
            return list.items.length;
        }
    });

    return list;

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
    var id = obj.id ? obj.id : obj;
    console.log(id);
    var found = false;
    this.items.forEach(function (o, i) {
        if (o.id === id) found = i;
    });
    if (found !== false) {
        delete this[id];
        this.items.splice(found, 1);
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

