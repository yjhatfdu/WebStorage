/**
 * Created by yjh on 16/5/2.
 */
    ///<reference path="../typings/websql/websql.d.ts"/>
///<reference path="../typings/promise/promise.d.ts"/>
///<reference path="Storage.ts"/>
class WebSqlStorage implements IWebStorage {
    private db;

    constructor() {

        this.db = window.openDatabase('storage', '1.0', 'storage', 1024 * 1024 * 1024);
        this.db.transaction(tx=> {
            tx.executeSql('CREATE TABLE IF NOT EXISTS storage(id text UNIQUE,name TEXT,size integer,category text,type integer,description text, payload INTEGER);');
            tx.executeSql("create index if not EXISTS 'id' on storage ('id')");
            tx.executeSql("create index if not EXISTS 'category' on storage ('category')");
        })
    }

    init(){
        return Promise.resolve(null)
    }

    insertItem(key, content, category = '_default', name = '', description = ''):any {
        let This = this;
        let transaction = function (payload, type):any {
            let size = payload.length;
            return new Promise((resolve, reject)=> {
                This.db.transaction(tx=>
                    tx.executeSql('insert into storage values(?,?,?,?,?,?,?)',
                        [key, name, size,category, type, description, payload], (tx, result)=> {
                            resolve(null)
                        }, (tx, err)=> {
                            reject(err)
                        })
                )
            })

        };

        if (typeof content == 'string') {
            let payload = btoa(content);
            return transaction(payload, DataType.string);
        } else if (content instanceof ArrayBuffer) {
            let view = new Uint8Array(content);
            let payload = '';
            for (let i = 0; i < view.length; i++)
                payload += String.fromCharCode(view[i]);
            payload = btoa(payload);
            return transaction(payload, DataType.arraybuffer)

        } else if (content instanceof Blob) {
            return new Promise(resovle=> {
                let fileReader = new FileReader();
                fileReader.onload = function () {
                    resovle(transaction(btoa(fileReader.result), DataType.blob))
                };
                fileReader.readAsBinaryString(content)
            });

        } else{
           return transaction(JSON.stringify(content),DataType.object)
        }
    }

    getItem(key) {
        return new Promise((resolve, reject)=> {
            this.db.transaction(tx=>
                tx.executeSql('select payload,type from storage where id=?',
                    [key], (tx, result)=> {
                        let item = result.rows[0];
                        switch (item['type']) {
                            case DataType.string:{
                                resolve(atob(item['payload']));
                                break
                            }
                            case DataType.arraybuffer:{
                                let str = atob(item['payload']);
                                let bufferArray = new Uint8Array(str.length);
                                for (let i = 0, il = str.length; i < il; i++) {
                                    bufferArray[i] = str.charCodeAt(i);
                                }
                                resolve(bufferArray.buffer);
                                break
                            }
                            case DataType.blob:{
                                let str = atob(item['payload']);
                                let bufferArray = new Uint8Array(str.length);
                                for (let i = 0, il = str.length; i < il; i++) {
                                    bufferArray[i] = str.charCodeAt(i);
                                }
                                resolve(new Blob([bufferArray.buffer]));
                                break
                            }
                            case DataType.object:{
                                resolve(JSON.parse(item['payload']))
                            }
                        }
                    }, (tx, err)=> {
                        reject(err)
                    })
            )
        })

    }

    listItems(category) {
        return new Promise((resolve, reject)=> {
            this.db.transaction(tx=> {
                let sql = 'select id,name,type,category,size,description from storage' + (category ? ' where category=?' : '');
                let args = [];
                if (category) args.push(category);
                tx.executeSql(sql, args, (tx, result)=> {
                    resolve(result.rows)
                }, (tx, err)=> {
                    reject(err)
                })
            })
        })
    }

    deleteItem(id) {
        return new Promise((resolve, reject)=> {
            this.db.transaction(tx=> {
                tx.executeSql('delete from storage where id=?', [id], (tx, result)=> {
                    resolve(null)
                }, (tx, err)=> {
                    reject(err)
                })
            })
        })
    }


    totalSize() {
        return new Promise((resolve, reject)=> {
            this.db.transaction(tx=> {
                tx.executeSql('select sum(size) from storage', [], (tx, result)=> {
                    resolve(result.rows[0]['sum(size)'])
                }, (tx, err)=> {
                    reject(err)
                })
            })
        })
    }
    setItem(key,content,category?,name?,description?){
        return this.deleteItem(key)
            .then(()=>this.insertItem(key,content,category,name,description),
                ()=>this.insertItem(key,content,category,name,description))
    }
    clear(){
        return new Promise(resolve=>{
            this.db.transaction(tx=>{
                tx.executeSql('delete from storage',[],()=>{
                    resolve(null)
                })
            })
        })
    }
}
