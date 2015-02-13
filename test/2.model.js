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

describe("Direct Model", function () {

    var tempID = null;
    var tempDoc = {name: "Corgi"};

    before(function (done) {
        counoun.connect(couchSet.host, couchSet.port, couchSet.option);

        /*
         counoun.drop('test1', function () {
         console.log('destroy test1 database');
         });
         */
        counoun.drop('test2', function () {
            console.log('destroy test2 database');

            setTimeout(done, 500);
        });
    });

/*
    it("simple usage - save with promise", function () {
        counoun.connect(couchSet.host, couchSet.port, couchSet.option);

        var database = 'test1';

        var Dog = counoun.model(database);

        // todo: promise
        var result = Dog.save({name: "Corgi"});

        //assert.ok(result && result.ok);
        assert.ok(true);
    });
*/

    it("simple usage - save with callback", function (done) {
        counoun.connect(couchSet.host, couchSet.port, couchSet.option);

        var database = 'test2';

        var Dog = counoun.model(database);

        Dog.save(tempDoc, function (err, result) {
            assert.ok(!err);
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
            assert.ok(!err);
            assert.equal(result.name, tempDoc.name);

            tempDoc = result;

            done();
        });
    });

    it("simple usage - put with id", function (done) {
        counoun.connect(couchSet.host, couchSet.port, couchSet.nano, couchSet.option);

        var database = 'test2';

        var Dog = counoun.model(database);

        tempDoc.name = "Mortise";

        Dog.put(tempID, tempDoc, function (err, result) {
            assert.ok(result.ok);

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