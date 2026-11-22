export async function register(){
  if(process.env.NEXT_RUNTIME==='nodejs' && process.env.TRACE_ANALYTICS_DIR){
    const {maintain}=await import('./lib/analytics/store');
    const prune=()=>{try{maintain()}catch{console.warn('[analytics] retention check failed')}};
    prune();
    setInterval(prune,60*60*1000).unref();
  }
}
