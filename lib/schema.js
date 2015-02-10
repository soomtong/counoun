var EventEmitter = require('events').EventEmitter;
var VirtualType = require('./virtualType');
var utils = require('./utils');
var CounounTypes;

var IS_QUERY_HOOK = {
    count: true,
    find: true,
    findOne: true,
    findOneAndUpdate: true,
    update: true
};

function Schema (obj, options) {
    if (!(this instanceof Schema))
        return new Schema(obj, options);

    this.paths = {};
    this.subpaths = {};
    this.virtuals = {};
    this.nested = {};
    this.inherits = {};
    this.callQueue = [];
    this._indexes = [];
    this.methods = {};
    this.statics = {};
    this.tree = {};
    this._requiredpaths = undefined;
    this.discriminatorMapping = undefined;
    this._indexedpaths = undefined;

    this.options = this.defaultOptions(options);

    // build paths
    if (obj) {
        this.add(obj);
    }

    // adds updatedAt and createdAt timestamps to documents if enabled
    var timestamps = this.options.timestamps;
    if (timestamps) {
        var createdAt = timestamps.createdAt || 'createdAt'
            , updatedAt = timestamps.updatedAt || 'updatedAt'
            , schemaAdditions = {};

        schemaAdditions[updatedAt] = Date;

        if (!this.paths[createdAt]) {
            schemaAdditions[createdAt] = Date;
        }

        this.add(schemaAdditions);

        this.pre('save', function (next) {
            var defaultTimestamp = new Date();

            if (!this[createdAt]){
                this[createdAt] = defaultTimestamp;
            }

            this[updatedAt] = this.isNew ? this[createdAt] : defaultTimestamp;

            next();
        });
    }

    this.pre('validate', function(next) {
        delete this.errors;
        next();
    });
}

/*!
 * Returns this documents _id cast to a string.
 */

function idGetter () {
    if (this.$__._id) {
        return this.$__._id;
    }

    return this.$__._id = null == this._id
        ? null
        : String(this._id);
}

/*!
 * Inherit from EventEmitter.
 */
Schema.prototype = Object.create( EventEmitter.prototype );
Schema.prototype.constructor = Schema;

Schema.prototype.paths;
Schema.prototype.tree;

Schema.prototype.defaultOptions = function (options) {
    if (options && false === options.safe) {
        options.safe = { w: 0 };
    }

    if (options && options.safe && 0 === options.safe.w) {
        // if you turn off safe writes, then versioning goes off as well
        options.versionKey = false;
    }

    options = utils.options({
        strict: true
        , bufferCommands: true
        , capped: false // { size, max, autoIndexId }
        , versionKey: '__v'
        , discriminatorKey: '__t'
        , minimize: true
        , autoIndex: null
        , shardKey: null
        , read: null
        , validateBeforeSave: true
        // the following are only applied at construction time
        , noId: false // deprecated, use { _id: false }
        , _id: true
        , noVirtualId: false // deprecated, use { id: false }
        , id: true
//    , pluralization: true  // only set this to override the global option
    }, options);

    if (options.read) {
        options.read = utils.readPref(options.read);
    }

    return options;
};

Schema.prototype.add = function add (obj, prefix) {
    prefix = prefix || '';
    var keys = Object.keys(obj);

    for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];

        if (null == obj[key]) {
            throw new TypeError('Invalid value for schema path `'+ prefix + key +'`');
        }

        if (Array.isArray(obj[key]) && obj[key].length === 1 && null == obj[key][0]) {
            throw new TypeError('Invalid value for schema Array path `'+ prefix + key +'`');
        }

        if (utils.isObject(obj[key]) && (!obj[key].constructor || 'Object' == utils.getFunctionName(obj[key].constructor)) && (!obj[key].type || obj[key].type.type)) {
            if (Object.keys(obj[key]).length) {
                // nested object { last: { name: String }}
                this.nested[prefix + key] = true;
                this.add(obj[key], prefix + key + '.');
            } else {
                this.path(prefix + key, obj[key]); // mixed type
            }
        } else {
            this.path(prefix + key, obj[key]);
        }
    }
};

Schema.reserved = Object.create(null);
var reserved = Schema.reserved;
reserved.on =
reserved.once =
reserved.db =
reserved.set =
reserved.get =
reserved.init =
reserved.isNew =
reserved.errors =
reserved.schema =
reserved.modelName =
reserved.collection =
reserved.toObject =
reserved.save =
reserved.validate =
reserved.emit =    // EventEmitter
reserved._pres = reserved._posts = 1 // hooks.js

Schema.prototype.path = function (path, obj) {
    if (obj == undefined) {
        if (this.paths[path]) return this.paths[path];
        if (this.subpaths[path]) return this.subpaths[path];

        // subpaths?
        return /\.\d+\.?.*$/.test(path)
            ? getPositionalPath(this, path)
            : undefined;
    }

    // some path names conflict with document methods
    if (reserved[path]) {
        throw new Error("`" + path + "` may not be used as a schema pathname");
    }

    // update the tree
    var subpaths = path.split(/\./)
        , last = subpaths.pop()
        , branch = this.tree;

    subpaths.forEach(function(sub, i) {
        if (!branch[sub]) branch[sub] = {};
        if ('object' != typeof branch[sub]) {
            var msg = 'Cannot set nested path `' + path + '`. '
                + 'Parent path `'
                + subpaths.slice(0, i).concat([sub]).join('.')
                + '` already set to type ' + branch[sub].name
                + '.';
            throw new Error(msg);
        }
        branch = branch[sub];
    });

    branch[last] = utils.clone(obj);

    this.paths[path] = Schema.interpretAsType(path, obj);
    return this;
};

Schema.interpretAsType = function (path, obj) {
    if (obj.constructor) {
        var constructorName = utils.getFunctionName(obj.constructor);
        if (constructorName != 'Object') {
            obj = { type: obj };
        }
    }

    // Get the type making sure to allow keys named "type"
    // and default to mixed if not specified.
    // { type: { type: String, default: 'freshcut' } }
    var type = obj.type && !obj.type.type
        ? obj.type
        : {};

    if ('Object' == utils.getFunctionName(type.constructor) || 'mixed' == type) {
        return new CounounTypes.Mixed(path, obj);
    }

    if (Array.isArray(type) || Array == type || 'array' == type) {
        // if it was specified through { type } look for `cast`
        var cast = (Array == type || 'array' == type)
            ? obj.cast
            : type[0];

        if (cast instanceof Schema) {
            return new CounounTypes.DocumentArray(path, cast, obj);
        }

        if ('string' == typeof cast) {
            cast = CounounTypes[cast.charAt(0).toUpperCase() + cast.substring(1)];
        } else if (cast && (!cast.type || cast.type.type)
            && 'Object' == utils.getFunctionName(cast.constructor)
            && Object.keys(cast).length) {
            return new CounounTypes.DocumentArray(path, new Schema(cast), obj);
        }

        return new CounounTypes.Array(path, cast || CounounTypes.Mixed, obj);
    }

    var name;

    if (Buffer.isBuffer(type)) {
        name = 'Buffer';
    } else {
        name = 'string' == typeof type
            ? type
            // If not string, `type` is a function. Outside of IE, function.name
            // gives you the function name. In IE, you need to compute it
            : type.schemaName || utils.getFunctionName(type);
    }

    if (name) {
        name = name.charAt(0).toUpperCase() + name.substring(1);
    }

    if (undefined == CounounTypes[name]) {
        throw new TypeError('Undefined type `' + name + '` at `' + path +
        '`\n  Did you try nesting Schemas? ' +
        'You can only nest using refs or arrays.');
    }

    return new CounounTypes[name](path, obj);
};

Schema.prototype.eachPath = function (fn) {
    var keys = Object.keys(this.paths)
        , len = keys.length;

    for (var i = 0; i < len; ++i) {
        fn(keys[i], this.paths[keys[i]]);
    }

    return this;
};

Schema.prototype.queue = function(name, args){
    this.callQueue.push([name, args]);
    return this;
};

Schema.prototype.pre = function() {
    var name = arguments[0];
    if (IS_QUERY_HOOK[name]) {
        this.s.hooks.pre.apply(this.s.hooks, arguments);
        return this;
    }
    return this.queue('pre', arguments);
};

Schema.prototype.post = function(method, fn) {
    if (IS_QUERY_HOOK[method]) {
        this.s.hooks.post.apply(this.s.hooks, arguments);
        return this;
    }
    // assuming that all callbacks with arity < 2 are synchronous post hooks
    if (fn.length < 2) {
        return this.queue('on', arguments);
    }

    return this.queue('post', [arguments[0], function(next){
        // wrap original function so that the callback goes last,
        // for compatibility with old code that is using synchronous post hooks
        fn.call(this, this, next);
    }]);
};

Schema.prototype.method = function (name, fn) {
    if ('string' != typeof name)
        for (var i in name)
            this.methods[i] = name[i];
    else
        this.methods[name] = fn;

    return this;
};

Schema.prototype.set = function (key, value, _tags) {
    if (1 === arguments.length) {
        return this.options[key];
    }

    switch (key) {
        case 'read':
            this.options[key] = utils.readPref(value, _tags)
            break;
        case 'safe':
            this.options[key] = false === value
                ? { w: 0 }
                : value
            break;
        default:
            this.options[key] = value;
    }

    return this;
};

Schema.prototype.get = function (key) {
    return this.options[key];
};

var indexTypes = '2d 2dsphere hashed text'.split(' ');

Object.defineProperty(Schema, 'indexTypes', {
    get: function () { return indexTypes }
    , set: function () { throw new Error('Cannot overwrite Schema.indexTypes') }
});


module.exports = exports = Schema;

// require down here because of reference issues

Schema.Types = CounounTypes = require('./schema/index');

var ObjectID = exports.ObjectID = CounounTypes.ObjectID;
