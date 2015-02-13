function Schema (obj, options) {
    if (!(this instanceof Schema)) return new Schema(obj, options);

    this.paths = {};

    if (obj) {
        this.add(obj);
    }

}

module.exports = exports = Schema;
