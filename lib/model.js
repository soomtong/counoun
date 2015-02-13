function Model(name) {
    if ('string' == typeof name) {
        this.database = name;
    }

    this.connection = null;
}

Model.prototype.init = function () {
    var db = this.connection.nano.db;

    db.create(this.database);
};

Model.prototype.save = function (doc, callback) {
    var db = this.connection.nano.use(this.database);

    db.insert(doc, callback);

/*
    if (callback && 'function' == typeof callback) {
        db.insert(doc, callback);
    } else {
        db.insert(doc, function (err, result) {
            // todo: apply promise, can i...
            //return result.id;
            //callback(err, result);
            console.error("No!!!");
        });
    }
*/
};

Model.prototype.get = function (id, callback) {
    var db = this.connection.nano.use(this.database);

    //db.get(id, { revs_info: true }, callback);
    db.get(id, callback);
};

Model.prototype.put = function (id, doc, callback) {
    var db = this.connection.nano.use(this.database);

    db.insert(doc, id, callback);
};

Model.prototype.view = function (design, view, callback) {
    var db = this.connection.nano.use(this.database);

    db.view(design, view, callback);
};

module.exports = Model;
