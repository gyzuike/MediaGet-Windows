const {ProxyAgent}=require('undici');
function installYoutubeProxy(){
 const value=process.env.MEDIAGET_PROXY_URL;if(!value)return;
 const proxy=new ProxyAgent(value),original=globalThis.fetch;
 const domains=['instagram.com','instagr.am','cdninstagram.com','fbcdn.net','tiktok.com','tiktokcdn.com','tiktokcdn-us.com','tiktokcdn-eu.com','tiktokv.com','tiktokv.us','byteoversea.com','ibytedtos.com','muscdn.com','youtube.com','youtube-nocookie.com','youtu.be','googlevideo.com','ytimg.com','ggpht.com','googleapis.com','pipedapi.ducks.party','pipedapi.leptons.xyz','pipedapi.projectsegfau.lt'];
 for(const list of [process.env.YOUTUBE_PIPED_HOSTS,process.env.YOUTUBE_INVIDIOUS_HOSTS])for(const v of (list||'').split(',')){try{domains.push(new URL(v.includes('://')?v:'https://'+v).hostname);}catch{}}
 globalThis.fetch=(input,init)=>{let host;try{host=new URL(typeof input==='string'||input instanceof URL?input:input.url).hostname;}catch{return original(input,init);}return original(input,domains.some(d=>host===d||host.endsWith('.'+d))?{...init,dispatcher:proxy}:init);};
}
module.exports={installYoutubeProxy};
