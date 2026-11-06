const platforms=[
 {id:'douyin',name:'抖音',key:'DOUYIN_COOKIE',url:'https://www.douyin.com/',domains:['douyin.com'],auth:['sessionid','sessionid_ss']},
 {id:'bilibili',name:'哔哩哔哩',key:'BILIBILI_COOKIE',url:'https://www.bilibili.com/',domains:['bilibili.com'],auth:['SESSDATA']},
 {id:'kuaishou',name:'快手',key:'KUAISHOU_COOKIE',url:'https://www.kuaishou.com/',domains:['kuaishou.com'],auth:['kuaishou.server.web_st']},
 {id:'weibo',name:'微博',key:'WEIBO_COOKIE',url:'https://weibo.com/',domains:['weibo.com','weibo.cn'],auth:[]},
 {id:'xhs',name:'小红书',key:'XHS_COOKIE',url:'https://www.xiaohongshu.com/explore',domains:['xiaohongshu.com'],auth:['web_session'],pageAuth:true},
 {id:'qsmusic',name:'汽水音乐',key:'QSMUSIC_COOKIE',url:'https://music.douyin.com/',domains:['music.douyin.com'],auth:[]},
 {id:'xigua',name:'西瓜视频',key:'XIGUA_COOKIE',url:'https://www.ixigua.com/',domains:['ixigua.com'],auth:['sessionid','sessionid_ss']},
 {id:'zuiyou',name:'最右',key:'ZUIYOU_COOKIE',url:'https://www.izuiyou.com/',domains:['izuiyou.com','xiaochuankeji.cn'],auth:[]},
 {id:'acfun',name:'AcFun',key:'ACFUN_COOKIE',url:'https://www.acfun.cn/',domains:['acfun.cn'],auth:['acPasstoken']},
 {id:'twitter',name:'X (Twitter)',key:'TWITTER_COOKIE',url:'https://x.com/i/flow/login',domains:['x.com','twitter.com'],auth:['auth_token']},
 {id:'instagram',name:'Instagram',key:'IG_COOKIE',url:'https://www.instagram.com/accounts/login/',domains:['instagram.com'],auth:['sessionid']},
 {id:'youtube',name:'YouTube',key:'YOUTUBE_COOKIE',url:'https://www.youtube.com/',domains:['youtube.com'],navigationDomains:['accounts.google.com','accounts.youtube.com','consent.google.com','consent.youtube.com'],auth:['SAPISID','__Secure-3PAPISID']}
];
function matchesHost(host,domains){return domains.some(d=>host===d||host.endsWith('.'+d));}
function allowedNavigation(url,p){try{const u=new URL(url);return u.protocol==='https:'&&(matchesHost(u.hostname,p.domains)||p.navigationDomains?.includes(u.hostname));}catch{return false;}}
module.exports={platforms,matchesHost,allowedNavigation};
