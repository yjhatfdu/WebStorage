import IThenable = Promise.IThenable;
/**
 * Created by yjh on 16/5/2.
 */
///<reference path="IndexedDBVendor.ts"/>
///<reference path="WebsqlVendor.ts"/>

interface IWebStorage{
     //insertItem(key,content,category?,name?,description?)

    init():IThenable<any>;

    setItem(key,content,category?,name?,description?)

    getItem(key)

    deleteItem(key)

    listItems(category?)

    totalSize();

    clear();

}
enum DataType{
    string,
    blob,
    arraybuffer,
    object
}
