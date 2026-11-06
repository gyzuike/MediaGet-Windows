const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn,execFile}=require('node:child_process');
const active=new Set();
function recipe(value){try{const u=new URL(value);if(u.protocol!=='https:')return null;const hash=new URLSearchParams(u.hash.slice(1)),height=Number(hash.get('height'));if(!Number.isInteger(height)||height<0||height>16384)return null;if(/(^|\.)tiktok(?:cdn(?:-us|-eu)?)?\.com$/i.test(u.hostname)){const url=hash.get('mediaget-tiktok');if(url&&require('./tiktok.cjs').validUrl(url))return {kind:'tiktok',url,height};}if(/(^|\.)(cdninstagram\.com|fbcdn\.net|instagram\.com)$/i.test(u.hostname)){const url=hash.get('mediaget-instagram');if(url&&require('./instagram.cjs').validUrl(url))return {kind:'instagram',url,height};}if(!/(^|\.)googlevideo\.com$/i.test(u.hostname))return null;const id=hash.get('mediaget-yt');return /^[\w-]{11}$/.test(id||'')?{id,height}:null;}catch{return null;}}
function runMerged({plan,target,proxy,cookie,onUpdate,onDone}){
 const tools=process.env.MEDIAGET_TOOLS_DIR||path.join(__dirname,'tools'),instagram=plan.kind==='instagram',tiktok=plan.kind==='tiktok',container=tiktok?'mp4':'mkv';let job,proc,cancelled=false,output='',buffer='',lastError='',phase='video';
 function stop(){cancelled=true;if(proc?.pid){execFile('taskkill.exe',['/PID',String(proc.pid),'/T','/F'],{windowsHide:true},()=>{});}}
 let finish;stop.done=new Promise(resolve=>finish=resolve);active.add(stop);
 (async()=>{try{
  job=fs.mkdtempSync(path.join(path.dirname(target),'.mediaget-yt-'));
  const args=['--ignore-config','--no-playlist','--no-warnings','--no-simulate','--no-quiet','--newline','--progress','--progress-delta','0.3','--socket-timeout','20','--retries','2','--no-cache-dir','--js-runtimes','node:'+process.execPath,'--ffmpeg-location',tools,'--format',tiktok?(plan.height?`b[ext=mp4][height<=${plan.height}]/b[height<=${plan.height}]`:'b[ext=mp4]/b'):(plan.height?`bestvideo[height<=${plan.height}]+bestaudio/best[height<=${plan.height}]`:'bestvideo+bestaudio/best'),'--format-sort','res,fps,br','--merge-output-format',container,'--remux-video',container,'--output',path.join(job,'media.%(ext)s'),'--progress-template','download:MG_PROGRESS {"downloaded":%(progress.downloaded_bytes)j,"total":%(progress.total_bytes,progress.total_bytes_estimate)j,"speed":%(progress.speed)j,"vcodec":%(info.vcodec)j}','--progress-template','postprocess:MG_MERGE %(progress.status)s','--print','after_move:MG_FILE %(filepath)j'];
  if(proxy)args.push('--proxy',proxy);
  if(cookie){const lines=['# Netscape HTTP Cookie File'];for(const part of cookie.split(';')){const i=part.indexOf('=');if(i<1)continue;const k=part.slice(0,i).trim(),v=part.slice(i+1).trim();if(!/[\r\n\t]/.test(k+v))lines.push([instagram?'.instagram.com':tiktok?'.tiktok.com':'.youtube.com','TRUE','/','TRUE','0',k,v].join('\t'));}const file=path.join(job,'cookies.txt');fs.writeFileSync(file,lines.join('\n')+'\n',{mode:0o600});args.push('--cookies',file);}
  args.push('--',(tiktok||instagram)?plan.url:'https://www.youtube.com/watch?v='+plan.id);
  proc=spawn(path.join(tools,'yt-dlp.exe'),args,{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});
  function line(value){if(value.startsWith('MG_PROGRESS ')){try{const p=JSON.parse(value.slice(12));phase=p.vcodec==='none'?'audio':'video';onUpdate({state:'downloading',phase,received:Number(p.downloaded)||0,total:Number(p.total)||0,speed:Number(p.speed)||0});}catch{}}
   else if(value.startsWith('MG_MERGE ')||value.startsWith('[Merger]')||value.startsWith('[VideoRemuxer]'))onUpdate({state:'merging',phase:'merge',received:0,total:0,speed:0});
   else if(value.startsWith('MG_FILE ')){try{output=JSON.parse(value.slice(8));}catch{}}
  }
  proc.stdout.on('data',chunk=>{buffer+=chunk.toString();let i;while((i=buffer.indexOf('\n'))>=0){line(buffer.slice(0,i).trim());buffer=buffer.slice(i+1);}});
  proc.stderr.on('data',chunk=>{lastError=(lastError+chunk.toString()).slice(-4000);});
  await new Promise((resolve,reject)=>{proc.on('error',reject);proc.on('close',code=>code===0?resolve():reject(new Error('Download failed')));});
  if(cancelled)throw new Error('cancelled');
  if(!output||path.dirname(path.resolve(output))!==path.resolve(job)||!fs.existsSync(output)||!fs.statSync(output).size)throw new Error('合并后没有生成有效文件');
  onUpdate({state:'merging',phase:'save',received:0,total:0,speed:0});
  await fs.promises.copyFile(output,target,fs.constants.COPYFILE_EXCL);
  if(cancelled){fs.unlinkSync(target);throw new Error('cancelled');}onDone({state:'completed',savedPath:target,received:fs.statSync(target).size,total:fs.statSync(target).size});
 }catch(e){onDone({state:cancelled?'cancelled':'interrupted',error:cancelled?'':/sign in|not a bot|login/i.test(lastError)?(instagram?'Instagram':tiktok?'TikTok':'YouTube')+' 要求登录验证，请登录或更换代理出口后重试。':'下载或合并失败，请检查代理、磁盘空间和文件夹权限后重试。'});}finally{active.delete(stop);if(job){try{fs.rmSync(job,{recursive:true,force:true});}catch{}}finish();}})();
 return {cancel:stop};
}
async function cancelAll(){const jobs=[...active];for(const stop of jobs)stop();await Promise.all(jobs.map(stop=>stop.done));}
module.exports={recipe,runMerged,cancelAll};

