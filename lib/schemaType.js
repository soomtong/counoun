function SchemaType (path, options, instance) {
    this.path = path;
    this.instance = instance;
    this.validators = [];
    this.setters = [];
    this.getters = [];
    this.options = options;
    this._index = null;
    this.selected;

    for (var i in options) if (this[i] && 'function' == typeof this[i]) {
        // { unique: true, index: true }
        if ('index' == i && this._index) continue;

        var opts = Array.isArray(options[i])
            ? options[i]
            : [options[i]];

        this[i].apply(this, opts);
    }
}


function SchemaString(key, options) {
    SchemaType.call(this, key, options, 'String');
}

SchemaString.schemaName = 'String';

function SchemaNumber(key, options) {
    SchemaType.call(this, key, options, 'Number');
}

SchemaNumber.schemaName = 'Number';

function SchemaBoolean (path, options) {
    SchemaType.call(this, path, options);
}

SchemaBoolean.schemaName = 'Boolean';

function SchemaArray (key, cast, options) {
    SchemaType.call(this, key, options);
}

SchemaArray.schemaName = 'Array';

function SchemaDate (key, options) {
    SchemaType.call(this, key, options);
}

SchemaDate.schemaName = 'Date';

function Mixed (path, options) {
    if (options && options.default) {
        var def = options.default;
        if (Array.isArray(def) && 0 === def.length) {
            // make sure empty array defaults are handled
            options.default = Array;
        } else if (!options.shared &&
            utils.isObject(def) &&
            0 === Object.keys(def).length) {
            // prevent odd "shared" objects between documents
            options.default = function () {
                return {}
            }
        }
    }

    SchemaType.call(this, path, options);
}

Mixed.schemaName = 'Mixed';


exports.String = SchemaString;
exports.Number = SchemaNumber;
exports.Boolean = SchemaBoolean;
exports.Array = SchemaArray;
exports.Date = SchemaDate;

