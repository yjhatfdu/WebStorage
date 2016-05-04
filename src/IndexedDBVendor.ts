

/**
 * Created by yjh on 16/5/3.
 */
    ///<reference path="Storage.ts"/>
    ///<reference path="../typings/promise/promise.d.ts"/>

function checkInit(target,name,descriptor){
    let func=descriptor.value;
    descriptor.value=function(){
        let args=arguments;
        if(this.initialized==false){
            return this.init().then(()=>{
                return func.apply(this,args)
            });
        }else{
            return func.apply(this,args)
        }
    }
}

class IDBStorage implements IWebStorage{
    private db;
    initialized=false;
    constructor(){
       this.init();
    }

    init(){
        return new Promise(resolve=>{
            if(this.initialized) resolve(null);
            let req=indexedDB.open('storage',7);
            req.addEventListener('success',e=>{
                this.db=e.target['result'];
                this.initialized=true;
                resolve(null)
            });
            req.addEventListener('upgradeneeded',e=>{
                //try{
                this.db=e.target['result'];
                try{
                    this.db.createObjectStore('payloads',{keyPath:'id'});

                }catch (e){}
                try{
                    this.db.createObjectStore('meta',{keyPath:'id'});
                }catch (e){}
                try{
                    e.target['transaction'].objectStore('meta').createIndex('category','category');
                }catch (e){console.log(e)}
                //}catch (e) {}
            })
        })
    }

    insertItem(key,content,category='_default',name='',description=''){
        return new Promise((resolve,reject)=>{
            try{
                let tx=this.db.transaction(['payloads'],'readwrite');

                let payloads=tx.objectStore('payloads');

                let payload=content;
                let type;
                if (content instanceof ArrayBuffer){
                    payload=new Blob([content]);
                    type=DataType.arraybuffer
                }else if (content instanceof Blob){
                    type=DataType.blob
                }else if (typeof content=='string'){
                    type=DataType.string
                }else{
                    payload=JSON.stringify(payload);
                    type=DataType.object
                }
                payloads.add({'id':key,'payload':payload});
                tx.oncomplete=e=>{
                    let tx2=this.db.transaction(['meta'],'readwrite');
                    let meta=tx2.objectStore('meta');
                    meta.add({
                        'id':key,
                        'size':payload.size||payload.length,
                        'type':type,
                        'category':category,
                        'name':name,
                        'description':description
                    });
                    tx2.oncomplete=()=>resolve(null);
                    tx2.onerror=tx.onerror=(e)=>reject(e.target.error);
                };

            }catch (e){
                reject(e)
            }
        });
    }

    @checkInit
    getItem(key){
        return new Promise((resolve,reject)=>{
            try{

                let tx2=this.db.transaction(['meta'],'readonly');
                let meta=tx2.objectStore('meta');

                meta.get(key).onsuccess=(e=>{
                    let metaInfo=e.target.result;
                    let tx=this.db.transaction(['payloads'],'readonly');

                    let payloads=tx.objectStore('payloads');
                    payloads.get(key).onsuccess=(e=>{
                        if(!e.target.result){
                            resolve(null);
                            return
                        }
                        let payload=e.target.result['payload'];
                        switch (metaInfo['type']){
                            case DataType.arraybuffer:{
                                let reader=new FileReader();
                                reader.onload=e=>{
                                    resolve(reader.result)
                                };
                                reader.readAsArrayBuffer(payload);
                                break
                            }
                            case DataType.object:{
                                resolve(JSON.parse(payload));
                                break
                            }
                                default:{
                                    resolve(payload)
                                }
                        }
                    })
                })
            }catch (e){
                reject(e)
            }
        })
    }

    @checkInit
    deleteItem(key){
        return new Promise((resolve,reject)=>{
            try{
                let tx=this.db.transaction(['meta'],'readwrite');
                tx.objectStore('meta').delete(key);
                tx.oncomplete=e=>{
                    let tx2=this.db.transaction(['payloads'],'readwrite');
                    tx2.objectStore('payloads').delete(key);
                    tx2.oncomplete=e=>resolve(null);
                    tx2.onerror=e=>resolve(null)
                };
                tx.onerror=e=>resolve(null);
            }catch (e){
                reject(e)
            }
        })
    }

    @checkInit
    listItems(category?):Promise.IThenable<Array<any>>{
        return new Promise((resolve,reject)=>{
            try{
                let tx=this.db.transaction(['meta'],'readonly');
                let range;
                if(category) range=IDBKeyRange.only(category);
                let req;
                req=category?tx.objectStore('meta')
                    .index('category')
                    .openCursor(range):
                    tx.objectStore('meta')
                    .openCursor();

                req.onsuccess=(e=>{
                    let cursor=e.target.result;
                    let results=[];
                    try{
                        while (true){
                            cursor.continue();
                            results.push(cursor.value);
                        }
                    }catch(e) {}

                    resolve(results)
                });
                tx.onerror=(e=>reject(e.target.error))
            }catch (e){
                reject(e)
            }
        })
    }

    @checkInit
    totalSize(){
        return this.listItems().then(list=>{
            var sum=0;
            for (let item of list){
                sum+=item['size']
            }
            return sum
        })
    }
    @checkInit
    setItem(key,content,category?,name?,description?){
        return this.deleteItem(key)
            .then(()=>this.insertItem(key,content,category,name,description)).catch(()=>{})
    }

    @checkInit
    clear(){
        return new Promise(resolve=>{
            let tx=this.db.transaction(['meta'],'readwrite');
            tx.objectStore('meta').clear();
            let tx2=this.db.transaction(['payloads'],'readwrite');
            tx2.objectStore('payloads').clear();
            tx.oncomplete=e=>resolve(null)

        })
    }
}