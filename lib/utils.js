exports.safeRequire = safeRequire;

function safeRequire(module) {
    try {
        return require(module);
    } catch (e) {
        console.log('Run "npm install ' + module + '" command to use jugglingdb using this database engine');
        process.exit(1);
    }
}

exports.async = function(fun){
    try{
        var Q = require('q');
    }catch(ex){}
    if(Q){
        return function(){
            if(arguments.length > 0 && 
                typeof arguments[arguments.length-1] === 'function'){
                return fun.apply(this, arguments);
            }else{
                var args = Array.prototype.slice.call(arguments,0);
                var deferred = Q.defer();
                args.push(deferred.makeNodeResolver());
                fun.apply(this, args);
                return deferred.promise;
            }
        };
    }else{
        return fun;
    }
}