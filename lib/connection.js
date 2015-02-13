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
        this.name = '';
        options = database;
    }

    if (options && options.user && options.pass) {
        this.user = options.user;
        this.pass = options.pass;
    }

    var protocol = options && options.ssl ? 'https://' : 'http://';
    var auth = this.user && this.pass ? this.user + ':' + this.pass + '@' : false;
    var uri = protocol + (auth ? auth : '') + this.host + ':' + this.port + '/' + this.name;

    this.db = nano(uri);

    return this;
};

module.exports = Connection;