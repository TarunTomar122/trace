import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { newSalt, visitorHash, utcDay } from './visitor';
import { PRODUCTION_HOSTS, routeOf, sourceOf } from './normalize';
import { deviceClass } from './ua';
import { ensureGeo, countryOf } from './geo';

export const METRICS=['ttfb','fcp','lcp','inp','cls','origin'] as const;
type Metric=typeof METRICS[number];
type Metrics=Partial<Record<Metric,number>>;
type Event={time:number;page:string;visitor:string;source:string;device:string;country:string;metrics:Metrics|null};
type Bucket={db:DatabaseSync;queue:Event[];timer?:ReturnType<typeof setTimeout>};
const state=globalThis as typeof globalThis & {traceAnalytics?:Map<string,Bucket>};
function bucket(host:string):Bucket {
  const ns=process.env.NODE_ENV==='production' && PRODUCTION_HOSTS.includes(host.toLowerCase())?'production':'development';
  const stores=state.traceAnalytics??=new Map();
  const existing=stores.get(ns); if(existing) return existing;
  const dir=process.env.TRACE_ANALYTICS_DIR || join(tmpdir(),'trace-web-analytics');
  mkdirSync(dir,{recursive:true,mode:0o700});
  const db=new DatabaseSync(join(dir,ns+'.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=1500;
    CREATE TABLE IF NOT EXISTS salt(day TEXT PRIMARY KEY,key TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS seen(day TEXT, visitor TEXT, last INTEGER, PRIMARY KEY(day,visitor));
    CREATE INDEX IF NOT EXISTS seen_last ON seen(last);
    CREATE TABLE IF NOT EXISTS totals(day TEXT,kind TEXT,label TEXT,n INTEGER,PRIMARY KEY(day,kind,label));
    CREATE TABLE IF NOT EXISTS timings(day TEXT,metric TEXT,value INTEGER,n INTEGER,PRIMARY KEY(day,metric,value));`);
  const b={db,queue:[]};stores.set(ns,b);return b;
}
export async function collect(host:string,ip:string,ua:string,cf:string|null,input:unknown) {
  if (!input || typeof input!=='object') return;
  const data=input as Record<string,unknown>,page=routeOf(data.page);
  if(!page) return;
  const metrics:Metrics|null=data.metrics && typeof data.metrics==='object'?{}:null;
  if(metrics) {
    for(const key of METRICS) {
      const v=(data.metrics as Metrics)[key];
      if(typeof v==='number' && Number.isFinite(v) && v>=0 && v<=(key==='cls'?10:120000)) metrics[key]=v;
    }
    if(!Object.keys(metrics).length)return;
  }
  if(!cf) await ensureGeo();
  const b=bucket(host),time=Date.now(),day=utcDay(time);
  if(b.queue.length>=500) return;
  let salt=b.db.prepare('SELECT key FROM salt WHERE day=?').get(day)?.key;
  if(!salt){
    b.db.prepare('INSERT OR IGNORE INTO salt VALUES(?,?)').run(day,newSalt());
    salt=b.db.prepare('SELECT key FROM salt WHERE day=?').get(day)!.key;
  }
  const rawSource=data.source;
  const source=rawSource==='Direct'||rawSource==='Internal'?rawSource:sourceOf('https://'+String(rawSource));
  b.queue.push({time,page,source,device:deviceClass(ua,typeof data.vw==='number'?data.vw:null),country:cf||countryOf(ip)||'Unknown',visitor:visitorHash(String(salt),'trace',ip,ua),metrics});
  schedule(b,3000);
}
function schedule(b:Bucket,delay:number){
  if(b.timer)return;
  b.timer=setTimeout(()=>{
    b.timer=undefined;
    try{flush(b)}catch{console.warn('[analytics] batch write failed');schedule(b,30000)}
  },delay);
}
export function maintain(){
  for(const host of ['www.yourtrace.online','localhost']){
    const b=bucket(host);
    b.db.prepare('DELETE FROM seen WHERE last < ?').run(Date.now()-5*86400000);
    b.db.prepare('DELETE FROM salt WHERE day < ?').run(utcDay(Date.now()));
  }
}
function flush(b:Bucket) {
  if(!b.queue.length)return;
  const db=b.db;
  const add=db.prepare('INSERT INTO totals VALUES(?,?,?,1) ON CONFLICT(day,kind,label) DO UPDATE SET n=n+1');
  const timing=db.prepare('INSERT INTO timings VALUES(?,?,?,1) ON CONFLICT(day,metric,value) DO UPDATE SET n=n+1');
  const mark=db.prepare('INSERT OR IGNORE INTO seen VALUES(?,?,?)');
  const update=db.prepare('UPDATE seen SET last=? WHERE day=? AND visitor=?');
  db.exec('BEGIN IMMEDIATE');
  try {
    for(const e of b.queue){
      const day=utcDay(e.time);
      if(e.metrics){
        add.run(day,'loads','all');
        for(const [metric,v] of Object.entries(e.metrics)) timing.run(day,metric,Math.round(metric==='cls'?v*1000:v/10)* (metric==='cls'?1:10));
      }else{
        if(mark.run(day,e.visitor,e.time).changes)add.run(day,'visitors','all');
        else update.run(e.time,day,e.visitor);
        for(const [kind,label] of [['page',e.page],['device',e.device],['country',e.country],['source',e.source]])add.run(day,kind,label);
      }
    }
    db.prepare('DELETE FROM seen WHERE day < ?').run(utcDay(Date.now()-4*86400000));
    db.prepare('DELETE FROM salt WHERE day < ?').run(utcDay(Date.now()));
    db.exec('COMMIT');b.queue.length=0;
  }catch(e){db.exec('ROLLBACK');throw e}
}
export function live(host:string) {
  return Number(bucket(host).db.prepare('SELECT COUNT(DISTINCT visitor) n FROM seen WHERE last>=?').get(Date.now()-300000)?.n || 0);
}
export function dashboard(host:string,days:number) {
  const db=bucket(host).db;
  const dates=Array.from({length:days},(_,i)=>utcDay(Date.now()-(days-i-1)*86400000));
  const rows=db.prepare('SELECT day,kind,label,n FROM totals WHERE day>=?').all(dates[0]) as unknown as {day:string;kind:string;label:string;n:number}[];
  const rank=(kind:string)=>{
    const sums=new Map<string,number>();
    for(const r of rows) if(r.kind===kind)sums.set(r.label,(sums.get(r.label)||0)+r.n);
    return [...sums].map(([label,n])=>({label,n})).sort((a,b)=>b.n-a.n);
  };
  const series=dates.map(day=>({day,n:rows.find(r=>r.day===day&&r.kind==='visitors')?.n||0}));
  const speed=METRICS.map(metric=>{
    const bins=db.prepare('SELECT value,SUM(n) n FROM timings WHERE day>=? AND metric=? GROUP BY value ORDER BY value').all(dates[0],metric) as unknown as {value:number;n:number}[];
    const count=bins.reduce((n,b)=>n+b.n,0);let sum=0;
    const p75=bins.find(b=>(sum+=b.n)>=Math.ceil(count*.75))?.value;
    return {metric,count,p75:p75===undefined?null:p75/(metric==='cls'?1000:1)};
  });
  return {series,pages:rank('page'),sources:rank('source'),countries:rank('country'),devices:rank('device'),visitors:series.reduce((s,d)=>s+d.n,0),loads:rank('loads')[0]?.n||0,speed};
}
