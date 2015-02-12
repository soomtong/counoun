var Document = require('./document')
  , Schema = require('./schema')
  , Types = require('./schema/index')
  , utils = require('./utils')

function Model (doc, fields, skipId) {
    Document.call(this, doc, fields, skipId);
}

Model.compile = function compile (name, schema, collectionName, connection, base) {

    // generate new class
    function model(doc, fields, skipId) {
        if (!(this instanceof model))
            return new model(doc, fields, skipId);
        Model.call(this, doc, fields, skipId);
    }

    model.base = base;
    model.modelName = name;
    model.__proto__ = Model;
    model.prototype.__proto__ = Model.prototype;
    model.model = Model.prototype.model;
    model.db = model.prototype.db = connection;
    model.discriminators = model.prototype.discriminators = undefined;

    // apply methods
    for (var i in schema.methods) {
        if (typeof schema.methods[i] === 'function') {
            model.prototype[i] = schema.methods[i];
        } else {
            (function (_i) {
                Object.defineProperty(model.prototype, _i, {
                    get: function () {
                        var h = {};
                        for (var k in schema.methods[_i]) {
                            h[k] = schema.methods[_i][k].bind(this);
                        }
                        return h;
                    }
                });
            })(i);
        }
    }

    // apply statics
    for (var i in schema.statics) {
        // use defineProperty so that static props can't be overwritten
        Object.defineProperty(model, i, {
            value: schema.statics[i],
            writable: false
        });
    }

    model.schema = model.prototype.schema;
    model.collection = model.prototype.collection;

    return model;
};

Model.prototype.model = function model (name) {
  return this.db.model(name);
};



// Model (class) features






module.exports = exports = Model;
