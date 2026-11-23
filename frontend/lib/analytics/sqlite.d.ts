// The VPS uses Node 22's built-in SQLite. The rest of Trace still targets Node 20 typings.
declare module 'node:sqlite' {
  type Value = string | number | null;
  export class DatabaseSync {
    constructor(path:string);
    exec(sql:string):void;
    close():void;
    prepare(sql:string):{
      run(...args:Value[]):{changes:number|bigint};
      get(...args:Value[]):Record<string,string|number>|undefined;
      all(...args:Value[]):Record<string,string|number>[];
    };
  }
}
