const fs=require('node:fs');
const {matchesHost,platforms}=require('./platforms.cjs');
function validCookies(cookies,domains=['xiaohongshu.com']){
 return cookies.filter(c=>matchesHost(c.domain.replace(/^\./,''),domains)&&(!c.expirationDate||c.expirationDate>Date.now()/1000)&&!/[;\r\n]/.test(c.name+c.value));
}
function serializeCookies(cookies,domains){return Array.from(validCookies(cookies,domains).sort((a,b)=>(a.path||'/').length-(b.path||'/').length).reduce((m,c)=>m.set(c.name,c.value),new Map()),([k,v])=>`${k}=${v}`).join('; ');}
function updateEnv(text,key,value){
 if(!/^[A-Z][A-Z0-9_]*$/.test(key)||/[\r\n]/.test(value))throw new Error('Cookie 格式无效');
 let found=false;
 const lines=text.split(/\r?\n/).filter(line=>{if(new RegExp(`^\\s*${key}\\s*=`).test(line)){if(found)return false;found=true;}return true;}).map(line=>new RegExp(`^\\s*${key}\\s*=`).test(line)?`${key}=${value}`:line);
 if(!found)lines.push(`${key}=${value}`);return lines.join('\n');
}
function readEnv(file){const env={};for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=(.*)$/);if(m){let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);env[m[1]]=v;}}return env;}
function ensurePlatformEnv(text){for(const p of [...platforms,{name:'TikTok',key:'TIKTOK_COOKIE'}]){if(!new RegExp(`^\\s*${p.key}\\s*=`, 'm').test(text))text+=`\n# ${p.name}：可由账号窗口保存，或手动填写\n${p.key}=\n`;}return text;}
module.exports={serializeCookies,validCookies,updateEnv,readEnv,ensurePlatformEnv};
