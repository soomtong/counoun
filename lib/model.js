
function Document() {
    this.connection = null;
}

function Model(name) {
    if ('string' == typeof name) {
        this.database = name;
    }

    Document.call(this);
}

Model.prototype.init = function () {
    var db = this.connection.nano.db;

    db.create(this.database);
};

Model.prototype.save = function (doc, callback) {
    var db = this.connection.nano.use(this.database);

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
    var db = this.connection.nano.use(this.database);

    db.get(id, callback);
};

Model.prototype.view = function (design, view, callback) {
    var db = this.connection.nano.use(this.database);

    db.view(design, view, callback);
};

module.exports = Model;
