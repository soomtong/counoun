var Connection = require('./connection');
var Schema = require('./schema');

function Counoun () {
    this.connection = {};
    this.models = {};
    // default global options
    var conn = this.createConnection();

    conn.models = this.models;
}

Counoun.prototype.createConnection = function () {
    var conn = new Connection(this);
    this.connection = (conn);

    conn.open.apply(conn, arguments);

    return conn;
};

Counoun.prototype.connect = function () {
    var conn = this.connection;

    conn.open.apply(conn, arguments);

    return this;
};

Counoun.prototype.Schema = Schema;

var counoun = module.exports = exports = new Counoun;
