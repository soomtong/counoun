var Schema = require('./schema');

function Document() {
    this.connection = null;
}

function Model(name) {
    if ('string' == typeof name) {
        this.schemaName = name;
    }

    Document.call(this);

    //this.connection.db.create(this.connection)
}

Model.prototype.__proto__ = Document.prototype;

Model.prototype.save = function (doc, callback) {
    console.log("--- save method ---");
    console.log(this.connection);
    //console.log(this.connection.db.info());

    //this.connection.db.insert(doc, callback);

};

module.exports = Model;
