var nano = require('nano');

function Connection() {
    this.models = {};
    this.ssl = false;
    this.host = 'localhost';
    this.port = '5984';
    this.user = null;
    this.pass = null;
    this.name = null;

    return this;
}

Connection.prototype.open = function (host, port, database, options, callback) {

    if (!host) new Error('Should Need Hostname');

    this.host = host;

    if (port) this.port = port;

    if ('string' == typeof database) {
        this.name = database;
    } else {
        options = database;
    }

    if (options && options.user && options.pass) {
        this.user = options.user;
        this.pass = options.pass;
    }

    this.db = nano('http://localhost:5984/test');

    return this;
};

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

var counoun = module.exports = exports = new Counoun;
