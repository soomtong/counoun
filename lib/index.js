function Counoun () {
    this.connection = {};
    this.models = {};
    this.modelSchemas = {};
    // default global options
    var conn = this.createConnection(); // default connection
    conn.models = this.models;
}

var counoun = module.exports = exports = new Counoun;
