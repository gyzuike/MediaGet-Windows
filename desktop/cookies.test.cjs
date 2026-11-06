const {test}=require('node:test');const assert=require('node:assert/strict');
const {serializeCookies,updateEnv}=require('./cookies.cjs');
test('only includes valid Xiaohongshu cookies',()=>assert.equal(serializeCookies([{domain:'.xiaohongshu.com',name:'web_session',value:'example'},{domain:'evilxiaohongshu.com',name:'bad',value:'x'},{domain:'www.xiaohongshu.com',name:'expired',value:'x',expirationDate:1},{domain:'.xiaohongshu.com',name:'inject',value:'x\nY=z'}]),'web_session=example'));
test('updates XHS only and removes duplicate definitions',()=>assert.equal(updateEnv('# note\r\nDOUYIN_COOKIE=keep\r\nXHS_COOKIE=old\r\nOTHER=abc\r\nXHS_COOKIE=old2','XHS_COOKIE','web_session=new'),'# note\nDOUYIN_COOKIE=keep\nXHS_COOKIE=web_session=new\nOTHER=abc'));
test('supports env without XHS definition',()=>assert.equal(updateEnv('DOUYIN_COOKIE=keep','XHS_COOKIE','a=b'),'DOUYIN_COOKIE=keep\nXHS_COOKIE=a=b'));
test('rejects multiline cookie injection',()=>assert.throws(()=>updateEnv('','XHS_COOKIE','a=b\nOTHER=x')));
