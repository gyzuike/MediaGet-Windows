const path=require('node:path'),{execFile}=require('node:child_process');
function createComponents(){
 async function verify(){
  const tools=process.env.MEDIAGET_TOOLS_DIR||path.join(__dirname,'tools');
  const run=(name,args)=>new Promise((resolve,reject)=>execFile(path.join(tools,name),args,{windowsHide:true,timeout:20000,maxBuffer:512*1024},(e,out)=>e?reject(new Error('内置 '+name+' 无法运行。请使用完整的 EXE 重新启动；无需安装 Docker 或 Python。')):resolve(out.trim().split(/\r?\n/)[0])));
  const yt=await run('yt-dlp.exe',['--version']),ffmpeg=await run('ffmpeg.exe',['-version']);return {yt,ffmpeg,node:process.versions.node};
 }
 return {verify};
}
module.exports={createComponents};
