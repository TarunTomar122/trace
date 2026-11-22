import { headers } from 'next/headers';
import type {ReactNode} from 'react';
import { AdminGate,AdminSignOut } from '@/components/admin-analytics/gate';
import { Live } from '@/components/admin-analytics/live';
import { SiteIcon } from '@/components/admin-analytics/site-icon';
import { authorized,snapshot } from '@/lib/analytics/admin-data';
import { dashboard,live } from '@/lib/analytics/store';
import './style.css';
export const dynamic='force-dynamic';
export const metadata={title:'Analytics · Trace',robots:{index:false,follow:false}};
const tabs=['Visitors','Signups','Speed','System'];
const names=new Intl.DisplayNames('en',{type:'region'});
const fmt=(n:number)=>n.toLocaleString('en-US');
function Stat({name,value,note}:{name:string;value:ReactNode;note:string}){return <div className="stat"><small>{name}</small><div>{value}</div><small>{note}</small></div>}
function Chart({series,title}:{series:{day:string;n:number}[];title:string}){
 const max=Math.max(1,...series.map(v=>v.n));
 return <section><h2>{title}</h2><div className="chart" aria-label={title}>{series.map(p=><div key={p.day} title={p.day+' · '+p.n} style={{height:Math.max(1,100*p.n/max)+'%'}}><span>{p.n||''}</span></div>)}</div><footer>{series[0]?.day}<span>{series.at(-1)?.day} UTC</span></footer></section>
}
function List({title,rows,kind}:{title:string;rows:{label:string;n:number}[];kind?:string}){
 return <section><h2>{title}</h2>{rows.length?rows.map(({label,n})=><div className="dataRow" key={label}><span>{kind==='source'&&label.includes('.')&&<SiteIcon host={label}/>}
 {kind==='country'&&/^[A-Z]{2}$/.test(label)?String.fromCodePoint(...Array.from(label,c=>c.charCodeAt(0)+127397))+' '+names.of(label):label}</span><b>{fmt(n)}</b></div>):<p>No visits recorded in this period.</p>}</section>
}
const titles:Record<string,string>={ttfb:'Time to first byte',fcp:'First contentful paint',lcp:'Largest contentful paint',inp:'Interaction to next paint',cls:'Cumulative layout shift',origin:'Caddy origin response'};
export default async function Page({searchParams}:{searchParams:Promise<{tab?:string;days?:string}>}){
 if(!await authorized())return <main className="traceAdmin gate"><AdminGate/></main>;
 const q=await searchParams,tab=tabs.find(t=>t.toLowerCase()===q.tab)||'Visitors',days=[1,7,30].includes(Number(q.days))?Number(q.days):7;
 const host=(await headers()).get('host')||'';
 const data=['Visitors','Speed'].includes(tab)?dashboard(host,days):null;
 const snap=data?null:await snapshot();
 const health=snap?.health;
 return <main className="traceAdmin"><header><div><small>Trace / Admin</small><h1>Analytics</h1></div><AdminSignOut/></header>
 <nav>{tabs.map(t=><a aria-current={tab===t?'page':undefined} key={t} href={'?tab='+t.toLowerCase()+'&days='+days}>{t}</a>)}</nav>
 <div className="sub"><h2>{tab}</h2>{data?<div className="ranges">{[1,7,30].map(n=><a aria-current={days===n?'true':undefined} href={'?tab='+tab.toLowerCase()+'&days='+n} key={n}>{n===1?'Today':n+' days'}</a>)}</div>:<small>Updated every 5 minutes</small>}</div>
 {tab==='Visitors'&&data&&<><div className="stats"><Stat name="Live now" value={<Live initial={live(host)}/>} note="Past 5 minutes"/><Stat name="Visitors" value={fmt(data.visitors)} note="Daily unique visitors, summed"/><Stat name="Page views" value={fmt(data.pages.reduce((n,r)=>n+r.n,0))} note="Public web pages"/></div><Chart series={data.series} title="Visitors by day"/><div className="grid"><List title="Top pages" rows={data.pages}/><List title="Traffic sources" rows={data.sources} kind="source"/><List title="Countries" rows={data.countries} kind="country"/><List title="Devices" rows={data.devices}/></div><small>Country lookup by Cloudflare and DB-IP Lite (CC BY 4.0).</small></>}
 {tab==='Signups'&&snap&&<><div className="stats"><Stat name="Free newsletter signups" value={fmt(snap.total)} note="Free web newsletter records"/><Stat name="Active subscribers" value={fmt(snap.active)} note="Currently opted in"/><Stat name="New signups" value={fmt(Object.values(snap.daily).reduce((a,b)=>a+b,0))} note="Last 30 UTC days"/></div><Chart title="Newsletter signups by day" series={Array.from({length:30},(_,i)=>{const day=new Date(Date.parse(snap.updated)-(29-i)*86400000).toISOString().slice(0,10);return {day,n:snap.daily[day]||0}})}/><small>Subscriber snapshot · {new Date(snap.updated).toUTCString()}</small></>}
 {tab==='Speed'&&data&&<section><h2>Real page loads</h2><p>{fmt(data.loads)} measured loads · 75th percentile. Caddy measures time to upstream response headers on origin loads.</p><div className="dataRow"><small>Measurement</small><small>Samples · p75</small></div>{data.speed.map(r=><div key={r.metric} className="dataRow"><span>{titles[r.metric]}</span><b>{r.count} · {r.p75===null?'—':r.p75+(r.metric==='cls'?'':' ms')}</b></div>)}</section>}
 {tab==='System'&&health?.generated_at&&<><p>{new Date().getTime()-Date.parse(health.generated_at)>900000?'Stale check':'Latest check'} · {new Date(health.generated_at).toUTCString()}</p><div className="stats"><Stat name="Available memory" value={(health.mem_available/2**30).toFixed(1)+' GiB'} note={'Of '+(health.mem_total/2**30).toFixed(1)+' GiB'}/><Stat name="Load average" value={health.load[0]} note={'1 minute · '+health.cpus+' CPUs'}/></div><section><h2>Storage on the shared VPS</h2>{health.disks.map(d=><div className="dataRow" key={d.label}><span>{d.label}</span><b>{(d.free/2**30).toFixed(1)} GiB free</b></div>)}</section></>}
 {((tab==='System'&&!health?.generated_at)||(tab==='Signups'&&!snap))&&<section>Snapshot unavailable. Check the VPS snapshot timer.</section>}
 </main>
}
