const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildPreview,validatePayload}=require('./discord-diary.cjs');
function fixture(){return {projects:[{id:'work',name:'베어타운'}],tasks:[{id:'hopper',projectId:'work',title:'Upgradable Hopper 업데이트',status:'done',createdAt:'2026-10-03',completedAt:'2026-10-04'}],entries:[{id:'activity',date:'2026-10-04',kind:'activity',body:'호퍼 업데이트 완료. @everyone 알림 없이 정리.',projectIds:['work'],taskIds:['hopper']}],routines:[],thoughts:[]};}
test('Plan-only input does not become performed work',()=>{const data=fixture();data.tasks[0].status='doing';data.entries[0].kind='plan';const preview=buildPreview(data,'2026-10-04');assert.equal(preview.hasActivity,false);assert.equal(preview.payload.embeds[0].fields.length,0);});
test('Actual activity is grouped once and mentions are disabled',()=>{const preview=buildPreview(fixture(),'2026-10-04');assert.equal(preview.hasActivity,true);assert.equal(preview.payload.embeds[0].fields.length,1);assert.deepEqual(preview.payload.allowed_mentions,{parse:[]});assert(!preview.payload.embeds[0].fields[0].value.includes('완료: Upgradable'),'Duplicate completion line');});
test('Discord length limits reject oversized diaries instead of silently cutting them',()=>{const data=fixture();data.entries[0].body='긴 작업 내용 '.repeat(1500);assert.throws(()=>buildPreview(data,'2026-10-04'),/일지가 너무/);const preview=buildPreview(fixture(),'2026-10-04');preview.payload.allowed_mentions={parse:['everyone']};assert.throws(()=>validatePayload(preview.payload),/Mention/);});
test('Trial approval, recurring opt-in, duplicate prevention, updates, stale preview, uncertain send',async()=>{
  const base=path.resolve(__dirname,'..','.local');fs.mkdirSync(base,{recursive:true});
  const temp=fs.mkdtempSync(path.join(base,'discord-test-'));fs.mkdirSync(path.join(temp,'scripts'));fs.mkdirSync(path.join(temp,'data'));
  fs.copyFileSync(path.join(__dirname,'discord-diary.cjs'),path.join(temp,'scripts','discord-diary.cjs'));
  const writeData=data=>fs.writeFileSync(path.join(temp,'data','journal.json'),JSON.stringify(data));
  const data=fixture();writeData(data);
  fs.writeFileSync(path.join(temp,'.env.discord'),'DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789/TEST_ONLY_NOT_REAL\n');
  const {main}=require(path.join(temp,'scripts','discord-diary.cjs'));
  const savedFetch=global.fetch,savedLog=console.log;const calls=[];
  global.fetch=async(url,opts)=>{calls.push({url:String(url),opts});return {ok:true,status:200,json:async()=>({id:'987654321'})};};console.log=()=>{};
  const readPreview=()=>JSON.parse(fs.readFileSync(path.join(temp,'.local/discord/2026-10-04.preview.json'),'utf8'));
  const readState=()=>JSON.parse(fs.readFileSync(path.join(temp,'.local/discord/state.json'),'utf8'));
  try{
    await main(['--preview','--date','2026-10-04']);
    await assert.rejects(main(['--send','--date','2026-10-04']),/승인 전/);assert.equal(calls.length,0);
    await assert.rejects(main(['--approve-auto']),/시험 전송 성공/);
    const approved=readPreview().payloadHash;
    await main(['--send','--date','2026-10-04','--approve-first',approved]);assert.equal(calls.length,1);assert(calls[0].url.endsWith('?wait=true'));assert.equal(calls[0].opts.method,'POST');assert.equal(readState().autoTarget,null);
    await main(['--send','--date','2026-10-04','--approve-first',approved]);assert.equal(calls.length,1);
    await main(['--approve-auto']);assert(readState().autoTarget);
    data.entries[0].body+=' 설명 오타 수정도 완료.';writeData(data);
    await assert.rejects(main(['--send','--date','2026-10-04']),/기록이 바뀌었습니다/);
    await main(['--preview','--date','2026-10-04']);await main(['--send','--date','2026-10-04']);assert.equal(calls.length,2);assert.equal(calls[1].opts.method,'PATCH');assert(calls[1].url.includes('/messages/987654321'));
    data.entries[0].body+=' 추가 변경.';writeData(data);await main(['--preview','--date','2026-10-04']);
    global.fetch=async()=>{throw Error('network failed');};
    await assert.rejects(main(['--send','--date','2026-10-04']),/응답을 확인하지/);
    await assert.rejects(main(['--send','--date','2026-10-04']),/불확실/);
    await main(['--disable-auto']);assert.equal(readState().autoTarget,null);
  }finally{global.fetch=savedFetch;console.log=savedLog;}
});
