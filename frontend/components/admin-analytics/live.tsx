'use client';
import {useState,useEffect} from 'react';
export function Live({initial}:{initial:number}){
 const [n,set]=useState<number|null>(initial);
 useEffect(()=>{let on=true;const id=setInterval(async()=>{if(document.hidden)return;try{const r=await fetch('/api/admin/analytics/live',{cache:'no-store'});if(!r.ok)throw Error();const v=await r.json();if(on)set(v.live)}catch{if(on)set(null)}},15000);return()=>{on=false;clearInterval(id)}},[]);
 return <strong>{n??'—'}</strong>
}
