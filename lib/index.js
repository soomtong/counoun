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

Counoun.prototype.model = function (schema, options) {
    var name = 0;

    if ('string' == typeof schema) {
        name = schema;
    }

    if(!this.models[name]) {
        this.models[name] = new this.Model(name);
    }

    this.models[name].connection = this.connection;

    return this.models[name];
};

Counoun.prototype.Schema = Schema;
Counoun.prototype.Model = Model;

module.exports = exports = new Counoun;
