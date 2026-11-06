const {ipcMain,shell,dialog}=require('electron');
const fs=require('node:fs');
function createProgress({getWindow,startYoutube}){
 const tasks=new Map();let next=0;
 const publish=t=>{if(process.env.MEDIAGET_PROGRESS_PROBE)require('fs').appendFileSync(process.env.MEDIAGET_PROGRESS_PROBE+'.events',JSON.stringify({state:t.state,received:t.received,total:t.total})+'\n');const w=getWindow();if(w&&!w.isDestroyed())w.webContents.send('mediaget-download-progress',t);updateTaskbar();};
 function updateTaskbar(){const w=getWindow();if(!w||w.isDestroyed())return;const active=[...tasks.values()].filter(t=>['preparing','downloading','merging'].includes(t.state));if(!active.length)w.setProgressBar(-1);else if(active.some(t=>!t.total))w.setProgressBar(2);else w.setProgressBar(active.reduce((n,t)=>n+t.received,0)/active.reduce((n,t)=>n+t.total,0));}
 function start(url,name){const task={id:++next,name:name||'视频文件',state:'preparing',received:0,total:0,speed:0,url};tasks.set(task.id,task);publish(task);let plan;try{plan=require('./youtube-download.cjs').recipe(new URL(url).searchParams.get('url'));}catch{}if(plan&&startYoutube){Promise.resolve(startYoutube(plan,task.name,changes=>{Object.assign(task,changes);publish({...task,item:undefined,savedPath:undefined,url:undefined,canReveal:task.state==='completed'&&!!task.savedPath});})).then(item=>task.item=item).catch(()=>{task.state='interrupted';publish({...task,url:undefined});});return;}getWindow().webContents.downloadURL(url);setTimeout(()=>{if(task.state==='preparing'){task.state='interrupted';publish({...task,url:undefined});}},120000).unref();}
 function attach(item){const chain=item.getURLChain();let task=[...tasks.values()].find(t=>t.state==='preparing'&&chain.includes(t.url));if(!task){task={id:++next,name:item.getFilename(),received:0,total:0,speed:0};tasks.set(task.id,task);}task.name=item.getFilename();task.state='downloading';task.item=item;let lastBytes=0,lastTime=Date.now();
 function send(state){const now=Date.now(),received=item.getReceivedBytes();if(now-lastTime>300){task.speed=Math.max(0,(received-lastBytes)*1000/(now-lastTime));lastTime=now;lastBytes=received;}Object.assign(task,{state,received,total:item.getTotalBytes(),paused:item.isPaused()});publish({...task,item:undefined,url:undefined,savedPath:undefined,canReveal:state==='completed'&&!!task.savedPath});}
 send('downloading');item.on('updated',(_e,state)=>send(state==='interrupted'?'interrupted':'downloading'));item.once('done',(_e,state)=>{if(state==='completed')task.savedPath=item.getSavePath();send(state);task.item=null;while(tasks.size>30){const old=[...tasks.values()].find(t=>!['preparing','downloading','merging'].includes(t.state));if(!old)break;tasks.delete(old.id);}});
 }
 ipcMain.on('mediaget-start-download',(event,payload)=>{const w=getWindow();if(!w||event.sender!==w.webContents)return;try{const u=new URL(payload.url),origin=new URL(w.webContents.getURL()).origin;if(u.origin!==origin||!['/api/video-proxy','/api/image'].includes(u.pathname)||u.searchParams.get('download')!=='1')return;start(u.href,u.searchParams.get('filename'));}catch{}});
 ipcMain.on('mediaget-cancel-download',(event,id)=>{if(event.sender!==getWindow()?.webContents)return;tasks.get(id)?.item?.cancel();});
 ipcMain.on('mediaget-reveal-download',async(event,id)=>{
  const w=getWindow();if(!w||event.sender!==w.webContents)return;
  const task=tasks.get(id);if(task?.state!=='completed'||!task.savedPath)return;
  if(!fs.existsSync(task.savedPath)){await dialog.showMessageBox(w,{type:'info',message:'找不到下载文件',detail:'文件可能已被移动或删除。'});return;}
  shell.showItemInFolder(task.savedPath);
 });
 return {attach,start,show:()=>getWindow()?.webContents.send('mediaget-show-downloads')};
}
module.exports={createProgress};



