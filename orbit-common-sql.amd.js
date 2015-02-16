define("orbit-common/sql-source", 
  ["orbit/main","orbit/lib/assert","./memory-source","orbit/lib/objects","exports"],
  function(__dependency1__, __dependency2__, __dependency3__, __dependency4__, __exports__) {
    "use strict";
    var Orbit = __dependency1__["default"];
    var assert = __dependency2__.assert;
    var MemorySource = __dependency3__["default"];
    var isArray = __dependency4__.isArray;
    var isObject = __dependency4__.isObject;


    var supportsSQL = function(webSQLMode) {
      try {
        return (webSQLMode?'openDatabase':'sqlitePlugin') in window && window[(webSQLMode?'openDatabase':'sqlitePlugin')] !== null;
      } catch(e) {
        return false;
      }
    };
    /**
     Source for storing data in local storage

     @class sqlSource
     @extends MemorySource
     @namespace OC
     @param {OC.Schema} schema
     @param {Object}    [options]
     @constructor
     */
    var sqlSource = MemorySource.extend({
      init: function(schema, options) {
        assert('sqlSource requires Orbit.Promise be defined', Orbit.Promise);
        this._super.apply(this, arguments);

        options = options || {};
        this.namespace = options['namespace'] || 'orbit'; 
        this.version = options['version'] || 1; 
        this.webSQLMode = options['webSQLMode'] || false; 
        this.cordovaMode = options['cordovaMode'] || false; 
        this.new_version = false;
        var callback = options['callback'];
        this._db = null;
        //need to wait for device ready in cordova
        if(this.cordovaMode){
          document.addEventListener("deviceready", function(){
            assert('Your browser does not support SQL!', supportsSQL(this.webSQLMode));
            this._initDB(callback);
          }.bind(this), false);
        }else{
            assert('Your browser does not support SQL!', supportsSQL(this.webSQLMode));
            this._initDB(callback);
        }
        var _this = this;      
        this.schema.on('modelRegistered', function(model){
          return new Orbit.Promise(function(resolve, reject) {
            _this._updateSchema(model, false, function(){
              console.log('sql: schema.modelRegistered: loading records', model)
              resolve(_this._loadTable(model));
            });
          });
        });
      },

    
      _initDB: function(callback) {
        console.log("sql: _initDB");
        if(this.webSQLMode){
          this._initDBWebSQL(callback);
        }else{
          this._initDBSQLite(callback);
        }
      },

      _initDBWebSQL: function(callback) {
        console.log("sql: _initDBWebSQL");
        this._db = openDatabase(this.namespace, '', '', 2 * 1024 * 1024);
        this.schema.models;
        if(this._db.version != this.version){
          this.new_version = true;
          this._db.changeVersion(this._db.version, this.version, function(tx){
            console.log('websql: _initDB: changing db version from ', this._db.version, ' to ', this.version);
            //need execute sql otherwise version doesn't change in some browsers!
            console.log('websql: _initDB: clearing temp table');
            tx.executeSql("DROP TABLE IF EXISTS temp", null, function(tx, res){
              tx.executeSql("CREATE TABLE temp (id)", null, function(tx, res){
                return;
              });
            });
          }.bind(this), function(e){
            if(callback) return callback(this._db);
          }, function(e){
            if(callback) return callback(this._db);
          });
        }else{
          if(callback) return callback(this._db);
        }
      },

      _initDBSQLite: function(callback) {
        console.log("sql: _initDBSQLite");
        this._db = window.sqlitePlugin.openDatabase({name:this.namespace});
        this.schema.models;
        var _this = this;
        this._db.transaction(function(tx){
          tx.executeSql('PRAGMA user_version', [], function(tx, res){
            var version = res.rows.item(0).user_version;
            console.log('dbversion:', version, ' wanted version:', _this.version);
            if(version != _this.version){
              _this.new_version = true;
              if(callback) return callback(_this._db);
            }else{
              if(callback) return callback(_this._db);
            }
          }, function(tx, error){
            console.log('pragma select error', error);
          }, function(){})
        }, function(error){
          console.log('error', error);
        });
      },


    _updateSchema: function(type, force, cb){
      if(!this.new_version && !force){
        return cb();
      }
      console.log('websql: schema.modelRegistered: model table needs to be cleared and updated: ', type); 
      if(this.webSQLMode){
        this._updateSchemaWebSQL(type, force, cb);
      }else{
        this._updateSchemaSQLite(type, force, cb);
      }
    },


    _updateSchemaWebSQL: function(type, force, cb){
      var _this = this;
      this._db.transaction(function(tx) {
        tx.executeSql("DROP TABLE IF EXISTS " + type, null, function(tx, res){
          var model = _this.schema.models[type];
          var sql = "CREATE TABLE " + type + " (";
          sql += _this._escape(model.primaryKey.name) + " " + _this._parseModeltype(model.primaryKey.type) + " primary key ";
          for(var i in model.attributes){
            sql += ", " + _this._escape(i) + " " + _this._parseModeltype(model.primaryKey.type) + " ";
          }
          sql += ")";
          tx.executeSql(sql, null, function(tx, res){
            if(cb) return cb();
          }, function(tx, err){console.log(err)});
        });
      });
      
    },
    _updateSchemaSQLite: function(type, force, cb){
      var _this = this;
      this._db.transaction(function(tx) {
        tx.executeSql("DROP TABLE IF EXISTS " + type, null, function(tx, res){

          var model = _this.schema.models[type];
          var sql = "CREATE TABLE " + type + " (";
          sql += _this._escape(model.primaryKey.name) + " " + _this._parseModeltype(model.primaryKey.type) + " primary key ";
          for(var i in model.attributes){
            sql += ", " + _this._escape(i) + " " + _this._parseModeltype(model.primaryKey.type) + " ";
          }
          sql += ")";
          
          tx.executeSql(sql, null, function(tx, res){
            console.log('created'); 
            sql = 'PRAGMA user_version = ' + _this.version;
            console.log(sql);
            tx.executeSql(sql, null, function(tx, res){
              console.log('version changed');
              if(cb) return cb();
            }, function(tx, error){
              console.log('pragma change error', error)
            });
          }, function(tx, err){
            console.log(err)
          });
          
        }, function(tx, err){
          console.log('error dropping table', err)
        });
      });
      
    },



    _loadTable: function(type, cb){
      //console.log(this._find(type));
    },


    _parseModeltype: function(type){
      //parse ember data types to sql
      switch(type) {
        case 'boolean':
            return 'INTEGER';
            break;
        case 'integer':
            return 'INTEGER';
            break;
        case 'number':
            return 'NUMERIC';
            break;
        case 'date':
            return 'NUMERIC';
            break;
        case 'datetime':
            return 'NUMERIC';
            break;
        case 'float':
            return 'REAL';
            break;
        default:
            return 'TEXT'
      }
    },
    _escape: function(v) {
      return v;
    },

    _getAttributeNames: function(type, escaped){
      var arr = [];
      for(var i in this.schema.models[type].attributes){
        arr.push(escaped?this._escape(i):i);
      }
      return arr;
    },
    _parseSQLResultSetRows: function(type, res) {
      var r = {};
      if(!res || !res.hasOwnProperty('rows')){
        r[type] = [];
        return r;
      }
      var rows = [];
      for (var i=0;i<res.rows.length;i++) {
        rows.push(res.rows.item(i));
      };
      r[type] = rows;
      return r;
    },
    _parseSQLResultSetRow: function(type, res) {
      var rows = this._parseSQLResultSetRows(type, res);
      if(!rows) return;
      if(rows.length <= 0) return;
      return rows[0];
    },

    _generateSelectSQLObj: function(type, query, id) {
      var sql = "SELECT * FROM " + this._escape(type);
      if(!query && !id){
        return {sql:sql, values:null};
      }
      var where = [];
      var values = [];
      if(id){
        if(isArray(id)){            
          var marks = [];
        for (var i=0;i<id.length;i++) {
          marks.push('?');
          values.push(id[i]);
        }
        where.push(this._escape(this.schema.models[type].primaryKey.name) + " IN (" + marks.join(',') + ")");
        }else{            
          where.push(this._escape(this.schema.models[type].primaryKey.name) + " = ?");
          values.push(id);
        }
      }
      //todo data types like dates etc...
      //also OR BETWEEN STUFF...
      for(var i in query){
        where.push(this._escape(i) + " = ?");
        values.push(query[i]);
      }
      return {sql: sql + " WHERE " + where.join(' AND '), values: values};
    },
    _generateInsertSQLObj: function(type, data, id) {
      if(!id){
        id = uuid();
      }
      var attrs = this._getAttributeNames(type);
      var values = [id];
      var marks = ['?'];
      var cols = [this._escape(this.schema.models[type].primaryKey.name)];
      attrs.forEach(function(attr){
        cols.push(attr);
        values.push(data[attr]);
        marks.push('?');
      });   
      return {sql:"INSERT OR REPLACE  INTO " + this._escape(type) + " ("+cols.join(',')+") VALUES (" + marks.join(',') + ")", values: values};
    },
    _generateUpdateSQLObj: function(type, data, id) {
      var values = [];
      var set = [];
      for(var i in data){
        set.push(this._escape(i) + " = ?");
        values.push(data[i]);
      }
      values.push(id);
      return {sql:"UPDATE " + this._escape(type) + " SET " + set.join(',') + " WHERE " + this._escape(this.schema.models[type].primaryKey.name) + " = ?", values: values};
    },
    _generateDeleteSQLObj: function(type, id) {
      return {sql:"DELETE FROM " + this._escape(type) + " WHERE " + this._escape(this.schema.models[type].primaryKey.name) + " = ?", values: [id]};
    },










    _transform: function(operation) {
      console.log('sql: _transform: ', operation);
      var _this = this;
      var op    = operation.op;
      var path  = operation.path;

      if (path.length > 2) {
        if (path[2] === '__rel') {
          if (op === 'add') {
            return _this._transformAddLink(operation);
          } else if (op === 'remove') {
            return _this._transformRemoveLink(operation);
          } else if (op === 'replace') {
            return _this._transformReplaceLink(operation);
          }
        } else {
          return _this._transformUpdateAttribute(operation);
        }

      } else if (path.length > 1) {
        if (op === 'add') {
          return _this._transformAdd(operation);

        } else if (op === 'replace') {
          return _this._transformReplace(operation);

        } else if (op === 'remove') {
          return _this._transformRemove(operation);
        }
      }

      throw new OperationNotAllowed('sqlSource#transform could not process operation: ' + operation.op +
                                    ' with path: ' + operation.path.join('/'));
    },

      /////////////////////////////////////////////////////////////////////////////
      // Requestable interface implementation
      /////////////////////////////////////////////////////////////////////////////

      _find: function(type, id) {
        if (id && (typeof id === 'number' || typeof id === 'string')) {
          return this._findOne(type, id);

        } else if (id && isArray(id)) {
          return this._findMany(type, id);

        } else {
            return this._findQuery(type, id);
        }
      },

      

      /////////////////////////////////////////////////////////////////////////////
      // Internals
      /////////////////////////////////////////////////////////////////////////////


      _transformAdd: function(operation) {
        console.log('sql: _transformAdd: ', operation);
        var type = operation.path[0];
        var id = operation.path[1];
        var sqlObj = this._generateInsertSQLObj(type, operation.value, id);
        var _this = this;
        return this._sqlQuery(sqlObj.sql, sqlObj.values).then(function(res){
          //todo check errors
          var record = _this.deserialize(type, null, operation.value);
        });
      },

      _transformReplace: function(operation) {
        console.log('sql: _transformReplace: ', operation);
        var type = operation.path[0];
        var id = operation.path[1];
        var value = operation.value;

        var sqlObj = this._generateInsertSQLObj(type, operation.value, id);
        var _this = this;
        return this._sqlQuery(sqlObj.sql, sqlObj.values).then(function(res){
          //todo check errors
          var record = _this.deserialize(type, null, operation.value);
        });
      },


      _transformUpdateAttribute: function(operation) {
        console.log('sql: _transformUpdateAttribute: ', operation);
        
        var type = operation.path[0];
        var id = operation.path[1];
        var attr = operation.path[2];
        
        var record = {};
        record[attr] = operation.value;

        var sqlObj = this._generateUpdateSQLObj(type, record, id);
        var _this = this;
        return this._sqlQuery(sqlObj.sql, sqlObj.values, true).then(function(res){
          _this._transformCache(operation);
        });
      },

      _transformRemove: function(operation) {
        console.log('sql: _transformRemove: ', operation);

        var type = operation.path[0];
        var id = operation.path[1];

        var sqlObj = this._generateDeleteSQLObj(type, id);
        var _this = this;

        return this._sqlQuery(sqlObj.sql, sqlObj.values, true).then(function(res){
          _this._transformCache({op: 'remove', path: [type, id]});
        });
      },


      _findOne: function(type, id) {
        console.log('sql: _findOne: ', type, id);
        var sqlObj = this._generateSelectSQLObj(type, null, id);
        var _this = this;
        return this._sqlQuery(sqlObj.sql, sqlObj.values).then(function(res){
          var raw = _this._parseSQLResultSetRows(type, res);
          //todo should be single record;
          var record = _this.deserialize(type, null, raw);
          return _this.settleTransforms().then(function() {
            console.log('sql: _findOne: done', record[0]);
            return record[0];
          });
        });
      },

      _findMany: function(type, ids) {
        console.log('sql: _findMany: ', type, ids);
        var sqlObj = this._generateSelectSQLObj(type, null, ids);
        var _this = this;
        return this._sqlQuery(sqlObj.sql, sqlObj.values).then(function(res){
          var raw = _this._parseSQLResultSetRows(type, res);
          var records = _this.deserialize(type, null, raw);
          return _this.settleTransforms().then(function() {
            console.log('sql: _findMany: done', isArray(records) ? records : [records])
            return isArray(records) ? records : [records];
          });
        });
      },

      _findQuery: function(type, query) {
        console.log('sql: _findQuery: ', type, query);
        var sqlObj = this._generateSelectSQLObj(type, query);
        var _this = this;
        return this._sqlQuery(sqlObj.sql, sqlObj.values).then(function(res){
          var raw = _this._parseSQLResultSetRows(type, res);
          var records = _this.deserialize(type, null, raw);
          return _this.settleTransforms().then(function() {
            console.log('sql: _findQuery: done', records)
            return records;
          });
        });
      },

      _sqlQuery: function(sql, values, rowsAffected){
        var _this = this;
        return new Orbit.Promise(function(resolve, reject) {
          _this._db.transaction(function(tx) {
            tx.executeSql(sql, values, function(tx, res) {
              if(rowsAffected && res.rowsAffected <= 0) return reject();
              resolve(res);
            });
          });
        });
      },

      _transformCache: function(operation) {
        var pathToVerify,
            inverse;
            console.log('sql: _transformCache: ', operation);
        if (operation.op === 'add') {
          pathToVerify = operation.path.slice(0, operation.path.length - 1);
        } else {
          pathToVerify = operation.path;
        }
        if (this.retrieve(pathToVerify)) {
          // transforming the cache will trigger a call to `_cacheDidTransform`,
          // which will then trigger `didTransform`
          this._cache.transform(operation);

        } else if (operation.op === 'replace') {
          // try adding instead of replacing if the cache does not yet contain
          // the data
          operation.op = 'add';
          this._transformCache(operation);

        } else {
          // if the cache can't be transformed because, still trigger `didTransform`
          //
          // NOTE: this is not an error condition, since the local cache will often
          // be sparsely populated compared with the remote store
          this.didTransform(operation, []);
        }
      },

      _addRecordsToCache: function(type, records) {
        var _this = this;
        console.log('sql: _addRecordsToCache: ', type, records);
        for (var i=0; i<records.length; i++) {
          _this._addRecordToCache(type, records[i]);
        };
      },

      _addRecordToCache: function(type, record) {
        console.log('sql: _addRecordToCache: ', type, record);
        this._transformCache({
          op: 'add',
          path: [type, this.getId(type, record)],
          value: record
        });
      },

      resourceNamespace: function(type) {
        return this.namespace;
      },
      deserialize: function(type, id, data) {
        console.log('sql: deserialize: ', type, id, data);
        if(isArray(data[type])){
          for (var i=0; i<data[type].length; i++) {
            data[type][i] = this.schema.normalize(type, data[type][i]);
          }
        }
        var primaryRecords = data[type];
        console.log('sql: deserialize: primaryRecords: ', primaryRecords);
        if (this._cache) {
          if (isArray(primaryRecords)) {
            this._addRecordsToCache(type, primaryRecords);
          } else {
            this._addRecordToCache(type, primaryRecords);
          }
        }
        return primaryRecords;
      },

      purge: function(type){
        if(!type){
          type = [];
          for(var i in this.schema.models){
            type.push(i);
          }
        }
        if(isArray(type)){
          return new Orbit.Promise(function(resolve, reject) {
            for (var i=0; i<type.length; i++) {
              this._updateSchema(type[i], true);
            }
            resolve(type);
          }.bind(this));
        }else{
          return new Orbit.Promise(function(resolve, reject) {
            this._updateSchema(type, true, function(){
              resolve(type);              
            });
          }.bind(this));
        }
      }

    });

    __exports__["default"] = sqlSource;
  });

