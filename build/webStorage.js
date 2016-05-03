var DataType;
(function (DataType) {
    DataType[DataType["string"] = 0] = "string";
    DataType[DataType["blob"] = 1] = "blob";
    DataType[DataType["arraybuffer"] = 2] = "arraybuffer";
    DataType[DataType["object"] = 3] = "object";
})(DataType || (DataType = {}));
/**
 * Created by yjh on 16/5/3.
 */
///<reference path="Storage.ts"/>
///<reference path="../typings/promise/promise.d.ts"/>
var IDBStorage = (function () {
    function IDBStorage() {
        this.initialized = false;
        this.init();
    }
    IDBStorage.prototype.init = function () {
        var _this = this;
        return new Promise(function (resolve) {
            if (_this.initialized)
                resolve(null);
            var req = indexedDB.open('storage', 7);
            req.addEventListener('success', function (e) {
                _this.db = e.target['result'];
                _this.initialized = true;
                resolve(null);
            });
            req.addEventListener('upgradeneeded', function (e) {
                //try{
                _this.db = e.target['result'];
                try {
                    _this.db.createObjectStore('payloads', { keyPath: 'id' });
                }
                catch (e) { }
                try {
                    _this.db.createObjectStore('meta', { keyPath: 'id' });
                }
                catch (e) { }
                try {
                    e.target['transaction'].objectStore('meta').createIndex('category', 'category');
                }
                catch (e) {
                    console.log(e);
                }
                //}catch (e) {}
            });
        });
    };
    IDBStorage.prototype.insertItem = function (key, content, category, name, description) {
        var _this = this;
        if (category === void 0) { category = '_default'; }
        if (name === void 0) { name = ''; }
        if (description === void 0) { description = ''; }
        return new Promise(function (resolve, reject) {
            try {
                var tx = _this.db.transaction(['payloads', 'meta'], 'readwrite');
                var payloads = tx.objectStore('payloads');
                var meta = tx.objectStore('meta');
                var payload = content;
                var type;
                if (content instanceof ArrayBuffer) {
                    payload = new Blob([content]);
                    type = DataType.arraybuffer;
                }
                else if (content instanceof Blob) {
                    type = DataType.blob;
                }
                else if (typeof content == 'string') {
                    type = DataType.string;
                }
                else {
                    payload = JSON.stringify(payload);
                    type = DataType.object;
                }
                payloads.add({ 'id': key, 'payload': payload });
                meta.add({
                    'id': key,
                    'size': payload.size || payload.length,
                    'type': type,
                    'category': category,
                    'name': name,
                    'description': description
                });
                tx.oncomplete = function () { return resolve(null); };
                tx.onerror = function (e) { return reject(e.target.error); };
            }
            catch (e) {
                reject(e);
            }
        });
    };
    IDBStorage.prototype.getItem = function (key) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            try {
                var tx = _this.db.transaction(['payloads', 'meta'], 'readonly');
                var payloads = tx.objectStore('payloads');
                var meta = tx.objectStore('meta');
                meta.get(key).onsuccess = (function (e) {
                    var metaInfo = e.target.result;
                    payloads.get(key).onsuccess = (function (e) {
                        var payload = e.target.result['payload'];
                        switch (metaInfo['type']) {
                            case DataType.arraybuffer: {
                                var reader = new FileReader();
                                reader.onload = function (e) {
                                    resolve(reader.result);
                                };
                                reader.readAsArrayBuffer(payload);
                                break;
                            }
                            case DataType.object: {
                                resolve(JSON.parse(payload));
                                break;
                            }
                            default: {
                                resolve(payload);
                            }
                        }
                    });
                });
            }
            catch (e) {
                reject(e);
            }
        });
    };
    IDBStorage.prototype.deleteItem = function (key) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            try {
                var tx = _this.db.transaction(['meta', 'payloads'], 'readwrite');
                tx.objectStore('meta').delete(key);
                tx.objectStore('payloads').delete(key);
                tx.oncomplete = function (e) { return resolve(null); };
                tx.onerror = function (e) { return resolve(null); };
            }
            catch (e) {
                reject(e);
            }
        });
    };
    IDBStorage.prototype.listItems = function (category) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            try {
                var tx = _this.db.transaction(['meta'], 'readonly');
                var range;
                if (category)
                    range = IDBKeyRange.only(category);
                var req;
                req = category ? tx.objectStore('meta')
                    .index('category')
                    .openCursor(range) :
                    tx.objectStore('meta')
                        .openCursor();
                req.onsuccess = (function (e) {
                    var cursor = e.target.result;
                    var results = [];
                    try {
                        while (true) {
                            cursor.continue();
                            results.push(cursor.value);
                        }
                    }
                    catch (e) { }
                    resolve(results);
                });
                tx.onerror = (function (e) { return reject(e.target.error); });
            }
            catch (e) {
                reject(e);
            }
        });
    };
    IDBStorage.prototype.totalSize = function () {
        return this.listItems().then(function (list) {
            var sum = 0;
            for (var _i = 0; _i < list.length; _i++) {
                var item = list[_i];
                sum += item['size'];
            }
            return sum;
        });
    };
    IDBStorage.prototype.setItem = function (key, content, category, name, description) {
        var _this = this;
        return this.deleteItem(key)
            .then(function () { return _this.insertItem(key, content, category, name, description); });
    };
    IDBStorage.prototype.clear = function () {
        var _this = this;
        return new Promise(function (resolve) {
            var tx = _this.db.transaction(['meta', 'payloads'], 'readwrite');
            tx.objectStore('meta').clear();
            tx.objectStore('payloads').clear();
            tx.oncomplete = function (e) { return resolve(null); };
        });
    };
    return IDBStorage;
})();
/**
 * Created by yjh on 16/5/2.
 */
///<reference path="../typings/websql/websql.d.ts"/>
///<reference path="../typings/promise/promise.d.ts"/>
///<reference path="Storage.ts"/>
var WebSqlStorage = (function () {
    function WebSqlStorage() {
        this.db = window.openDatabase('storage', '1.0', 'storage', 1024 * 1024 * 1024);
        this.db.transaction(function (tx) {
            tx.executeSql('CREATE TABLE IF NOT EXISTS storage(id text UNIQUE,name TEXT,size integer,category text,type integer,description text, payload INTEGER);');
            tx.executeSql("create index if not EXISTS 'id' on storage ('id')");
            tx.executeSql("create index if not EXISTS 'category' on storage ('category')");
        });
    }
    WebSqlStorage.prototype.init = function () {
        return Promise.resolve(null);
    };
    WebSqlStorage.prototype.insertItem = function (key, content, category, name, description) {
        if (category === void 0) { category = '_default'; }
        if (name === void 0) { name = ''; }
        if (description === void 0) { description = ''; }
        var This = this;
        var transaction = function (payload, type) {
            var size = payload.length;
            return new Promise(function (resolve, reject) {
                This.db.transaction(function (tx) {
                    return tx.executeSql('insert into storage values(?,?,?,?,?,?,?)', [key, name, size, category, type, description, payload], function (tx, result) {
                        resolve(null);
                    }, function (tx, err) {
                        reject(err);
                    });
                });
            });
        };
        if (typeof content == 'string') {
            var payload = btoa(content);
            return transaction(payload, DataType.string);
        }
        else if (content instanceof ArrayBuffer) {
            var view = new Uint8Array(content);
            var payload = '';
            for (var i = 0; i < view.length; i++)
                payload += String.fromCharCode(view[i]);
            payload = btoa(payload);
            return transaction(payload, DataType.arraybuffer);
        }
        else if (content instanceof Blob) {
            return new Promise(function (resovle) {
                var fileReader = new FileReader();
                fileReader.onload = function () {
                    resovle(transaction(btoa(fileReader.result), DataType.blob));
                };
                fileReader.readAsBinaryString(content);
            });
        }
        else {
            return transaction(JSON.stringify(content), DataType.object);
        }
    };
    WebSqlStorage.prototype.getItem = function (key) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.db.transaction(function (tx) {
                return tx.executeSql('select payload,type from storage where id=?', [key], function (tx, result) {
                    var item = result.rows[0];
                    switch (item['type']) {
                        case DataType.string: {
                            resolve(atob(item['payload']));
                            break;
                        }
                        case DataType.arraybuffer: {
                            var str = atob(item['payload']);
                            var bufferArray = new Uint8Array(str.length);
                            for (var i = 0, il = str.length; i < il; i++) {
                                bufferArray[i] = str.charCodeAt(i);
                            }
                            resolve(bufferArray.buffer);
                            break;
                        }
                        case DataType.blob: {
                            var str = atob(item['payload']);
                            var bufferArray = new Uint8Array(str.length);
                            for (var i = 0, il = str.length; i < il; i++) {
                                bufferArray[i] = str.charCodeAt(i);
                            }
                            resolve(new Blob([bufferArray.buffer]));
                            break;
                        }
                        case DataType.object: {
                            resolve(JSON.parse(item['payload']));
                        }
                    }
                }, function (tx, err) {
                    reject(err);
                });
            });
        });
    };
    WebSqlStorage.prototype.listItems = function (category) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.db.transaction(function (tx) {
                var sql = 'select id,name,type,category,size,description from storage' + (category ? ' where category=?' : '');
                var args = [];
                if (category)
                    args.push(category);
                tx.executeSql(sql, args, function (tx, result) {
                    resolve(result.rows);
                }, function (tx, err) {
                    reject(err);
                });
            });
        });
    };
    WebSqlStorage.prototype.deleteItem = function (id) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.db.transaction(function (tx) {
                tx.executeSql('delete from storage where id=?', [id], function (tx, result) {
                    resolve(null);
                }, function (tx, err) {
                    reject(err);
                });
            });
        });
    };
    WebSqlStorage.prototype.totalSize = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.db.transaction(function (tx) {
                tx.executeSql('select sum(size) from storage', [], function (tx, result) {
                    resolve(result.rows[0]['sum(size)']);
                }, function (tx, err) {
                    reject(err);
                });
            });
        });
    };
    WebSqlStorage.prototype.setItem = function (key, content, category, name, description) {
        var _this = this;
        return this.deleteItem(key)
            .then(function () { return _this.insertItem(key, content, category, name, description); }, function () { return _this.insertItem(key, content, category, name, description); });
    };
    WebSqlStorage.prototype.clear = function () {
        var _this = this;
        return new Promise(function (resolve) {
            _this.db.transaction(function (tx) {
                tx.executeSql('delete from storage', [], function () {
                    resolve(null);
                });
            });
        });
    };
    return WebSqlStorage;
})();
///<reference path="Storage.ts"/>
WebStorage = (function () {
    if (window.indexedDB) {
        return new IDBStorage();
    }
    else if (window.openDatabase) {
        return new WebSqlStorage();
    }
    else {
        throw ('You need to use a newer browser with indexedDB or websql support');
    }
})();
function WebStorageVendor(vendor) {
    if (vendor == 'websql') {
        WebStorage = new WebSqlStorage();
    }
    if (vendor == 'indexedDB') {
        WebStorage = new IDBStorage();
    }
}
//# sourceMappingURL=webStorage.js.map