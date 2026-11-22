import { readFile } from 'node:fs/promises';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE,verifyAdminCookie } from './admin-auth';
export async function authorized(){return verifyAdminCookie((await cookies()).get(ADMIN_COOKIE)?.value)}
type Row={label:string;n:number};
type Snapshot={updated:string;total:number;active:number;daily:Record<string,number>;channels?:Row[];forms?:Row[];referrers?:Row[];referred?:number;health:{generated_at:string|null;cpus:number;load:number[];mem_total:number;mem_available:number;disks:{label:string;free:number;total:number}[]}};
export async function snapshot():Promise<Snapshot|null>{
  try{return JSON.parse(await readFile('/var/lib/trace-analytics-snapshot/latest.json','utf8'))}catch{return null}
}
