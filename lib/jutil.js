exports.inherits = function (newClass, baseClass) {
    Object.keys(baseClass).forEach(function (classMethod) {
        newClass[classMethod] = baseClass[classMethod];
    });
    Object.keys(baseClass.prototype).forEach(function (instanceMethod) {
        newClass.prototype[instanceMethod] = baseClass.prototype[instanceMethod];
    });
};

