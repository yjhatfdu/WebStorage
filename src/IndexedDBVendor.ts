

/**
 * Created by yjh on 16/5/3.
 */
    ///<reference path="Storage.ts"/>
    ///<reference path="../typings/promise/promise.d.ts"/>


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
                let tx=this.db.transaction(['payloads','meta'],'readwrite');
                let payloads=tx.objectStore('payloads');
                let meta=tx.objectStore('meta');
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

                meta.add({
                    'id':key,
                    'size':payload.size||payload.length,
                    'type':type,
                    'category':category,
                    'name':name,
                    'description':description
                });
                tx.oncomplete=()=>resolve(null);
                tx.onerror=(e)=>reject(e.target.error);
            }catch (e){
                reject(e)
            }
        });
    }

    getItem(key){
        return new Promise((resolve,reject)=>{
            try{
                let tx=this.db.transaction(['payloads','meta'],'readonly');
                let payloads=tx.objectStore('payloads');
                let meta=tx.objectStore('meta');
                meta.get(key).onsuccess=(e=>{
                    let metaInfo=e.target.result;
                    payloads.get(key).onsuccess=(e=>{
                        if(!e.target.result){
                            resolve(null)
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

    deleteItem(key){
        return new Promise((resolve,reject)=>{
            try{
                let tx=this.db.transaction(['meta','payloads'],'readwrite');
                tx.objectStore('meta').delete(key);
                tx.objectStore('payloads').delete(key);
                tx.oncomplete=e=>resolve(null);
                tx.onerror=e=>resolve(null);
            }catch (e){
                reject(e)
            }
        })
    }

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

    totalSize(){
        return this.listItems().then(list=>{
            var sum=0;
            for (let item of list){
                sum+=item['size']
            }
            return sum
        })
    }
    setItem(key,content,category?,name?,description?){
        return this.deleteItem(key)
            .then(()=>this.insertItem(key,content,category,name,description))
    }
    clear(){
        return new Promise(resolve=>{
            let tx=this.db.transaction(['meta','payloads'],'readwrite');
            tx.objectStore('meta').clear();
            tx.objectStore('payloads').clear();
            tx.oncomplete=e=>resolve(null)
        })
    }
}