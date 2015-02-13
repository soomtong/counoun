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

        var connection = counoun.connection.db.config;

        assert.equal(connection.url, (couchSet.ssl ? 'https://' : 'http://')
            + (couchSet.option.user + ':' + couchSet.option.pass) + '@'
            + couchSet.host + ':' + couchSet.port);
    });

    it("connection with later configuration", function () {
        counoun.connect(couchSet2);

        var database = 'test1';

        var connection = counoun.connection.db.use(database).info();

        assert.equal(connection.uri.host, couchSet2.host + ':' + couchSet2.port);
        assert.equal(connection.uri.hostname, couchSet2.host);
        assert.equal(connection.uri.port, couchSet2.port);
        assert.equal(connection.uri.pathname, '/' + database);
    })
});

describe("Direct Model", function () {

    it("simple usage - save", function (done) {
        counoun.connect(couchSet.host, couchSet.port, couchSet.option);

        var database = 'test1';

        var Dog = counoun.model(database);

        Dog.save({name: "Corgi"}, function (err, result) {
            console.log(result);

            done();
        });

    });

    it("simple usage - find", function (done) {
        counoun.connect(couchSet.host, couchSet.port, couchSet.db, couchSet.option);

        var Dog = counoun.model('dog');

        Dog.find({name: "Corgi"}, function (err, result) {
            console.log(result);

            done();
        });
    });

});

describe("Schema", function () {

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

        //console.log(Kitten);

        var silence = new Kitten({name: 'Silence'});

        assert.equal(silence.name, 'Silence');

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

            Cat.find({ _id: kitty._id }, function (err, doc) {
                console.log(doc);

                done();
            });
        });
    });

});