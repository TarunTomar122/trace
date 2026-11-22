// The VPS uses Node 22's built-in SQLite. The rest of Trace still targets Node 20 typings.
declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path:string);
    exec(sql:string):void;
    prepare(sql:string):{
      run(...args:(string|number)[]):{changes:number|bigint};
      get(...args:(string|number)[]):Record<string,string|number>|undefined;
      all(...args:(string|number)[]):Record<string,string|number>[];
    };
  }
}
