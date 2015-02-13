var Connection = require('./connection');
var Model = require('./model');
var Schema = require('./schema');

function Counoun () {
    this.connection = this.createConnection();
    this.models = {};
    // default global options

}

Counoun.prototype.createConnection = function () {
    var conn = new Connection(this);

    conn.open.apply(conn, arguments);

    return conn;
};

Counoun.prototype.connect = function () {
    var conn = this.connection;

    conn.open.apply(conn, arguments);

    return this;
};

Counoun.prototype.model = function (database, schema, options) {
    var name = 0;

    if ('string' == typeof database) {
        name = database.toLowerCase();
    }

    if(!this.models[name]) {
        this.models[name] = new this.Model(name);
    }

    this.models[name].connection = this.connection;
    this.models[name].init();

    if ('object' == typeof schema) {
        this.models[name].schema = schema;
    }

    return this.models[name];
};

Counoun.prototype.drop = function (database, callback) {
    var name = database.toLowerCase();

    this.connection.nano.db.destroy(name, callback);
};

Counoun.prototype.Schema = Schema;
Counoun.prototype.Model = Model;

module.exports = exports = new Counoun;
