var utils = require('./utils');
var SchemaType = require('./schemaType');

function getPositionalPath (self, path) {
    var subPaths = path.split(/\.(\d+)\.|\.(\d+)$/).filter(Boolean);
    if (subPaths.length < 2) {
        return self.paths[subPaths[0]];
    }

    var val = self.path(subPaths[0]);
    if (!val) return val;

    var last = subPaths.length - 1
        , subPath
        , i = 1;

    for (; i < subPaths.length; ++i) {
        subPath = subPaths[i];

        if (i === last && val && !val.schema && !/\D/.test(subPath)) {
            if (val instanceof CounounTypes.Array) {
                // StringSchema, NumberSchema, etc
                val = val.caster;
            } else {
                val = undefined;
            }
            break;
        }

        // ignore if its just a position segment: path.0.subPath
        if (!/\D/.test(subPath)) continue;

        if (!(val && val.schema)) {
            val = undefined;
            break;
        }

        val = val.schema.path(subPath);
    }

    return self.subPaths[path] = val;
}

function Schema (obj, options) {
    if (!(this instanceof Schema)) return new Schema(obj, options);

    this.paths = {};
    this.subPaths = {};
    this.nested = {};
    this.tree = {};

    if (obj) {
        this.add(obj);
    }

}

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

Schema.prototype.path = function (path, obj) {
    if (obj == undefined) {
        if (this.paths[path]) return this.paths[path];
        if (this.subPaths[path]) return this.subPaths[path];

        // subPaths?
        return /\.\d+\.?.*$/.test(path) ? getPositionalPath(this, path) : undefined;
    }

    // some path names conflict with document methods
    if (reserved[path]) {
        throw new Error("`" + path + "` may not be used as a schema pathname");
    }

    // update the tree
    var subPaths = path.split(/\./)
        , last = subPaths.pop()
        , branch = this.tree;

    subPaths.forEach(function(sub, i) {
        if (!branch[sub]) branch[sub] = {};
        if ('object' != typeof branch[sub]) {
            var msg = 'Cannot set nested path `' + path + '`. '
                + 'Parent path `'
                + subPaths.slice(0, i).concat([sub]).join('.')
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

Schema.Types = CounounTypes = require('./schemaType');

Schema.interpretAsType = function (path, obj) {
    if (obj.constructor) {
        var constructorName = utils.getFunctionName(obj.constructor);
        if (constructorName != 'Object') {
            obj = { type: obj };
        }
    }

    var type = obj.type && !obj.type.type ? obj.type : {};

    if ('Object' == utils.getFunctionName(type.constructor) || 'mixed' == type) {
        return new CounounTypes.Mixed(path, obj);
    }

    if (Array.isArray(type) || Array == type || 'array' == type) {
        // if it was specified through { type } look for `cast`
        var cast = (Array == type || 'array' == type) ? obj.cast : type[0];

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
        name = 'string' == typeof type ? type : type.schemaName || utils.getFunctionName(type);
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

Schema.prototype.save = function () {
    console.error('@@@@@@@ save @@@@@@@');
};

Schema.reserved = Object.create(null);
var reserved = Schema.reserved;
reserved.on =
reserved.once =
reserved.nano =
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


module.exports = exports = Schema;
