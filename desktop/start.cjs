const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),server=path.join(root,'.next','standalone');
if(!fs.existsSync(path.join(server,'server.js')))throw new Error('请先在项目根目录运行 npm run build。');
for(const [src,dst] of [[path.join(root,'public'),path.join(server,'public')],[path.join(root,'.next','static'),path.join(server,'.next','static')]])fs.cpSync(src,dst,{recursive:true});
let runtime=path.join(root,'.work','runtime-base','electron.exe');if(!fs.existsSync(runtime)){try{runtime=require('electron');}catch{throw new Error('请先运行桌面依赖安装，再执行 npm run desktop:runtime；也可先用 build:windows 的 -RuntimeFromExe 参数复用现有 EXE。');}}
const tools=fs.existsSync(path.join(root,'.work','runtime-base','resources','app','tools','yt-dlp.exe'))?path.join(root,'.work','runtime-base','resources','app','tools'):path.join(__dirname,'tools');
if(!fs.existsSync(path.join(tools,'yt-dlp.exe'))||!fs.existsSync(path.join(tools,'ffmpeg.exe')))throw new Error('请先使用 npm run build:windows 准备内置组件，或按构建说明放入 desktop/tools。');
const userData=path.join(root,'.work','dev-user-data');fs.mkdirSync(userData,{recursive:true});
const child=spawn(runtime,[__dirname],{stdio:'inherit',windowsHide:true,env:{...process.env,MEDIAGET_TOOLS_DIR:tools,MEDIAGET_TEST_DATA:process.env.MEDIAGET_TEST_DATA||userData}});child.on('exit',code=>process.exitCode=code||0);
