const fs=require('node:fs'),path=require('node:path');
function createDownloads({app,session,dialog,shell,data,getWindow,getYoutubeOptions}){
 const progress=require('./progress.cjs').createProgress({getWindow,startYoutube});
 const file=path.join(data,'desktop-settings.json');let settings={};
 try{settings=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
 const reserved=new Set();
 const directory=()=>typeof settings.downloadDirectory==='string'?settings.downloadDirectory:'';
 function validate(dir){if(!path.isAbsolute(dir)||!fs.statSync(dir).isDirectory())throw new Error('请选择有效文件夹。');fs.accessSync(dir,fs.constants.W_OK);}
 function setDirectory(dir){validate(dir);const next={...settings,downloadDirectory:dir};fs.writeFileSync(file,JSON.stringify(next,null,2),'utf8');settings=next;session.setDownloadPath(dir);}
 async function choose(){try{const result=await dialog.showOpenDialog(getWindow(),{title:'选择下载目录',defaultPath:directory()||app.getPath('downloads'),properties:['openDirectory','createDirectory']});if(result.canceled||!result.filePaths.length)return;setDirectory(result.filePaths[0]);await dialog.showMessageBox(getWindow(),{type:'info',message:'下载目录已设置',detail:directory()+'\n后续下载直接保存到此目录，重启后仍然生效。'});}catch(e){await dialog.showMessageBox(getWindow(),{type:'error',message:'下载目录设置失败',detail:e.message});}}
 async function open(){const dir=directory()||app.getPath('downloads');const error=await shell.openPath(dir);if(error)await dialog.showMessageBox(getWindow(),{message:'无法打开下载目录',detail:error});}
 function filename(value){let name=path.win32.basename(value).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'');if(!name)name='download';if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))name='_'+name;return name;}
 function target(dir,name){name=filename(name);const ext=path.extname(name),base=path.basename(name,ext);let full=path.join(dir,name),i=1;while(fs.existsSync(full)||reserved.has(full.toLowerCase()))full=path.join(dir,`${base} (${i++})${ext}`);reserved.add(full.toLowerCase());return full;}
 if(directory()){try{validate(directory());session.setDownloadPath(directory());}catch{}}
 session.on('will-download',(_event,item)=>{
  progress.attach(item);
  if(!directory())return;
  let full;
  try{validate(directory());full=target(directory(),item.getFilename());item.setSavePath(full);}
  catch{if(full)reserved.delete(full.toLowerCase());item.setSaveDialogOptions({defaultPath:path.join(app.getPath('downloads'),filename(item.getFilename()))});dialog.showMessageBox(getWindow(),{type:'warning',message:'原下载目录不可用',detail:'本次请在保存窗口选择位置。可在“文件 → 设置下载目录”重新设置。'});}
  item.once('done',(_event,state)=>{if(full)reserved.delete(full.toLowerCase());if(state==='interrupted')dialog.showMessageBox(getWindow(),{type:'error',message:'下载未完成',detail:'请检查网络、磁盘空间以及下载目录的写入权限，然后重试。'});});
 });

 async function startYoutube(plan,name,update){
  let full;
  try{
   const ext=plan.kind==='tiktok'?'mp4':'mkv';const base=path.basename(filename(name),path.extname(filename(name)))+'.'+ext;let dir=directory();
   if(dir){try{validate(dir);}catch{dir='';}}
   if(!dir){const result=await dialog.showSaveDialog(getWindow(),{title:plan.kind==='instagram'?'保存 Instagram 视频（自动合并）':plan.kind==='tiktok'?'保存 TikTok 视频':'保存 YouTube 视频（自动合并）',defaultPath:path.join(app.getPath('downloads'),base),filters:[{name:ext.toUpperCase()+' 视频',extensions:[ext]}]});if(result.canceled||!result.filePath){update({state:'cancelled'});return;}dir=path.dirname(result.filePath);name=path.basename(result.filePath,path.extname(result.filePath))+'.'+ext;}else name=base;
   full=target(dir,name);update({name:path.basename(full),state:'preparing'});
   return require('./youtube-download.cjs').runMerged({plan,target:full,...getYoutubeOptions(),cookie:plan.kind==='instagram'?getYoutubeOptions().instagramCookie:plan.kind==='tiktok'?getYoutubeOptions().tiktokCookie:getYoutubeOptions().youtubeCookie,onUpdate:update,onDone:result=>{reserved.delete(full.toLowerCase());update(result);if(process.env.MEDIAGET_INSTAGRAM_PROBE)fs.writeFileSync(process.env.MEDIAGET_INSTAGRAM_PROBE+'.download',JSON.stringify(result));if(process.env.MEDIAGET_TIKTOK_PROBE)fs.writeFileSync(process.env.MEDIAGET_TIKTOK_PROBE+'.download',JSON.stringify(result));if(process.env.MEDIAGET_MERGE_PROBE)fs.writeFileSync(process.env.MEDIAGET_MERGE_PROBE,JSON.stringify(result));}});
  }catch{if(full)reserved.delete(full.toLowerCase());update({state:'interrupted',error:'无法保存文件，请重新设置可写的下载目录。'});}
 }
 return {startDownload:progress.start,choose,open,setDirectory,directory,showProgress:progress.show};
}
module.exports={createDownloads};



