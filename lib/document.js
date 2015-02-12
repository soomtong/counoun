var utils = require('./utils')
    , CounounError = require('./error')
    , Schema = require('./schema')
    , DocumentArray
    , CounounArray
    , Embedded;


function Document (obj, fields, skipId) {
    this.isNew = true;
    this.errors = undefined;

    var schema = this.schema;

    this._doc = this.buildDoc(obj, fields, skipId);

    if (obj) {
        this.set(obj, undefined, true);
    }

    if (!schema.options.strict && obj) {
        var self = this
            , keys = Object.keys(this._doc);

        keys.forEach(function (key) {
            if (!(key in schema.tree)) {
                define(key, null, self);
            }
        });
    }
}

Document.prototype.constructor = Document;

Document.prototype.schema;

Document.prototype.isNew;

Document.prototype.id;

Document.prototype.errors;

Document.prototype.buildDoc = function (obj, fields, skipId) {
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
    this.storeShard();

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

Document.prototype.storeShard = function () {
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

Document.prototype.setSchema = function (schema) {
  compile(schema.tree, this);
  this.schema = schema;
};

Document.prototype.getArrayPathsToValidate = function () {
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

Document.prototype.getAllSubdocs = function () {
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

Document.prototype.presaveValidate = function $__presaveValidate() {
  // if any doc.set() calls failed

  var docs = this.getArrayPathsToValidate();

  var e2 = docs.map(function (doc) {
    return doc.presaveValidate();
  });
  var e1 = [this.$__.saveError].concat(e2);
  var err = e1.filter(function (x) {return x})[0];
  this.$__.saveError = null;

  return err;
};

Document.prototype.error = function (err) {
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

module.exports = exports = Document;
