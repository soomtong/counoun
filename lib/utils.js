function cloneObject (obj, options) {
    var retainKeyOrder = options && options.retainKeyOrder
        , minimize = options && options.minimize
        , ret = {}
        , hasKeys
        , keys
        , val
        , k
        , i;

    if (retainKeyOrder) {
        for (k in obj) {
            val = clone(obj[k], options);

            if (!minimize || ('undefined' !== typeof val)) {
                hasKeys || (hasKeys = true);
                ret[k] = val;
            }
        }
    } else {
        // faster

        keys = Object.keys(obj);
        i = keys.length;

        while (i--) {
            k = keys[i];
            val = clone(obj[k], options);

            if (!minimize || ('undefined' !== typeof val)) {
                if (!hasKeys) hasKeys = true;
                ret[k] = val;
            }
        }
    }

    return minimize ? hasKeys && ret : ret;
}

function cloneArray (arr, options) {
    var ret = [];
    for (var i = 0, l = arr.length; i < l; i++)
        ret.push(clone(arr[i], options));
    return ret;
}

exports.isObject = function (arg) {
    return '[object Object]' == toString.call(arg);
};

exports.getFunctionName = function(fn) {
    if (fn.name) {
        return fn.name;
    }
    return (fn.toString().trim().match(/^function\s*([^\s(]+)/) || [])[1];
};

exports.clone = function clone (obj, options) {
    if (obj === undefined || obj === null)
        return obj;

    if (Array.isArray(obj))
        return cloneArray(obj, options);

    if (obj.constructor) {
        switch (exports.getFunctionName(obj.constructor)) {
            case 'Object':
                return cloneObject(obj, options);
            case 'Date':
                return new obj.constructor(+obj);
            default:
                // ignore
                break;
        }
    }

    if (!obj.constructor && exports.isObject(obj)) {
        // object created with Object.create(null)
        return cloneObject(obj, options);
    }

    if (obj.valueOf)
        return obj.valueOf();
};

