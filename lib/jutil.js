exports.inherits = function(newClass, baseClass) {
    Object.keys(baseClass).forEach(classMethod => {
        newClass[classMethod] = baseClass[classMethod];
    });

    Object.keys(baseClass.prototype).forEach(instanceMethod => {
        newClass.prototype[instanceMethod] = baseClass.prototype[instanceMethod];
    });
};

