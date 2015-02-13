var nano = require('nano');

//todo node 0.12 above or iojs 1.x
var keepAlive = require('agentkeepalive');
var counounAgent = new keepAlive({
    maxSockets: 50
    , maxKeepAliveRequests: 0
    , maxKeepAliveTime: 30000
});

function Connection() {
    this.ssl = false;
    this.host = 'localhost';
    this.port = '5984';
    this.user = null;
    this.pass = null;
    this.nano = null;

    return this;
}

Connection.prototype.open = function (host, port, options) {

    if (!host) new Error('Should Need Arguments');

    if ('string' == typeof host) {
        this.host = host;
    }

    if ('object' == typeof host) {
        var param = host;

        this.host = param.host;

        port = param.port;
        options = param.option;
    }

    if (port) this.port = port;

    if (options && options.user && options.pass) {
        this.user = options.user;
        this.pass = options.pass;
    }

    var protocol = options && options.ssl ? 'https://' : 'http://';
    var auth = this.user && this.pass ? this.user + ':' + this.pass + '@' : false;
    var uri = protocol + (auth ? auth : '') + this.host + ':' + this.port;

    if (options && options.keepAlive) {
        this.nano = nano({
            "url": uri,
            "requestDefaults": {
                "agent": counounAgent
            }
        });
    } else {
        this.nano = nano(uri);
    }

    return this;
};

module.exports = Connection;
