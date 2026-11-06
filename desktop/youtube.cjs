const {execFile}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const inflight=new Map();
function videoId(value){try{const u=new URL(value);if(u.protocol!=='https:'&&u.protocol!=='http:')return null;const host=u.hostname.toLowerCase();let id;if(host==='youtu.be')id=u.pathname.split('/')[1];else if(host==='youtube.com'||host.endsWith('.youtube.com'))id=u.searchParams.get('v')||u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/]+)/)?.[1];return /^[A-Za-z0-9_-]{11}$/.test(id||'')?id:null;}catch{return null;}}
async function extract(id){
 let temporary;
 const args=['--ignore-config','--no-playlist','--no-warnings','--socket-timeout','20','--retries','1','--js-runtimes','node:'+process.execPath,'--dump-single-json','--skip-download'];
 if(process.env.MEDIAGET_PROXY_URL)args.push('--proxy',process.env.MEDIAGET_PROXY_URL);
 const cookie=process.env.YOUTUBE_COOKIE;
 try{
  if(cookie){temporary=fs.mkdtempSync(path.join(os.tmpdir(),'mediaget-yt-'));const file=path.join(temporary,'cookies.txt');const lines=['# Netscape HTTP Cookie File'];for(const part of cookie.split(';')){const pos=part.indexOf('=');if(pos<1)continue;const name=part.slice(0,pos).trim(),value=part.slice(pos+1).trim();if(/[\r\n\t]/.test(name+value))continue;lines.push(['.youtube.com','TRUE','/','TRUE','0',name,value].join('\t'));}fs.writeFileSync(file,lines.join('\n')+'\n',{mode:0o600});args.push('--cookies',file);}
  args.push('--','https://www.youtube.com/watch?v='+id);
  const info=await new Promise((resolve,reject)=>execFile(path.join(process.env.MEDIAGET_TOOLS_DIR||path.join(__dirname,'tools'),'yt-dlp.exe'),args,{windowsHide:true,timeout:120000,maxBuffer:20*1024*1024,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}},(error,stdout,stderr)=>{if(error){reject(new Error(/sign in|not a bot|login|cookies/i.test(stderr)?'YouTube 要求登录验证，请在账号菜单登录后保存会话；也可更换当前代理出口。':'YouTube 解析失败：请检查系统代理是否可用，或稍后重试。'));return;}try{resolve(JSON.parse(stdout));}catch{reject(new Error('YouTube 返回的数据无法读取。'));}}));
  const formats=(info.formats||[]).filter(f=>f.url&&/^https:\/\//.test(f.url)&&f.vcodec&&f.vcodec!=='none'&&['https','m3u8_native','m3u8','http_dash_segments'].includes(f.protocol)).sort((a,b)=>(b.height||0)-(a.height||0)||(b.fps||0)-(a.fps||0)||(b.tbr||0)-(a.tbr||0));
  if(!formats.length)return {code:201,msg:'该视频没有可下载的视频格式。'};
  const best=formats[0];const choices=[...new Map(formats.map(f=>[f.height,formats.find(x=>x.height===f.height)])).values()];return {code:200,msg:'解析成功',data:{videoId:id,type:'video',source:'yt-dlp',title:info.title||'YouTube 视频',author:info.uploader||info.channel||'',cover:info.thumbnail||'',url:best.url+'#mediaget-yt='+id+'&height='+(best.height||0),duration:(info.duration||0)*1000,qualityLabel:(best.height||'')+'p',embedUrl:'https://www.youtube-nocookie.com/embed/'+id,qualities:choices.length>1?choices.map(f=>({quality:f.height||0,label:(f.height||'默认')+'p',url:f.url+'#mediaget-yt='+id+'&height='+(f.height||0)})):undefined}};
 }catch(e){return {code:201,msg:e.message};}finally{if(temporary){try{fs.rmSync(temporary,{recursive:true,force:true});}catch{}}}
}
async function parseYoutube(url){const id=videoId(url);if(!id)return {code:400,msg:'无法识别 YouTube 视频链接。'};if(!inflight.has(id)){const p=extract(id).finally(()=>inflight.delete(id));inflight.set(id,p);}return inflight.get(id);}
module.exports={parseYoutube,videoId};


