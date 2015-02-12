var assert = require("assert");
var counoun = require('../');

var couchSet = {
    ssl: false,
    host: 'localhost',
    port: '5984',
    db: 'test1',
    option: {
        user: 'a',
        pass: '1'
    }
};

var couchHost = 'http://localhost:5984/test2';
var couchHostAuth = 'http://a:1@localhost:5984/test3';

describe("Connection", function () {

    it("connection default", function () {
        counoun.connect('localhost');

        assert.equal(counoun.connection.host, 'localhost');
        assert.equal(counoun.connection.port, '5984');
        assert.equal(counoun.connection.name, 'test');
    });

    it("connection with set", function () {
        counoun.connect(couchSet.host, couchSet.db, couchSet.port);

        assert.equal(counoun.connection.host, 'localhost');
        assert.equal(counoun.connection.port, '5984');
        assert.equal(counoun.connection.name, 'test1');
    });

    it("connection with set for auth", function () {
        counoun.connect(couchSet.host, couchSet.db, couchSet.port, couchSet.option);

        assert.equal(counoun.connection.host, 'localhost');
        assert.equal(counoun.connection.port, '5984');
        assert.equal(counoun.connection.name, 'test1');
    });

    it("connection with normal host", function () {
        counoun.connect(couchHost);

        assert.equal(counoun.connection.host, 'localhost');
        assert.equal(counoun.connection.port, '5984');
        assert.equal(counoun.connection.name, 'test2');
    });

    it("connection with auth", function () {
        counoun.connect(couchHostAuth);

        assert.equal(counoun.connection.host, 'localhost');
        assert.equal(counoun.connection.port, '5984');
        assert.equal(counoun.connection.name, 'test3');
    });

    it("connection with auth and callback", function () {
        counoun.connect(couchHostAuth, function () {
            //console.warn('=== callback ===', counoun.connection.host);
        });

        assert.equal(counoun.connection.host, 'localhost');
        assert.equal(counoun.connection.port, '5984');
        assert.equal(counoun.connection.name, 'test3');
    });

});

describe("Basic Usage", function () {

    it("basic schema", function () {
        counoun.connect(couchSet.host, couchSet.db, couchSet.port);

        var kittySchema = counoun.Schema({
            name: String
        });

        assert.equal(kittySchema.paths.name.path, 'name');
        assert.equal(kittySchema.paths.name.instance, 'String');

    });

    it("basic schema 2", function () {
        counoun.connect(couchSet.host, couchSet.db, couchSet.port);

        var kittySchema = counoun.Schema({
            name: String,
            age: Number
        });

        assert.equal(kittySchema.paths.name.path, 'name');
        assert.equal(kittySchema.paths.name.instance, 'String');
        assert.equal(kittySchema.paths.age.path, 'age');
        assert.equal(kittySchema.paths.age.instance, 'Number');

    });

    it("basic schema - get schema", function () {
        counoun.connect(couchSet.host, couchSet.db, couchSet.port);

        var kittySchema = counoun.Schema({
            name: String
        });

        assert.equal(kittySchema.paths.name.path, 'name');
        assert.equal(kittySchema.paths.name.instance, 'String');

    });

    it("basic schema - load to model ", function () {
        counoun.connect(couchSet.host, couchSet.db, couchSet.port);

        var kittySchema = counoun.Schema({
            name: String
        });

        var Kitten = counoun.model('Kitten', kittySchema);

        console.log(Kitten);

        //var silence = new Kitten({name: 'Silence'});
        //
        //assert.equal(silence.name, 'Silence');

    });

    it("basic schema - save", function (done) {
        done();
        counoun.connect(couchSet.host, couchSet.db, couchSet.port);

        var Cat = counoun.model('Cat', {name: String});
        var kitty = new Cat({name: 'meow'});

        kitty.save(function (err) {
            if (err) {
                console.log('meow error');
            } else {
                console.log('meow success');
            }

            done();
        });
    });

    it("basic schema - save and load", function (done) {
        done();
        counoun.connect(couchSet.host, couchSet.db, couchSet.port);

        var Cat = counoun.model('Cat', {name: String});
        var kitty = new Cat({name: 'meow'});

        kitty.save(function (err) {
            if (err) {
                console.log('meow error');
            } else {
                console.log('meow success');
            }

            kitty.get(function (err, doc) {
                console.log(doc);

                done();
            });
        });
    });

});