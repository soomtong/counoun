var curi = require('./curi');

var rgxProtocol = /^(?:.)+:\/\//;

function validate (o) {
    if (-1 === o.db.w || 0 === o.db.w) {
        if (o.db.journal || o.db.fsync || o.db.safe) {
            throw new Error(
                'Invalid writeConcern: '
                + 'w set to -1 or 0 cannot be combined with safe|fsync|journal');
        }
    }
}


function Connection (base) {
    this.base = base;
    this.collections = {};
    this.models = {};
    this.config = {};
    this.host = null;
    this.port = null;
    this.user = null;
    this.pass = null;
    this.name = null;
    this.options = null;
}

Connection.prototype.error = function (err, callback) {
    if (callback) return callback(err);
    //this.emit('error', err);

    console.error(err);
};

Connection.prototype.open = function (host, database, port, options, callback) {

    var self = this;
    var parsed, uri;

    // bind parameter from arguments
    if ('string' === typeof database) {
        switch (arguments.length) {
            case 2:
                port = 5984;
                break;
            case 3:
                switch (typeof port) {
                    case 'function':
                        callback = port;
                        port = 5984;
                        break;
                    case 'object':
                        options = port;
                        port = 5984;
                        break;
                }
                break;
            case 4:
                if ('function' === typeof options) {
                    callback = options;
                    options = {};
                }
        }
    } else {
        switch (typeof database) {
            case 'function':
                callback = database;
                database = undefined;
                break;
            case 'object':
                options = database;
                database = undefined;
                callback = port;
                break;
        }

        if (!rgxProtocol.test(host)) {
            host = 'http://' + host;
        }

        try {
            parsed = curi(host);
        } catch (err) {
            this.error(err, callback);
            return this;
        }

        database = parsed.db;

        host = parsed.hosts[0].host || parsed.hosts[0].ipc;
        port = parsed.hosts[0].port || 5984;

    }


    // make sure we can open
    if (!host) {
        this.error(new Error('Missing hostname.'), callback);
        return this;
    }

    if (!database) {
        this.error(new Error('Missing database name.'), callback);
        return this;
    }

    // authentication
    if (options && options.user && options.pass) {
        this.user = options.user;
        this.pass = options.pass;

    } else if (parsed && parsed.auth) {
        this.user = parsed.auth.user;
        this.pass = parsed.auth.pass;

        // Check hostname for user/pass
    } else if (/@/.test(host) && /:/.test(host.split('@')[0])) {
        host = host.split('@');
        var auth = host.shift().split(':');
        host = host.pop();
        this.user = auth[0];
        this.pass = auth[1];

    } else {
        this.user = this.pass = undefined;
    }


    this.name = database;
    this.host = host;
    this.port = port;

    callback && callback();

    return this;
};

Connection.prototype.close = function (callback) {
    var self = this;
    this._closeCalled = true;

    switch (this.readyState){
        case 0: // disconnected
            callback && callback();
            break;

        case 1: // connected
            this.readyState = STATES.disconnecting;
            this.doClose(function(err){
                if (err){
                    self.error(err, callback);
                } else {
                    self.onClose();
                    callback && callback();
                }
            });
            break;

        case 2: // connecting
            this.once('open', function(){
                self.close(callback);
            });
            break;

        case 3: // disconnecting
            if (!callback) break;
            this.once('close', function () {
                callback();
            });
            break;
    }

    return this;
};

module.exports = Connection;
