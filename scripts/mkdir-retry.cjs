const fs=require('fs');
const wait=()=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,30);
const sync=fs.mkdirSync, async=fs.mkdir, promise=fs.promises.mkdir;
fs.mkdirSync=function(...args){for(let i=0;;i++){try{return sync.apply(fs,args);}catch(e){if(e.code!=='EPERM'||i>100)throw e;wait();}}};
fs.mkdir=function(p,o,cb){if(typeof o==='function'){cb=o;o=undefined;}let n=0;function go(){async.call(fs,p,o,(e,r)=>{if(e&&e.code==='EPERM'&&n++<100)setTimeout(go,30);else cb(e,r);});}go();};
fs.promises.mkdir=async function(...args){for(let i=0;;i++){try{return await promise.apply(fs.promises,args);}catch(e){if(e.code!=='EPERM'||i>100)throw e;await new Promise(r=>setTimeout(r,30));}}};
