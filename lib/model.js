
function Document() {
    this.connection = null;
}

function Model(name) {
    if ('string' == typeof name) {
        this.database = name;
    }

    Document.call(this);

    //this.connection.db.create(this.connection)
}

Model.prototype.save = function (doc, callback) {
    var db = this.connection.db.use(this.database);

    if (callback && 'function' == typeof callback) {
        db.insert(doc, callback);
    } else {
        db.insert(doc, function (err, result) {
            // todo: apply promise, can i...
            return result.id;
        });
    }
};

Model.prototype.get = function (id, callback) {
    var db = this.connection.db.use(this.database);

    db.get(id, callback);
};

module.exports = Model;
