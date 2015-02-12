var EventEmitter = require('events').EventEmitter
  , setMaxListeners = EventEmitter.prototype.setMaxListeners
  , CounounError = require('./error')
  , MixedSchema = require('./schema/mixed')
  , Schema = require('./schema')
  , ObjectID = require('./types/objectID')
  , ValidatorError = require('./schemaType').ValidatorError
  , utils = require('./utils')
  , clone = utils.clone
  , isCounounObject = utils.isCounounObject
  , inspect = require('util').inspect
  , ValidationError = CounounError.ValidationError
  , InternalCache = require('./internal')
  , deepEqual = utils.deepEqual
  //, hooks = require('hooks-fixed')
  , Promise = require('./promise')
  , DocumentArray
  , CounounArray
  , Embedded;


function Document (obj, fields, skipId) {
  this.$__ = new InternalCache;
  this.$__.emitter = new EventEmitter();
  this.isNew = true;
  this.errors = undefined;

  var schema = this.schema;

  if ('boolean' === typeof fields) {
    this.$__.strictMode = fields;
    fields = undefined;
  } else {
    this.$__.strictMode = schema.options && schema.options.strict;
    this.$__.selected = fields;
  }

  var required = schema.requiredPaths();
  for (var i = 0; i < required.length; ++i) {
    this.$__.activePaths.require(required[i]);
  }

  this.$__.emitter.setMaxListeners(0);
  this._doc = this.$__buildDoc(obj, fields, skipId);

  if (obj) {
    this.set(obj, undefined, true);
  }

  if (!schema.options.strict && obj) {
    var self = this
      , keys = Object.keys(this._doc);

    keys.forEach(function(key) {
      if (!(key in schema.tree)) {
        define(key, null, self);
      }
    });
  }

  this.$__registerHooksFromSchema();
}

utils.each(
    ['on', 'once', 'emit', 'listeners', 'removeListener', 'setMaxListeners', 'removeAllListeners'],
    function (emitterFn) {
        Document.prototype[emitterFn] = function () {
            return this.$__.emitter[emitterFn].apply(this.$__.emitter, arguments);
        };
    });

Document.prototype.constructor = Document;

Document.prototype.schema;

Document.prototype.isNew;

Document.prototype.id;

Document.prototype.errors;

Document.prototype.$__buildDoc = function (obj, fields, skipId) {
    var doc = {}
        , self = this
        , exclude
        , keys
        , key
        , ki;

    if (fields && 'Object' === utils.getFunctionName(fields.constructor)) {
        keys = Object.keys(fields);
        ki = keys.length;

        while (ki--) {
            if ('_id' !== keys[ki]) {
                exclude = 0 === fields[keys[ki]];
                break;
            }
        }
    }

    var paths = Object.keys(this.schema.paths)
        , plen = paths.length
        , ii = 0

    for (; ii < plen; ++ii) {
        var p = paths[ii];

        if ('_id' == p) {
            if (skipId) continue;
            if (obj && '_id' in obj) continue;
        }

        var type = this.schema.paths[p]
            , path = p.split('.')
            , len = path.length
            , last = len - 1
            , curPath = ''
            , doc_ = doc
            , i = 0

        for (; i < len; ++i) {
            var piece = path[i]
                , def

            // support excluding intermediary levels
            if (exclude) {
                curPath += piece;
                if (curPath in fields) break;
                curPath += '.';
            }

            if (i === last) {
                if (fields) {
                    if (exclude) {
                        // apply defaults to all non-excluded fields
                        if (p in fields) continue;

                        def = type.getDefault(self, true);
                        if ('undefined' !== typeof def) {
                            doc_[piece] = def;
                            self.$__.activePaths.default(p);
                        }

                    } else if (p in fields) {
                        // selected field
                        def = type.getDefault(self, true);
                        if ('undefined' !== typeof def) {
                            doc_[piece] = def;
                            self.$__.activePaths.default(p);
                        }
                    }
                } else {
                    def = type.getDefault(self, true);
                    if ('undefined' !== typeof def) {
                        doc_[piece] = def;
                        self.$__.activePaths.default(p);
                    }
                }
            } else {
                doc_ = doc_[piece] || (doc_[piece] = {});
            }
        }
    }

    return doc;
};

Document.prototype.init = function (doc, opts, fn) {
    // do not prefix this method with $__ since its
    // used by public hooks

    if ('function' == typeof opts) {
        fn = opts;
        opts = null;
    }

    this.isNew = false;

    // handle docs with populated paths
    // If doc._id is not null or undefined
    if (doc._id != null && opts && opts.populated && opts.populated.length) {
        var id = String(doc._id);
        for (var i = 0; i < opts.populated.length; ++i) {
            var item = opts.populated[i];
            this.populated(item.path, item._docs[id], item);
        }
    }

    init(this, doc, this._doc);
    this.$__storeShard();

    this.emit('init', this);
    if (fn) fn(null);
    return this;
};

function init (self, obj, doc, prefix) {
    prefix = prefix || '';

    var keys = Object.keys(obj)
        , len = keys.length
        , schema
        , path
        , i;

    while (len--) {
        i = keys[len];
        path = prefix + i;
        schema = self.schema.path(path);

        if (!schema && utils.isObject(obj[i]) &&
            (!obj[i].constructor || 'Object' == utils.getFunctionName(obj[i].constructor))) {
            // assume nested object
            if (!doc[i]) doc[i] = {};
            init(self, obj[i], doc[i], path + '.');
        } else {
            if (obj[i] === null) {
                doc[i] = null;
            } else if (obj[i] !== undefined) {
                if (schema) {
                    try {
                        doc[i] = schema.cast(obj[i], self, true);
                    } catch (e) {
                        self.invalidate(e.path, new ValidatorError({
                            path: e.path,
                            message: e.message,
                            type: 'cast',
                            value: e.value
                        }));
                    }
                } else {
                    doc[i] = obj[i];
                }
            }
            // mark as hydrated
            if (!self.isModified(path)) {
                self.$__.activePaths.init(path);
            }
        }
    }
}

Document.prototype.$__storeShard = function () {
    // backwards compat
    var key = this.schema.options.shardKey || this.schema.options.shardkey;
    if (!(key && 'Object' == utils.getFunctionName(key.constructor))) return;

    var orig = this.$__.shardval = {}
        , paths = Object.keys(key)
        , len = paths.length
        , val

    for (var i = 0; i < len; ++i) {
        val = this.getValue(paths[i]);
        if (isCounounObject(val)) {
            orig[paths[i]] = val.toObject({depopulate: true})
        } else if (null != val && val.valueOf && (!val.constructor || utils.getFunctionName(val.constructor) !== 'Date')) {
            orig[paths[i]] = val.valueOf();
        } else {
            orig[paths[i]] = val;
        }
    }
};

/*!
 * Set up middleware support
 */

//for (var k in hooks) {
//  Document.prototype[k] = Document[k] = hooks[k];
//}

Document.prototype.update = function update () {
  var args = utils.args(arguments);
  args.unshift({_id: this._id});
  return this.constructor.update.apply(this.constructor, args);
};

Document.prototype.set = function (path, val, type, options) {
    if (type && 'Object' == utils.getFunctionName(type.constructor)) {
        options = type;
        type = undefined;
    }

    var merge = options && options.merge
        , adhoc = type && true !== type
        , constructing = true === type
        , adhocs

    var strict = options && 'strict' in options
        ? options.strict
        : this.$__.strictMode;

    if (adhoc) {
        adhocs = this.$__.adhocPaths || (this.$__.adhocPaths = {});
        adhocs[path] = Schema.interpretAsType(path, type);
    }

    if ('string' !== typeof path) {
        // new Document({ key: val })

        if (null === path || undefined === path) {
            var _ = path;
            path = val;
            val = _;

        } else {
            var prefix = val
                ? val + '.'
                : '';

            if (path instanceof Document) path = path._doc;

            var keys = Object.keys(path)
                , i = keys.length
                , pathtype
                , key;

            while (i--) {
                key = keys[i];
                pathtype = this.schema.pathType(prefix + key);
                if (null != path[key]
                    && utils.isObject(path[key])
                    && (!path[key].constructor || 'Object' == utils.getFunctionName(path[key].constructor))
                    && 'virtual' != pathtype
                    && !(this.$__path(prefix + key) instanceof MixedSchema)
                    && !(this.schema.paths[key] && this.schema.paths[key].options.ref)
                ) {
                    this.set(path[key], prefix + key, constructing);
                } else if (strict) {
                    if ('real' === pathtype || 'virtual' === pathtype) {
                        this.set(prefix + key, path[key], constructing);
                    } else if ('throw' == strict) {
                        throw new Error("Field `" + key + "` is not in schema.");
                    }
                } else if (undefined !== path[key]) {
                    this.set(prefix + key, path[key], constructing);
                }
            }

            return this;
        }
    }

    // ensure _strict is honored for obj props
    // docschema = new Schema({ path: { nest: 'string' }})
    // doc.set('path', obj);
    var pathType = this.schema.pathType(path);
    if ('nested' == pathType && val && utils.isObject(val) &&
        (!val.constructor || 'Object' == utils.getFunctionName(val.constructor))) {
        if (!merge) this.setValue(path, null);
        this.set(val, path, constructing);
        return this;
    }

    var schema;
    var parts = path.split('.');

    if ('adhocOrUndefined' == pathType && strict) {

        // check for roots that are Mixed types
        var mixed;

        for (var i = 0; i < parts.length; ++i) {
            var subpath = parts.slice(0, i + 1).join('.');
            schema = this.schema.path(subpath);
            if (schema instanceof MixedSchema) {
                // allow changes to sub paths of mixed types
                mixed = true;
                break;
            }
        }

        if (!mixed) {
            if ('throw' == strict) {
                throw new Error("Field `" + path + "` is not in schema.");
            }
            return this;
        }

    } else if ('virtual' == pathType) {
        schema = this.schema.virtualpath(path);
        schema.applySetters(val, this);
        return this;
    } else {
        schema = this.$__path(path);
    }

    var pathToMark;

    // When using the $set operator the path to the field must already exist.
    // Else mongodb throws: "LEFT_SUBFIELD only supports Object"

    if (parts.length <= 1) {
        pathToMark = path;
    } else {
        for (var i = 0; i < parts.length; ++i) {
            var subpath = parts.slice(0, i + 1).join('.');
            if (this.isDirectModified(subpath) // earlier prefixes that are already
                    // marked as dirty have precedence
                || this.get(subpath) === null) {
                pathToMark = subpath;
                break;
            }
        }

        if (!pathToMark) pathToMark = path;
    }

    // if this doc is being constructed we should not trigger getters
    var priorVal = constructing
        ? undefined
        : this.getValue(path);

    if (!schema) {
        this.$__set(pathToMark, path, constructing, parts, schema, val, priorVal);
        return this;
    }

    var shouldSet = true;

    try {
        // If the user is trying to set a ref path to a document with
        // the correct model name, treat it as populated
        if (schema.options &&
            schema.options.ref &&
            val instanceof Document &&
            schema.options.ref === val.constructor.modelName) {
            this.populated(path, val);
        }
        val = schema.applySetters(val, this, false, priorVal);
    } catch (e) {
        this.invalidate(e.path, new ValidatorError({
            path: e.path,
            message: e.message,
            type: 'cast',
            value: e.value
        }));
        shouldSet = false;
    }

    if (shouldSet) {
        this.$__set(pathToMark, path, constructing, parts, schema, val, priorVal);
    }

    return this;
};

Document.prototype.$__shouldModify = function (pathToMark, path, constructing, parts, schema, val, priorVal) {

    if (this.isNew) return true;

    if (undefined === val && !this.isSelected(path)) {
        // when a path is not selected in a query, its initial
        // value will be undefined.
        return true;
    }

    if (undefined === val && path in this.$__.activePaths.states.default) {
        // we're just unsetting the default value which was never saved
        return false;
    }

    if (!deepEqual(val, priorVal || this.get(path))) {
        return true;
    }

    if (!constructing && null != val && path in this.$__.activePaths.states.default && deepEqual(val, schema.getDefault(this, constructing))) {
        // a path with a default was $unset on the server
        // and the user is setting it to the same value again
        return true;
    }

    return false;
};

Document.prototype.$__set = function (pathToMark, path, constructing, parts, schema, val, priorVal) {
    Embedded = Embedded || require('./types/embedded');

    var shouldModify = this.$__shouldModify.apply(this, arguments);
    var _this = this;

    if (shouldModify) {
        this.markModified(pathToMark, val);

        // handle directly setting arrays (gh-1126)
        CounounArray || (CounounArray = require('./types/array'));
        if (val && val.isCounounArray) {
            val._registerAtomic('$set', val);

            // Small hack for gh-1638: if we're overwriting the entire array, ignore
            // paths that were modified before the array overwrite
            this.$__.activePaths.forEach(function (modifiedPath) {
                if (modifiedPath.indexOf(path + '.') === 0) {
                    _this.$__.activePaths.ignore(modifiedPath);
                }
            });
        }
    }

    var obj = this._doc
        , i = 0
        , l = parts.length;

    for (; i < l; i++) {
        var next = i + 1
            , last = next === l;

        if (last) {
            obj[parts[i]] = val;
        } else {
            if (obj[parts[i]] && 'Object' === utils.getFunctionName(obj[parts[i]].constructor)) {
                obj = obj[parts[i]];
            } else if (obj[parts[i]] && obj[parts[i]] instanceof Embedded) {
                obj = obj[parts[i]];
            } else if (obj[parts[i]] && Array.isArray(obj[parts[i]])) {
                obj = obj[parts[i]];
            } else {
                obj = obj[parts[i]] = {};
            }
        }
    }
};

Document.prototype.getValue = function (path) {
    return utils.getValue(path, this._doc);
};

Document.prototype.setValue = function (path, val) {
    utils.setValue(path, val, this._doc);
    return this;
};

Document.prototype.get = function (path, type) {
    var adhocs;

    if (type) {
        adhocs = this.$__.adhocPaths || (this.$__.adhocPaths = {});
        adhocs[path] = Schema.interpretAsType(path, type);
    }

    var schema = this.$__path(path) || this.schema.virtualpath(path)
        , pieces = path.split('.')
        , obj = this._doc;

    for (var i = 0, l = pieces.length; i < l; i++) {
        obj = undefined === obj || null === obj
            ? undefined
            : obj[pieces[i]];
    }

    if (schema) {
        obj = schema.applyGetters(obj, this);
    }

    return obj;
};

Document.prototype.$__path = function (path) {
    var adhocs = this.$__.adhocPaths
        , adhocType = adhocs && adhocs[path];

    if (adhocType) {
        return adhocType;
    } else {
        return this.schema.path(path);
    }
};

Document.prototype.markModified = function (path) {
  this.$__.activePaths.modify(path);
};

Document.prototype.modifiedPaths = function () {
    var directModifiedPaths = Object.keys(this.$__.activePaths.states.modify);

    return directModifiedPaths.reduce(function (list, path) {
        var parts = path.split('.');
        return list.concat(parts.reduce(function (chains, part, i) {
            return chains.concat(parts.slice(0, i).concat(part).join('.'));
        }, []));
    }, []);
};

Document.prototype.isModified = function (path) {
    return path
        ? !!~this.modifiedPaths().indexOf(path)
        : this.$__.activePaths.some('modify');
};

Document.prototype.isDirectModified = function (path) {
    return (path in this.$__.activePaths.states.modify);
};

Document.prototype.isInit = function (path) {
    return (path in this.$__.activePaths.states.init);
};

Document.prototype.isSelected = function isSelected (path) {
    if (this.$__.selected) {

        if ('_id' === path) {
            return 0 !== this.$__.selected._id;
        }

        var paths = Object.keys(this.$__.selected)
            , i = paths.length
            , inclusive = false
            , cur

        if (1 === i && '_id' === paths[0]) {
            // only _id was selected.
            return 0 === this.$__.selected._id;
        }

        while (i--) {
            cur = paths[i];
            if ('_id' == cur) continue;
            inclusive = !!this.$__.selected[cur];
            break;
        }

        if (path in this.$__.selected) {
            return inclusive;
        }

        i = paths.length;
        var pathDot = path + '.';

        while (i--) {
            cur = paths[i];
            if ('_id' == cur) continue;

            if (0 === cur.indexOf(pathDot)) {
                return inclusive;
            }

            if (0 === pathDot.indexOf(cur + '.')) {
                return inclusive;
            }
        }

        return !inclusive;
    }

    return true;
};

Document.prototype.validate = function (cb) {
    var self = this;
    var promise = new Promise(cb);

    var preSaveErr = self.$__presaveValidate();
    if (preSaveErr) {
        promise.reject(preSaveErr);
        return promise;
    }

    // only validate required fields when necessary
    var paths = Object.keys(this.$__.activePaths.states.require).filter(function (path) {
        if (!self.isSelected(path) && !self.isModified(path)) return false;
        return true;
    });

    paths = paths.concat(Object.keys(this.$__.activePaths.states.init));
    paths = paths.concat(Object.keys(this.$__.activePaths.states.modify));
    paths = paths.concat(Object.keys(this.$__.activePaths.states.default));

    if (0 === paths.length) {
        process.nextTick(function () {
            complete();
        });
        return promise;
    }

    var validating = {}
        , total = 0;

    // gh-661: if a whole array is modified, make sure to run validation on all
    // the children as well
    for (var i = 0; i < paths.length; ++i) {
        var path = paths[i];
        var val = self.getValue(path);
        if (val instanceof Array && !Buffer.isBuffer(val) && !val.isCounounDocumentArray) {
            var numElements = val.length;
            for (var j = 0; j < numElements; ++j) {
                paths.push(path + '.' + j);
            }
        }
    }
    paths.forEach(validatePath);
    return promise;

    function validatePath(path) {
        if (validating[path]) return;

        validating[path] = true;
        total++;

        process.nextTick(function () {
            var p = self.schema.path(path);
            if (!p) return --total || complete();

            var val = self.getValue(path);
            p.doValidate(val, function (err) {
                if (err) {
                    self.invalidate(path, err, undefined, true);
                }
                --total || complete();
            }, self);
        });
    }

    function complete() {
        var err = self.$__.validationError;
        self.$__.validationError = undefined;
        self.emit('validate', self);
        if (err) {
            promise.reject(err);
        } else {
            promise.fulfill();
        }
    }
};

Document.prototype.validateSync = function () {
    var self = this;

    // only validate required fields when necessary
    var paths = Object.keys(this.$__.activePaths.states.require).filter(function (path) {
        if (!self.isSelected(path) && !self.isModified(path)) return false;
        return true;
    });

    paths = paths.concat(Object.keys(this.$__.activePaths.states.init));
    paths = paths.concat(Object.keys(this.$__.activePaths.states.modify));
    paths = paths.concat(Object.keys(this.$__.activePaths.states.default));

    var validating = {};

    paths.forEach(function (path) {
        if (validating[path]) return;

        validating[path] = true;

        var p = self.schema.path(path);
        if (!p) return;

        var val = self.getValue(path);
        var err = p.doValidateSync(val, self);
        if (err) {
            self.invalidate(path, err, undefined, true);
        }
    });

    var err = self.$__.validationError;
    self.$__.validationError = undefined;
    self.emit('validate', self);

    return err;
};

Document.prototype.invalidate = function (path, err, val) {
    if (!this.$__.validationError) {
        this.$__.validationError = new ValidationError(this);
    }

    if (this.$__.validationError.errors[path]) return;

    if (!err || 'string' === typeof err) {
        err = new ValidatorError({
            path: path,
            message: err,
            type: 'user defined',
            value: val
        });
    }

    if (this.$__.validationError == err) return;

    this.$__.validationError.errors[path] = err;
};

Document.prototype.$__reset = function reset () {
    var self = this;
    DocumentArray || (DocumentArray = require('./types/documentArray'));

    this.$__.activePaths
        .map('init', 'modify', function (i) {
            return self.getValue(i);
        })
        .filter(function (val) {
            return val && val instanceof Array && val.isCounounDocumentArray && val.length;
        })
        .forEach(function (array) {
            var i = array.length;
            while (i--) {
                var doc = array[i];
                if (!doc) continue;
                doc.$__reset();
            }
        });

    // clear atomics
    this.$__dirty().forEach(function (dirt) {
        var type = dirt.value;
        if (type && type._atomics) {
            type._atomics = {};
        }
    });

    // Clear 'modify'('dirty') cache
    this.$__.activePaths.clear('modify');
    this.$__.validationError = undefined;
    this.errors = undefined;
    var self = this;
    this.schema.requiredPaths().forEach(function (path) {
        self.$__.activePaths.require(path);
    });

    return this;
};

Document.prototype.$__dirty = function () {
    var self = this;

    var all = this.$__.activePaths.map('modify', function (path) {
        return {
            path: path
            , value: self.getValue(path)
            , schema: self.$__path(path)
        };
    });

    // Sort dirty paths in a flat hierarchy.
    all.sort(function (a, b) {
        return (a.path < b.path ? -1 : (a.path > b.path ? 1 : 0));
    });

    // Ignore "foo.a" if "foo" is dirty already.
    var minimal = []
        , lastPath
        , top;

    all.forEach(function (item, i) {
        if (item.path.indexOf(lastPath) !== 0) {
            lastPath = item.path + '.';
            minimal.push(item);
            top = item;
        } else {
            // special case for top level CounounArrays
            if (top.value && top.value._atomics && top.value.hasAtomics()) {
                // the `top` array itself and a sub path of `top` are being modified.
                // the only way to honor all of both modifications is through a $set
                // of entire array.
                top.value._atomics = {};
                top.value._atomics.$set = top.value;
            }
        }
    });

    top = lastPath = null;
    return minimal;
};

function compile(tree, proto, prefix) {
    var keys = Object.keys(tree)
        , i = keys.length
        , limb
        , key;

    while (i--) {
        key = keys[i];
        limb = tree[key];

        define(key
            , (('Object' === utils.getFunctionName(limb.constructor)
            && Object.keys(limb).length)
            && (!limb.type || limb.type.type)
                ? limb
                : null)
            , proto
            , prefix
            , keys);
    }
}

function getOwnPropertyDescriptors(object) {
    var result = {};

    Object.getOwnPropertyNames(object).forEach(function (key) {
        result[key] = Object.getOwnPropertyDescriptor(object, key);
        result[key].enumerable = false;
    });

    return result;
}

function define(prop, subprops, prototype, prefix, keys) {
    var prefix = prefix || ''
        , path = (prefix ? prefix + '.' : '') + prop;

    if (subprops) {

        Object.defineProperty(prototype, prop, {
            enumerable: true
            , configurable: true
            , get: function () {
                if (!this.$__.getters)
                    this.$__.getters = {};

                if (!this.$__.getters[path]) {
                    var nested = Object.create(Object.getPrototypeOf(this), getOwnPropertyDescriptors(this));

                    // save scope for nested getters/setters
                    if (!prefix) nested.$__.scope = this;

                    // shadow inherited getters from sub-objects so
                    // thing.nested.nested.nested... doesn't occur (gh-366)
                    var i = 0
                        , len = keys.length;

                    for (; i < len; ++i) {
                        // over-write the parents getter without triggering it
                        Object.defineProperty(nested, keys[i], {
                            enumerable: false   // It doesn't show up.
                            , writable: true      // We can set it later.
                            , configurable: true  // We can Object.defineProperty again.
                            , value: undefined    // It shadows its parent.
                        });
                    }

                    nested.toObject = function () {
                        return this.get(path);
                    };

                    compile(subprops, nested, path);
                    this.$__.getters[path] = nested;
                }

                return this.$__.getters[path];
            }
            , set: function (v) {
                if (v instanceof Document) v = v.toObject();
                return (this.$__.scope || this).set(path, v);
            }
        });

    } else {
        Object.defineProperty(prototype, prop, {
            enumerable: true
            , configurable: true
            , get: function () {
                return this.get.call(this.$__.scope || this, path);
            }
            , set: function (v) {
                return this.set.call(this.$__.scope || this, path, v);
            }
        });
    }
}

Document.prototype.$__setSchema = function (schema) {
  compile(schema.tree, this);
  this.schema = schema;
};

Document.prototype.$__getArrayPathsToValidate = function () {
    DocumentArray || (DocumentArray = require('./types/documentArray'));

    // validate all document arrays.
    return this.$__.activePaths
        .map('init', 'modify', function (i) {
            return this.getValue(i);
        }.bind(this))
        .filter(function (val) {
            return val && val instanceof Array && val.isCounounDocumentArray && val.length;
        }).reduce(function (seed, array) {
            return seed.concat(array);
        }, [])
        .filter(function (doc) {
            return doc
        });
};

Document.prototype.$__getAllSubdocs = function () {
    DocumentArray || (DocumentArray = require('./types/documentArray'));
    Embedded = Embedded || require('./types/embedded');

    function docReducer(seed, path) {
        var val = this[path];
        if (val instanceof Embedded) seed.push(val);
        if (val && val.isCounounDocumentArray) {
            val.forEach(function _docReduce(doc) {
                if (!doc || !doc._doc) return;
                if (doc instanceof Embedded) seed.push(doc);
                seed = Object.keys(doc._doc).reduce(docReducer.bind(doc._doc), seed);
            });
        }
        return seed;
    }

    return Object.keys(this._doc).reduce(docReducer.bind(this), []);
};

Document.prototype.$__presaveValidate = function $__presaveValidate() {
  // if any doc.set() calls failed

  var docs = this.$__getArrayPathsToValidate();

  var e2 = docs.map(function (doc) {
    return doc.$__presaveValidate();
  });
  var e1 = [this.$__.saveError].concat(e2);
  var err = e1.filter(function (x) {return x})[0];
  this.$__.saveError = null;

  return err;
};

Document.prototype.$__error = function (err) {
  this.$__.saveError = err;
  return this;
};

Document.prototype.$__registerHooksFromSchema = function () {
    Embedded = Embedded || require('./types/embedded');

    var self = this;
    var q = self.schema && self.schema.callQueue;
    if (!q.length) return self;

    // we are only interested in 'pre' hooks, and group by point-cut
    var toWrap = q.reduce(function (seed, pair) {
        var args = [].slice.call(pair[1]);
        var pointCut = pair[0] === 'on' ? 'post' : args[0];
        if (!(pointCut in seed)) seed[pointCut] = [];
        seed[pointCut].push(args);
        return seed;
    }, {post: []});

    // 'post' hooks are simpler
    toWrap.post.forEach(function (args) {
        self.on.apply(self, args);
    });
    delete toWrap.post;

    Object.keys(toWrap).forEach(function (pointCut) {

        // skip weird handlers
        if (~"set ".indexOf(pointCut)) {
            toWrap[pointCut].forEach(function (args) {
                self.pre.apply(self, args);
            });
            return;
        }

        // this is so we can wrap everything into a promise;
        var newName = ('$__original_' + pointCut);
        self[newName] = self[pointCut];
        self[pointCut] = function wrappedPointCut() {
            var args = [].slice.call(arguments);
            var lastArg = args.pop();

            var wrappingPromise = new Promise;
            wrappingPromise.end();
            if (typeof lastArg == 'function') {
                wrappingPromise.onResolve(lastArg);
            }
            if (!(this instanceof Embedded) && !wrappingPromise.hasRejectListeners()) {
                wrappingPromise.onReject(self.$__handleReject.bind(self));
            }
            args.push(function () {
                return wrappingPromise.resolve.apply(wrappingPromise, arguments);
            });

            // fire original
            self[newName].apply(self, args);
            return wrappingPromise;
        };

        toWrap[pointCut].forEach(function (args) {
            args[0] = newName;
            self.pre.apply(self, args);
        });
    });

    return self;
};

Document.prototype.$__handleReject = function handleReject(err) {
    // emit on the Model if listening
    if (this.listeners('error').length) {
        this.emit('error', err);
    } else if (this.constructor.listeners && this.constructor.listeners('error').length) {
        this.constructor.emit('error', err);
    } else if (this.listeners && this.listeners('error').length) {
        this.emit('error', err);
    }
};

Document.prototype.toObject = function (options) {
    var defaultOptions = {transform: true};
    for (var key in options) {
        defaultOptions[key] = options[key];
    }
    options = defaultOptions;

    if (options && options.depopulate && !options._skipDepopulateTopLevel && this.$__.wasPopulated) {
        // populated paths that we set to a document
        return clone(this._id, options);
    }

    // If we're calling toObject on a populated doc, we may want to skip
    // depopulated on the top level
    if (options && options._skipDepopulateTopLevel) {
        options._skipDepopulateTopLevel = false;
    }

    // When internally saving this document we always pass options,
    // bypassing the custom schema options.
    var optionsParameter = options;
    if (!(options && 'Object' == utils.getFunctionName(options.constructor)) ||
        (options && options._useSchemaOptions)) {
        options = this.schema.options.toObject
            ? clone(this.schema.options.toObject)
            : {};
    }

    ;
    ('minimize' in options) || (options.minimize = this.schema.options.minimize);
    if (!optionsParameter) {
        options._useSchemaOptions = true;
    }

    // remember the root transform function
    // to save it from being overwritten by sub-transform functions
    var originalTransform = options.transform;

    var ret = clone(this._doc, options);

    if (options.virtuals || options.getters && false !== options.virtuals) {
        applyGetters(this, ret, 'virtuals', options);
    }

    if (options.getters) {
        applyGetters(this, ret, 'paths', options);
        // applyGetters for paths will add nested empty objects;
        // if minimize is set, we need to remove them.
        if (options.minimize) {
            ret = minimize(ret) || {};
        }
    }

    var transform = options.transform;

    // In the case where a subdocument has its own transform function, we need to
    // check and see if the parent has a transform (options.transform) and if the
    // child schema has a transform (this.schema.options.toObject) In this case,
    // we need to adjust options.transform to be the child schema's transform and
    // not the parent schema's
    if (true === transform ||
        (this.schema.options.toObject && transform)) {

        var opts = options.json ? this.schema.options.toJSON : this.schema.options.toObject;

        if (opts) {
            transform = (typeof options.transform === 'function' ? options.transform : opts.transform);
        }
    } else {
        options.transform = originalTransform;
    }

    if ('function' == typeof transform) {
        var xformed = transform(this, ret, options);
        if ('undefined' != typeof xformed) ret = xformed;
    }

    return ret;
};

function minimize (obj) {
    var keys = Object.keys(obj)
        , i = keys.length
        , hasKeys
        , key
        , val;

    while (i--) {
        key = keys[i];
        val = obj[key];

        if (utils.isObject(val)) {
            obj[key] = minimize(val);
        }

        if (undefined === obj[key]) {
            delete obj[key];
            continue;
        }

        hasKeys = true;
    }

    return hasKeys
        ? obj
        : undefined;
}

function applyGetters (self, json, type, options) {
    var schema = self.schema
        , paths = Object.keys(schema[type])
        , i = paths.length
        , path;

    while (i--) {
        path = paths[i];

        var parts = path.split('.')
            , plen = parts.length
            , last = plen - 1
            , branch = json
            , part

        for (var ii = 0; ii < plen; ++ii) {
            part = parts[ii];
            if (ii === last) {
                branch[part] = clone(self.get(path), options);
            } else {
                branch = branch[part] || (branch[part] = {});
            }
        }
    }

    return json;
}

Document.prototype.toJSON = function (options) {
    if (!(options && 'Object' == utils.getFunctionName(options.constructor))
        || ((!options || options.json) && this.schema.options.toJSON)) {
        options = this.schema.options.toJSON
            ? clone(this.schema.options.toJSON)
            : {};
    }
    options.json = true;

    return this.toObject(options);
};

Document.prototype.inspect = function (options) {
    var opts = options && 'Object' == utils.getFunctionName(options.constructor) ? options :
        this.schema.options.toObject ? clone(this.schema.options.toObject) :
        {};
    opts.minimize = false;
    return inspect(this.toObject(opts));
};

Document.prototype.toString = Document.prototype.inspect;

Document.prototype.equals = function (doc) {
    var tid = this.get('_id');
    var docid = doc.get('_id');
    if (!tid && !docid) {
        return deepEqual(this, doc);
    }
    return tid && tid.equals
        ? tid.equals(docid)
        : tid === docid;
};

Document.prototype.populate = function populate () {
    if (0 === arguments.length) return this;

    var pop = this.$__.populate || (this.$__.populate = {});
    var args = utils.args(arguments);
    var fn;

    if ('function' == typeof args[args.length - 1]) {
        fn = args.pop();
    }

    // allow `doc.populate(callback)`
    if (args.length) {
        // use hash to remove duplicate paths
        var res = utils.populate.apply(null, args);
        for (var i = 0; i < res.length; ++i) {
            pop[res[i].path] = res[i];
        }
    }

    if (fn) {
        var paths = utils.object.vals(pop);
        this.$__.populate = undefined;
        this.constructor.populate(this, paths, fn);
    }

    return this;
};

Document.prototype.execPopulate = function() {
    var promise = new Promise;
    var _this = this;

    this.populate(function (error) {
        if (error) {
            return promise.reject(error);
        }
        promise.fulfill(_this);
    });
    return promise;
};

Document.prototype.populated = function (path, val, options) {
    // val and options are internal

    if (null == val) {
        if (!this.$__.populated) return undefined;
        var v = this.$__.populated[path];
        if (v) return v.value;
        return undefined;
    }

    // internal

    if (true === val) {
        if (!this.$__.populated) return undefined;
        return this.$__.populated[path];
    }

    this.$__.populated || (this.$__.populated = {});
    this.$__.populated[path] = {value: val, options: options};
    return val;
};

Document.prototype.$__fullPath = function (path) {
    // overridden in SubDocuments
    return path || '';
};

Document.ValidationError = ValidationError;

module.exports = exports = Document;
