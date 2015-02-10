var ObjectID = function ObjectID(id) {
    if (!(this instanceof ObjectID)) return new ObjectID(id);
    if ((id instanceof ObjectID)) return id;

    this._bsontype = 'ObjectID';
    var __id = null;
    var valid = ObjectID.isValid(id);

    // Throw an error if it's not a valid setup
    if (!valid && id != null) {
        throw new Error("Argument passed in must be a single String of 12 bytes or a string of 24 hex characters");
    } else if (valid && typeof id == 'string' && id.length == 24) {
        return ObjectID.createFromHexString(id);
    } else if (id == null || typeof id == 'number') {
        // convert to 12 byte binary string
        this.id = this.generate(id);
    } else if (id != null && id.length === 12) {
        // assume 12 byte string
        this.id = id;
    }

    if (ObjectID.cacheHexString) this.__id = this.toHexString();
};

module.exports = ObjectID;
