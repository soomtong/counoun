var qs = require('querystring');

var DEFAULT_PORT = 5984;
var DEFAULT_DB = 'test';
var ADMIN_DB = 'admin';

module.exports = exports = function curi (str) {

    if (!/^http:\/\//.test(str)) {
        throw new Error('Invalid couchdb uri. Must begin with "http://"' + ' Received: ' + str);
    }

    var ret = {
        hosts: []
        , db: DEFAULT_DB
        , options: {}
    };

    var match = /^http:\/\/([^?]+)(\??.*)$/.exec(str);
    if (!match || '/' == match[1]) {
        throw new Error('Invalid couchdb uri. Missing hostname');
    }

    var uris = match[1];
    var path = match[2];
    var db;

    uris.split(',').forEach(function (uri) {
        var o = parse(uri);

        if (o.host) {
            ret.hosts.push({
                host: o.host
                , port: parseInt(o.port, 10)
            })

            if (!db && o.db) {
                db = o.db;
            }
        } else if (o.ipc) {
            ret.hosts.push({ ipc: o.ipc });
        }

        if (o.auth) {
            ret.auth = {
                user: o.auth.user
                , pass: o.auth.pass
            }
        }
    });

    if (!ret.hosts.length) {
        throw new Error('Invalid couchdb uri. Missing hostname');
    }

    var parts = path.split('?');

    if (!db) {
        if (parts[0]) {
            db = parts[0].replace(/^\//, '');
        } else {
            // deal with ipc formats
            db = /\/([^\.]+)$/.exec(match[1]);
            if (db && db[1]) {
                db = db[1];
            }
        }
    }

    if (db) {
        ret.db = db;
    } else if (ret.auth) {
        ret.db = ADMIN_DB;
    }

    if (parts[1]) {
        ret.options = options(parts[1]);
    }

    return ret;
};

/**
 * Parse str into key/val pairs casting values appropriately.
 */

function options (str) {
    var sep = /;/.test(str)
        ? ';'
        : '&';

    var ret = qs.parse(str, sep);

    Object.keys(ret).forEach(function (key) {
        var val = ret[key];
        if ('readPreferenceTags' == key) {
            val = readPref(val);
            if (val) {
                ret[key] = Array.isArray(val)
                    ? val
                    : [val];
            }
        } else {
            ret[key] = format(val);
        }
    });

    return ret;
}

function format (val) {
    var num;

    if ('true' == val) {
        return true;
    } else if ('false' == val) {
        return false;
    } else {
        num = parseInt(val, 10);
        if (!isNaN(num)) {
            return num;
        }
    }

    return val;
}

function readPref (val) {
    var ret;

    if (Array.isArray(val)) {
        ret = val.map(readPref).filter(Boolean);
        return ret.length
            ? ret
            : undefined
    }

    var pair = val.split(',');
    var hasKeys;
    ret = {};

    pair.forEach(function (kv) {
        kv = (kv || '').trim();
        if (!kv) return;
        hasKeys = true;
        var split = kv.split(':');
        ret[split[0]] = format(split[1]);
    });

    return hasKeys && ret;
}

var ipcRgx = /\.sock/;

function parse (uriString) {
    // do not use require('url').parse b/c it can't handle # in username or pwd
    // couch uris are strange

    var uri = uriString;
    var ret = {};
    var parts;
    var auth;
    var ipcs;

    // skip protocol
    uri = uri.replace(/^http:\/\//, '');

    // auth
    if (/@/.test(uri)) {
        parts = uri.split(/@/);
        auth = parts[0];
        uri = parts[1];

        parts = auth.split(':');
        ret.auth = {};
        ret.auth.user = parts[0];
        ret.auth.pass = parts[1];
    }

    // unix domain sockets
    if (ipcRgx.test(uri)) {
        ipcs = uri.split(ipcRgx);
        ret.ipc = ipcs[0] + '.sock';

        // included a database?
        if (ipcs[1]) {
            // strip leading / from database name
            ipcs[1] = ipcs[1].replace(/^\//, '');

            if (ipcs[1]) {
                ret.db = ipcs[1];
            }
        }

        return ret;
    }

    // database name
    parts = uri.split('/');
    if (parts[1]) ret.db = parts[1];

    // host:port
    parts = parts[0].split(':');
    ret.host = parts[0];
    ret.port = parts[1] || DEFAULT_PORT;

    return ret;
}
