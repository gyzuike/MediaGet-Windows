const {app,BrowserWindow,Menu,dialog,shell,session}=require('electron');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),http=require('node:http');
const {serializeCookies,validCookies,updateEnv,readEnv,ensurePlatformEnv}=require('./cookies.cjs');
const {platforms,allowedNavigation}=require('./platforms.cjs');
const {createDownloads}=require('./downloads.cjs');

if(process.env.MEDIAGET_TEST_DATA)app.setPath('userData',process.env.MEDIAGET_TEST_DATA);
let child,win,loginWin,stopping=false,restarting=false,origin,config,data,server,loginSession,components;
if(!app.requestSingleInstanceLock())app.quit();
else {
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.focus();}});
 app.on('before-quit',event=>{if(stopping)return;stopping=true;event.preventDefault();require('./youtube-download.cjs').cancelAll().finally(()=>{if(child?.connected)child.send('mediaget-shutdown');app.quit();});});
 app.on('window-all-closed',()=>app.quit());
 app.whenReady().then(start).catch(e=>{dialog.showErrorBox('MediaGet 启动失败',e.message);app.quit();});
}
async function waitReady(proc){
 const deadline=Date.now()+60000;
 while(Date.now()<deadline){
  if(proc.exitCode!==null||proc.spawnError)throw new Error('本地服务启动失败，请查看配置目录中的 server.log。');
  const ok=await new Promise(resolve=>{const req=http.get(origin+'/api/health',res=>{res.resume();if(process.env.MEDIAGET_SMOKE_TEST)fs.writeFileSync(process.env.MEDIAGET_SMOKE_TEST+'.http',String(res.statusCode));resolve(res.statusCode===200);});req.setTimeout(1500,()=>req.destroy());req.on('error',e=>{if(process.env.MEDIAGET_SMOKE_TEST)fs.writeFileSync(process.env.MEDIAGET_SMOKE_TEST+'.http',e.message);resolve(false);});});
  if(ok)return;
  await new Promise(r=>setTimeout(r,300));
 }
 throw new Error('本地服务启动超时，请查看 server.log。');
}
async function launchServer(){
 const configured=readEnv(config).MEDIAGET_PROXY_URL;
 let youtubeProxy='';
 if(configured&&/^https?:\/\//.test(configured))youtubeProxy=configured;
 else if(configured!=='direct'){const resolved=await session.defaultSession.resolveProxy('https://www.youtube.com/');const entry=resolved.split(';').map(x=>x.trim()).find(x=>/^(PROXY|HTTPS) /.test(x));if(entry)youtubeProxy=(entry.startsWith('HTTPS ')?'https://':'http://')+entry.split(' ')[1];}

 process.env.MEDIAGET_ACTIVE_PROXY=youtubeProxy;
 const log=fs.openSync(path.join(data,'server.log'),'a');
 const proc=spawn(process.execPath,[path.join(__dirname,'server-runner.cjs')],{cwd:server,windowsHide:true,stdio:['ignore',log,log,'ipc'],env:{...process.env,...readEnv(config),MEDIAGET_PROXY_URL:youtubeProxy,ELECTRON_RUN_AS_NODE:'1',NODE_ENV:'production',HOSTNAME:'127.0.0.1',PORT:new URL(origin).port,NEXT_TELEMETRY_DISABLED:'1'}});
 fs.closeSync(log);child=proc;
 proc.on('error',()=>{proc.spawnError=true;});
 proc.on('exit',()=>{if(proc===child&&win&&!stopping&&!restarting){dialog.showErrorBox('本地服务已退出','请重新启动 MediaGet，或查看 server.log。');app.quit();}});
 await waitReady(proc);
}
async function restartServer(){
 if(restarting)throw new Error('服务正在应用配置，请稍后再试。');
 restarting=true;
 try{
  if(child&&child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);if(child.connected)child.send('mediaget-shutdown');else child.kill();});
  await launchServer();
 } finally {restarting=false;}
}
async function loadLogin(current,p,ses,mode='system'){
 let error;
 for(const network of mode==='system'?['system','direct']:['direct','system']){
  if(current.isDestroyed())return;
  try{await ses.setProxy({mode:network});await ses.closeAllConnections();await current.loadURL(p.url);fs.appendFileSync(path.join(data,'login-network.log'),`${new Date().toISOString()} ${p.id} loaded ${network}\n`);return;}
  catch(e){if(current.isDestroyed())return;error=e;fs.appendFileSync(path.join(data,'login-network.log'),`${new Date().toISOString()} ${p.id} failed ${network} ${e.code||e.errno||''}\n`);}
 }
 if(process.env.MEDIAGET_LOGIN_PROBE){fs.writeFileSync(process.env.MEDIAGET_LOGIN_PROBE+'.error',error.message);return;}
 const result=await dialog.showMessageBox(current,{type:'error',message:p.name+' 页面暂时无法打开',detail:'已尝试系统网络设置和直接连接。\n具体错误：'+error.message,buttons:['重试','关闭'],cancelId:1});
 if(result.response===0)return loadLogin(current,p,ses);current.close();
}
async function openLogin(p=platforms.find(p=>p.id==='xhs')){
 if(loginWin&&!loginWin.isDestroyed()){
  loginWin.focus();await dialog.showMessageBox(loginWin,{message:'请先关闭当前账号窗口，再打开其他平台。'});return;
 }
 const ses=session.fromPartition(p.id==='xhs'?'persist:xhs-login':`persist:${p.id}-login`);
 ses.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
 let timer,interval,busy=false,done=false;
 const current=loginWin=new BrowserWindow({icon:app.isPackaged?path.join(process.resourcesPath,'server','public','icon.png'):path.resolve(__dirname,'../public/icon.png'),width:1100,height:800,title:p.name+' · 登录后自动保存，或使用顶部“保存当前会话”',webPreferences:{session:ses,nodeIntegration:false,contextIsolation:true,sandbox:true}});
 current.webContents.setUserAgent(current.webContents.getUserAgent().replace(/\s(?:Electron|mediaget-desktop)\/[\w.-]+/g,''));
 const navigate=(e,url)=>{if(!allowedNavigation(url,p))e.preventDefault();};
 current.webContents.on('will-navigate',navigate);current.webContents.on('will-redirect',navigate);
 current.webContents.setWindowOpenHandler(({url})=>{if(allowedNavigation(url,p))current.loadURL(url).catch(()=>{});return {action:'deny'};});
 async function capture(manual=false){
  if(done||busy||current.isDestroyed()||!allowedNavigation(current.webContents.getURL(),p))return;
  busy=true;
  try{
   const cookies=validCookies(await ses.cookies.get({}),p.domains);
   if(!manual){
    if(!p.auth.length||!p.auth.some(name=>cookies.some(c=>c.name===name&&c.value)))return;
    if(p.pageAuth){const authenticated=await current.webContents.executeJavaScript("(() => {const flag=window.__INITIAL_STATE__?.user?.loggedIn;return flag===true||flag?.value===true||flag?._value===true;})()").catch(()=>false);if(!authenticated)return;}
   }
   const value=serializeCookies(cookies,p.domains);
   if(!value){if(manual)await dialog.showMessageBox(current,{message:'还没有可保存的平台 Cookie',detail:'请先完成页面加载或登录后再试。'});return;}
   fs.writeFileSync(config,updateEnv(fs.readFileSync(config,'utf8'),p.key,value),'utf8');
   await ses.cookies.flushStore();await restartServer();done=true;
   if(process.env.MEDIAGET_LOGIN_PROBE)return;
   await dialog.showMessageBox(current,{type:'info',message:p.name+' 会话已保存并应用',detail:`已更新 ${p.key}。可以返回主界面解析；内容是否可解析仍取决于平台权限与风控。`,buttons:['返回解析']});
   if(!current.isDestroyed())current.close();
  }catch(e){
   done=true;if(!current.isDestroyed())await dialog.showMessageBox(current,{type:'error',message:'自动应用未完成',detail:'请关闭账号窗口后重试，或使用 env 配置入口。'+e.message});
  }finally{busy=false;}
 }
 current.setMenu(Menu.buildFromTemplate([{label:'保存当前会话',click:()=>capture(true)},{label:'重新加载',click:()=>loadLogin(current,p,ses)},{label:'关闭窗口',click:()=>current.close()}]));
 const changed=()=>{clearTimeout(timer);timer=setTimeout(()=>capture(false),1500);};
 ses.cookies.on('changed',changed);interval=setInterval(()=>capture(false),2500);current.webContents.on('did-finish-load',changed);
 current.on('closed',()=>{clearTimeout(timer);clearInterval(interval);ses.cookies.removeListener('changed',changed);if(loginWin===current)loginWin=null;});
 await loadLogin(current,p,ses);
}
async function start(){
 data=app.getPath('userData');fs.mkdirSync(data,{recursive:true});config=path.join(data,'settings.env');
 components=require('./components.cjs').createComponents(data);
 fs.writeFileSync(config,ensurePlatformEnv(fs.existsSync(config)?fs.readFileSync(config,'utf8'):'# 修改后重启生效；账号窗口保存后自动应用。Cookie 是登录凭据，请勿分享。\n'),'utf8');
 const downloads=createDownloads({app,session:session.defaultSession,dialog,shell,data,getWindow:()=>win,getYoutubeOptions:()=>({proxy:process.env.MEDIAGET_ACTIVE_PROXY,youtubeCookie:readEnv(config).YOUTUBE_COOKIE,tiktokCookie:readEnv(config).TIKTOK_COOKIE,instagramCookie:readEnv(config).IG_COOKIE})});
 const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 origin=`http://127.0.0.1:${port}`;
 server=app.isPackaged?path.join(process.resourcesPath,'server'):path.resolve(__dirname,'../.next/standalone');
 await launchServer();
 Menu.setApplicationMenu(Menu.buildFromTemplate([
 {label:'文件',submenu:[{label:'打开配置文件（Cookie）',click:()=>shell.openPath(config)},{label:'下载状态',click:()=>downloads.showProgress()},{label:'设置下载目录…',click:()=>downloads.choose()},{label:'打开下载目录',click:()=>downloads.open()},{type:'separator'},{role:'quit',label:'退出'}]},
 {label:'组件',submenu:[{label:'检查内置组件',click:async()=>{try{const version=await components.verify();await dialog.showMessageBox(win,{message:'内置组件可用',detail:'yt-dlp '+version.yt+'\n'+version.ffmpeg+'\nNode.js '+version.node+'\nTikTok：始终启用'});}catch(e){dialog.showErrorBox('组件检查失败',e.message);}}}]},
 {label:'账号',submenu:platforms.map(p=>({label:p.name+'（登录 / 保存会话）',click:()=>openLogin(p).catch(e=>dialog.showErrorBox('账号窗口打开失败',e.message))}))},
 {label:'编辑',submenu:[{role:'undo',label:'撤销'},{role:'redo',label:'重做'},{type:'separator'},{role:'cut',label:'剪切'},{role:'copy',label:'复制'},{role:'paste',label:'粘贴'},{role:'selectAll',label:'全选'}]},
 {label:'视图',submenu:[{role:'reload',label:'刷新'},{role:'resetZoom',label:'实际大小'},{role:'zoomIn',label:'放大'},{role:'zoomOut',label:'缩小'},{role:'togglefullscreen',label:'全屏'}]},
 {label:'帮助',submenu:[{label:'打开配置与日志目录',click:()=>shell.openPath(data)},{label:'项目源码',click:()=>shell.openExternal('https://github.com/hotier/MediaGet')},{label:'关于',click:()=>dialog.showMessageBox({message:'MediaGet Windows · 全平台账号版',detail:'基于 hotier/MediaGet 0.1.24（MIT）。'})}]}
 ]));
 session.defaultSession.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
 win=new BrowserWindow({icon:app.isPackaged?path.join(process.resourcesPath,'server','public','icon.png'):path.resolve(__dirname,'../public/icon.png'),width:1200,height:860,minWidth:800,minHeight:600,title:'MediaGet',backgroundColor:'#ffffff',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 function external(url){try{if(['https:','http:'].includes(new URL(url).protocol))shell.openExternal(url);}catch{}}
 win.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
 win.webContents.on('will-navigate',(e,url)=>{if(new URL(url).origin!==origin){e.preventDefault();external(url);}});
 win.once('ready-to-show',()=>win.show());await win.loadURL(origin);
}
