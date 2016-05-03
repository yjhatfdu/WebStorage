/**
 * Created by yjh on 16/5/3.
 */
///<reference path="Storage.ts"/>
declare let WebStorage:IWebStorage;
WebStorage=(function():IWebStorage{
    if(window.indexedDB){
        return new IDBStorage();
    }else if(window.openDatabase){
        return new WebSqlStorage()
    }else{
        throw ('You need to use a newer browser with indexedDB or websql support')
    }
})();
function WebStorageVendor(vendor:string){
    if(vendor=='websql'){
        WebStorage=new WebSqlStorage()
    }
    if(vendor=='indexedDB'){
        WebStorage=new IDBStorage()
    }
}