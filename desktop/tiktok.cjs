const {execFile}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
function validUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='tiktok.com'||u.hostname.endsWith('.tiktok.com'))&&!u.username&&!u.password;}catch{return false;}}
async function parseTiktok(url){
 if(!validUrl(url))return {code:400,msg:'请提供有效的 TikTok HTTPS 分享链接。'};
 const tools=process.env.MEDIAGET_TOOLS_DIR||path.join(__dirname,'tools');let temporary;
 try{
  const args=['--ignore-config','--no-playlist','--no-warnings','--dump-single-json','--skip-download','--socket-timeout','20','--retries','1','--js-runtimes','node:'+process.execPath,'--ffmpeg-location',tools];
  if(process.env.MEDIAGET_PROXY_URL)args.push('--proxy',process.env.MEDIAGET_PROXY_URL);
  if(process.env.TIKTOK_COOKIE){temporary=fs.mkdtempSync(path.join(os.tmpdir(),'mediaget-tiktok-'));const file=path.join(temporary,'cookies.txt'),lines=['# Netscape HTTP Cookie File'];for(const part of process.env.TIKTOK_COOKIE.split(';')){const i=part.indexOf('=');if(i<1)continue;const key=part.slice(0,i).trim(),value=part.slice(i+1).trim();if(!/[\r\n\t]/.test(key+value))lines.push(['.tiktok.com','TRUE','/','TRUE','0',key,value].join('\t'));}fs.writeFileSync(file,lines.join('\n')+'\n',{mode:0o600});args.push('--cookies',file);}
  args.push('--',url);
  const info=await new Promise((resolve,reject)=>execFile(path.join(tools,'yt-dlp.exe'),args,{windowsHide:true,timeout:90000,maxBuffer:12*1024*1024,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}},(e,out,err)=>{if(e){reject(new Error(e.code==='ENOENT'?'内置解析组件不可用，请在“组件”菜单重新检查。':/login|captcha|verify|bot|log in/i.test(err)?'TikTok 要求登录或安全验证，请更换代理出口，或手动配置 TIKTOK_COOKIE 后重试。':'无法获取 TikTok 视频，请检查代理、地区限制和链接是否有效后重试。'));return;}try{resolve(JSON.parse(out));}catch{reject(new Error('TikTok 返回数据无法读取。'));}}));
  const formats=(info.formats||[]).filter(f=>f.url&&/^https:\/\//.test(f.url)&&f.vcodec&&f.vcodec!=='none'&&f.acodec&&f.acodec!=='none').sort((a,b)=>(b.height||0)-(a.height||0)||(b.tbr||0)-(a.tbr||0));
  if(!formats.length)return {code:201,msg:'未获取到可下载的视频，内容可能为图集、已删除或受访问限制。'};
  const choices=[...new Map(formats.map(f=>[f.height,formats.find(x=>x.height===f.height)])).values()],best=choices[0];
  const label=f=>f.width&&f.height?`${f.width}×${f.height}`:f.format_note||'默认';
  return {code:200,msg:'解析成功',data:{type:'video',source:'yt-dlp',title:info.title||'TikTok 视频',author:info.uploader||info.creator||info.channel||'',cover:info.thumbnail||'',url:best.url+'#mediaget-tiktok='+encodeURIComponent(info.webpage_url||url)+'&height='+(best.height||0),duration:(info.duration||0)*1000,qualityLabel:label(best),qualities:choices.length>1?choices.map(f=>({quality:f.height||0,label:label(f),url:f.url+'#mediaget-tiktok='+encodeURIComponent(info.webpage_url||url)+'&height='+(f.height||0)})):undefined}};
 }catch(e){return {code:201,msg:e.message};}finally{if(temporary){try{fs.rmSync(temporary,{recursive:true,force:true});}catch{}}}
}
module.exports={parseTiktok,validUrl};
