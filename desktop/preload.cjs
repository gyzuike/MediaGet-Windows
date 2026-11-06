const {ipcRenderer}=require('electron');
window.addEventListener('DOMContentLoaded',()=>{
 const host=document.createElement('div');host.id='mediaget-downloads';host.style.cssText='position:fixed;right:20px;bottom:20px;z-index:2147483647;width:360px;max-width:90vw;';
 const root=host.attachShadow({mode:'closed'});const style=document.createElement('style');style.textContent=':host{font:14px "Microsoft YaHei",sans-serif;color:#182334}.panel{background:#fff;border:1px solid #dbe3ef;border-radius:14px;box-shadow:0 8px 35px #0003;padding:16px;max-height:45vh;overflow:auto}header{display:flex;justify-content:space-between;font-weight:600;margin-bottom:8px}button{cursor:pointer;border:0;background:#eef2f7;border-radius:6px;padding:4px 8px;color:#304056}.row{padding:10px 0;border-top:1px solid #edf0f4}.name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:7px}progress{width:100%;height:8px;accent-color:#2563eb}.detail{font-size:12px;color:#56637a;margin-top:6px;display:flex;justify-content:space-between;gap:8px}';root.append(style);
 const panel=document.createElement('section');panel.className='panel';const header=document.createElement('header');header.textContent='下载状态';const hide=document.createElement('button');hide.textContent='收起';hide.onclick=()=>host.hidden=true;header.append(hide);panel.append(header);root.append(panel);host.hidden=true;document.body.append(host);
 const rows=new Map();const bytes=n=>n>=1073741824?(n/1073741824).toFixed(2)+' GB':n>=1048576?(n/1048576).toFixed(1)+' MB':(n/1024).toFixed(1)+' KB';
 ipcRenderer.on('mediaget-download-progress',(_e,t)=>{
  let row=rows.get(t.id);if(!row){host.hidden=false;row=document.createElement('div');row.className='row';row.append(document.createElement('div'),document.createElement('progress'),document.createElement('div'));row.children[0].className='name';row.children[2].className='detail';rows.set(t.id,row);panel.append(row);if(rows.size>12){const [id,old]=rows.entries().next().value;old.remove();rows.delete(id);}}
  row.children[0].textContent=t.name;const bar=row.children[1];bar.max=100;
  const done=t.state==='completed';if(t.total>0||done)bar.value=done?100:Math.min(99,t.received/t.total*100);else bar.removeAttribute('value');
  const label=t.state==='preparing'?'正在准备下载，等待服务器响应…':done?'下载完成':t.state==='merging'?(t.phase==='save'?'正在保存合并后的文件…':'正在合并视频和音频，请稍候…'):t.state==='cancelled'?'已取消':t.state==='interrupted'?(t.error||'下载中断，请重试'):`${t.phase==='audio'?'下载音频 · ':t.phase==='video'?'下载视频 · ':''}${t.total>0?Math.min(99,Math.floor(t.received/t.total*100))+'% · ':''}${bytes(t.received)}${t.total>0?' / '+bytes(t.total):''} · ${bytes(t.speed||0)}/秒`;
  row.children[2].replaceChildren(document.createTextNode(label));if(['downloading','merging'].includes(t.state)){const cancel=document.createElement('button');cancel.textContent='取消';cancel.onclick=()=>ipcRenderer.send('mediaget-cancel-download',t.id);row.children[2].append(cancel);}
  if(done&&t.canReveal){
   const reveal=document.createElement('button');reveal.title='打开所在文件夹并选中文件';reveal.setAttribute('aria-label','打开所在文件夹并选中文件');reveal.style.cssText='display:inline-flex;align-items:center;gap:5px;flex-shrink:0';
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','16');svg.setAttribute('height','16');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('aria-hidden','true');
   const icon=document.createElementNS('http://www.w3.org/2000/svg','path');icon.setAttribute('d','M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v2M3 7h6l2 3h10l-3 10H3V7Z');svg.append(icon);reveal.append(svg,document.createTextNode('打开文件夹'));
   reveal.onclick=()=>ipcRenderer.send('mediaget-reveal-download',t.id);row.children[2].append(reveal);
  }
 });
 ipcRenderer.on('mediaget-show-downloads',()=>host.hidden=false);
 document.addEventListener('click',event=>{const anchor=event.target.closest?.('a[href]');if(!anchor)return;try{const u=new URL(anchor.href);if(u.origin===location.origin&&['/api/video-proxy','/api/image'].includes(u.pathname)&&u.searchParams.get('download')==='1'){event.preventDefault();event.stopImmediatePropagation();ipcRenderer.send('mediaget-start-download',{url:u.href});}}catch{}},true);
});


