const {platforms,matchesHost}=require('./platforms.cjs');
function mergedCookie(existing,configured){
 const pairs=new Map();for(const value of [existing,configured])for(const part of (value||'').split(';')){const i=part.indexOf('=');if(i>0)pairs.set(part.slice(0,i).trim(),part.slice(i+1).trim());}return Array.from(pairs,([k,v])=>`${k}=${v}`).join('; ');
}
function installCookieFetch(){
 const original=globalThis.fetch;
 globalThis.fetch=function(input,init){
  let url;try{url=new URL(input instanceof Request?input.url:String(input));}catch{return original(input,init);}
  const p=platforms.filter(p=>matchesHost(url.hostname,p.domains)).sort((a,b)=>Math.max(...b.domains.map(x=>x.length))-Math.max(...a.domains.map(x=>x.length)))[0];
  const cookie=p&&process.env[p.key];
  if(url.protocol!=='https:'||!cookie||/[\r\n]/.test(cookie))return original(input,init);
  const request=new Request(input,init),headers=new Headers(request.headers);
  headers.set('cookie',mergedCookie(headers.get('cookie'),cookie));
  return original(new Request(request,{headers}));
 };
}
module.exports={installCookieFetch,mergedCookie};
