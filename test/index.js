var assert = require("assert");
var counoun = require('../');

var couchSet = {
    host: 'localhost',
    port: '5984',
    option: {
        ssl: false,
        user: 'a',
        pass: '1'
    }
};

var couchSet2 = {
    host: 'db1.haroopress.com',
    port: '80',
    option: {
        ssl: false,
        user: 'b',
        pass: '2'
    }
};

describe("Connection", function () {

    it("connection default", function () {
        counoun.connect('localhost');

        assert.equal(counoun.connection.host, 'localhost');
        assert.equal(counoun.connection.port, '5984');

    });

    it("connection with set", function () {
        counoun.connect(couchSet.host, couchSet.port);

        assert.equal(counoun.connection.host, 'localhost');
        assert.equal(counoun.connection.port, '5984');
    });

    it("connection with set for auth", function () {
        counoun.connect(couchSet.host, couchSet.port, couchSet.option);

        assert.equal(counoun.connection.host, couchSet.host);
        assert.equal(counoun.connection.port, couchSet.port);

        var connection = counoun.connection.nano.config;

        assert.equal(connection.url, (couchSet.ssl ? 'https://' : 'http://')
            + (couchSet.option.user + ':' + couchSet.option.pass) + '@'
            + couchSet.host + ':' + couchSet.port);
    });

    it("connection with later configuration", function () {
        counoun.connect(couchSet2);

        var database = 'test1';

        var connection = counoun.connection.nano.use(database).info();

        assert.equal(connection.uri.host, couchSet2.host + ':' + couchSet2.port);
        assert.equal(connection.uri.hostname, couchSet2.host);
        assert.equal(connection.uri.port, couchSet2.port);
        assert.equal(connection.uri.pathname, '/' + database);
    });
});

describe("Direct Model", function () {

    var tempID = null;
    var tempDoc = {name: "Corgi"};

    before(function () {
        counoun.connect(couchSet.host, couchSet.port, couchSet.option);

        counoun.drop('test1', function () {
            console.log('destroy test1 database');
        });
        counoun.drop('test2', function () {
            console.log('destroy test2 database');
        });

    });

    it("simple usage - save with promise", function () {
        counoun.connect(couchSet.host, couchSet.port, couchSet.option);

        var database = 'test1';

        var Dog = counoun.model(database);

        // todo: promise
        var result = Dog.save({name: "Corgi"});

        //assert.ok(result && result.ok);
        assert.ok(true);
    });

    it("simple usage - save with callback", function (done) {
        counoun.connect(couchSet.host, couchSet.port, couchSet.option);

        var database = 'test2';

        var Dog = counoun.model(database);

        Dog.save(tempDoc, function (err, result) {
            assert.ok(result.ok);

            tempID = result.id;

            done();
        });
    });

    it("simple usage - get with id", function (done) {
        counoun.connect(couchSet.host, couchSet.port, couchSet.nano, couchSet.option);

        var database = 'test2';

        var Dog = counoun.model(database);

        Dog.get(tempID, function (err, result) {
            assert.equal(result.name, tempDoc.name);

            done();
        });
    });

    it("simple usage - view with specified design", function (done) {
        counoun.connect(couchSet.host, couchSet.port, couchSet.nano, couchSet.option);

        var database = 'test1';

        var Dog = counoun.model(database);

        var designName = 'design';
        var viewName = 'view';

        Dog.view(designName, viewName, function (err, result) {
            assert.ok(err);
            assert.equal(err.reason, 'missing');
            assert.equal(err.statusCode, 404);

            done();
        });
    });

});
