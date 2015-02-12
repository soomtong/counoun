var Connection = require('./connection');

var Schema = require('./schema');
var SchemaType = require('./schemaType');

var Model = require('./model');

var utils = require('./utils');
var format = utils.toCollectionName;

function Counoun () {
    this.connections = [];
    this.models = {};
    this.modelSchemas = {};
    // default global options
    this.options = {};
    var conn = this.createConnection(); // default connection
    conn.models = this.models;
}

Counoun.prototype.__defineGetter__('connection', function(){
    return this.connections[0];
});

Counoun.prototype.createConnection = function () {
    var conn = new Connection(this);
    this.connections.push(conn);

    conn.open.apply(conn, arguments);


    return conn;
};

Counoun.prototype.connect = function() {
    var conn = this.connection;

    conn.open.apply(conn, arguments);

    return this;
};

Counoun.prototype.set = function (key, value) {
    if (arguments.length == 1) {
        return this.options[key];
    }

    this.options[key] = value;
    return this;
};

Counoun.prototype.get = Counoun.prototype.set;

Counoun.prototype.disconnect = function (fn) {
    var count = this.connections.length;
    var error;

    this.connections.forEach(function(conn){
        conn.close(function(err){
            if (error) return;

            if (err) {
                error = err;
                if (fn) return fn(err);
                throw err;
            }

            if (fn)
                --count || fn();
        });
    });

    return this;
};

Counoun.prototype.model = function (name, schema) {
    var collection;

    if ('string' == typeof schema) {
        collection = schema;
        schema = false;
    }

    if (utils.isObject(schema) && !(schema instanceof Schema)) {
        schema = new Schema(schema);
    }

    // handle internal options from connection.model()
    var options;

    // look up schema for the collection. this might be a
    // default schema like system.indexes stored in SchemaDefaults.
    if (!this.modelSchemas[name]) {
        if (schema) {
            // cache it so we only apply plugins once
            this.modelSchemas[name] = schema;
            //this._applyPlugins(schema);
        } else {
            throw new counoun.Error.MissingSchemaError(name);
        }
    }

    var model;
    var sub;

    // connection.model() may be passing a different schema for
    // an existing model name. in this case don't read from cache.
    if (this.models[name] && false !== options.cache) {
        if (schema instanceof Schema && schema != this.models[name].schema) {
            throw new counoun.Error.OverwriteModelError(name);
        }

        if (collection) {
            // subclass current model with alternate collection
            model = this.models[name];
            schema = model.prototype.schema;
            sub = model.__subclass(this.connection, schema, collection);
            // do not cache the sub model
            return sub;
        }

        return this.models[name];
    }

    // ensure a schema exists
    if (!schema) {
        schema = this.modelSchemas[name];
        if (!schema) {
            throw new counoun.Error.MissingSchemaError(name);
        }
    }

    if (!collection) {
        collection = schema.get('collection') || format(name, schema.options);
    }

    var connection = this.connection;

    model = Model.compile(name, schema, collection, connection, this);

    model.init();

    if (false === options.cache) {
        return model;
    }

    return this.models[name] = model;
};

Counoun.prototype.modelNames = function () {
    var names = Object.keys(this.models);
    return names;
};

Counoun.prototype.Schema = Schema;
Counoun.prototype.SchemaType = SchemaType;
Counoun.prototype.SchemaTypes = Schema.Types;

var counoun = module.exports = exports = new Counoun;
