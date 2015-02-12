var Connection = require('./connection');

var Schema = require('./schema');
var SchemaType = require('./schemaType');

var Model = require('./model');

var utils = require('./utils');
var format = utils.toCollectionName;

function Counoun () {
    this.connection = {};
    this.models = {};
    this.modelSchemas = {};
    // default global options
    this.options = {};
    var conn = this.createConnection(); // default connection
    conn.models = this.models;
}

Counoun.prototype.createConnection = function () {
    var conn = new Connection(this);
    this.connection = conn;

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

Counoun.prototype.disconnect = function () {
    this.connection.close();

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

    var options;
    var model;
    var sub;

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

    return this.models[name] = model;
};

Counoun.prototype.modelNames = function () {
    var names = Object.keys(this.models);
    return names;
};

//Counoun.prototype.Collection = NanoCollection;
//Counoun.prototype.Connection = NanoConnection;


Counoun.prototype.Schema = Schema;
Counoun.prototype.SchemaType = SchemaType;
Counoun.prototype.SchemaTypes = Schema.Types;

var counoun = module.exports = exports = new Counoun;
