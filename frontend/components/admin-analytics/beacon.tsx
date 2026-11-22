'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { routeOf, sourceOf } from '@/lib/analytics/normalize';
import { startVitals, finishVitals } from '@/lib/analytics/vitals-client';
function post(value: object) {
  void fetch('/api/a',{method:'POST',body:JSON.stringify(value),keepalive:true,credentials:'omit',referrerPolicy:'origin'}).catch(()=>{});
}
export function TraceBeacon() {
  const path=usePathname();
  const previous=useRef<string | null>(null);
  useEffect(()=>{
    if (previous.current === path || navigator.webdriver) return;
    const first=previous.current===null;
    previous.current=path;
    if (!first) finishVitals();
    const page=routeOf(path);
    if (!page) return;
    const source=first ? sourceOf(document.referrer) : 'Internal';
    post({page,source,vw:window.innerWidth});
    if (first) startVitals(path,({p, ...metrics})=>post({page:routeOf(p),metrics,vw:window.innerWidth}));
  },[path]);
  useEffect(()=>{
    const hide=()=>{if(document.visibilityState==='hidden') finishVitals()};
    document.addEventListener('visibilitychange',hide);
    window.addEventListener('pagehide',finishVitals);
    return ()=>{ document.removeEventListener('visibilitychange',hide);window.removeEventListener('pagehide',finishVitals); };
  },[]);
  return null;
}
