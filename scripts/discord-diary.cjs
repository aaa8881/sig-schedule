'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const local=path.join(root,'.local','discord');
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const read=(file,fallback)=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):fallback;
const save=(file,data)=>{fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(data,null,2)+'\n');fs.renameSync(temp,file);};
const dateToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function validDate(date){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;}
const plain=value=>String(value||'').replace(/([\\*_`~|\[\]])/g,'\\$1').replace(/\r/g,'');
function chunks(text,size){const result=[];let rest=text;while(rest.length>size){let cut=rest.lastIndexOf('\n',size);if(cut<size/2)cut=size;if(/[\uD800-\uDBFF]/.test(rest[cut-1]))cut--;result.push(rest.slice(0,cut));rest=rest.slice(cut).replace(/^\n/,'');}if(rest)result.push(rest);return result;}
function validatePayload(payload){
  if(payload.content?.length>2000||!payload.embeds?.length||payload.embeds.length>10)throw Error('Discord payload limit exceeded.');
  let total=0;
  for(const embed of payload.embeds){if(embed.title.length>256||embed.description.length>4096||embed.fields.length>25)throw Error('일지가 너무 깁니다. 요약을 줄여 다시 미리보기를 만들어 주세요.');total+=embed.title.length+embed.description.length+(embed.footer?.text.length||0);for(const field of embed.fields){if(!field.name.length||field.name.length>256||!field.value.length||field.value.length>1024)throw Error('Discord field limit exceeded.');total+=field.name.length+field.value.length;}}
  if(total>6000)throw Error('일지가 너무 깁니다. 6,000자 안으로 요약해 주세요.');
  if(JSON.stringify(payload.allowed_mentions)!==JSON.stringify({parse:[]}))throw Error('Mention suppression required.');
}
function buildPreview(journal,date){
  const activities=journal.entries.filter(e=>e.date===date&&e.kind==='activity');
  const completed=journal.tasks.filter(t=>t.status==='done'&&t.completedAt===date);
  const checkins=journal.routines.filter(r=>r.checkins.some(c=>c.date===date));
  const thoughts=journal.thoughts.filter(t=>t.date===date);
  const next=journal.tasks.filter(t=>t.status==='todo'&&(t.createdAt===date||activities.some(e=>e.taskIds?.includes(t.id))));
  const fields=[];
  function add(name,text){chunks(text,1024).forEach((part,index)=>fields.push({name:plain(name)+(index?' · 계속 '+(index+1):''),value:part,inline:false}));}
  for(const project of journal.projects){const items=activities.filter(e=>e.projectIds.includes(project.id));const tasks=completed.filter(t=>t.projectId===project.id);if(items.length||tasks.length){add(project.name,[...items.map(e=>'• '+plain(e.body)),...tasks.filter(t=>!items.some(e=>e.taskIds?.includes(t.id))).map(t=>'• 완료: '+plain(t.title))].join('\n'));}}
  const general=activities.filter(e=>!e.projectIds.length);if(general.length)add('기타 작업',general.map(e=>'• '+plain(e.body)).join('\n'));
  if(checkins.length)add('운동 · 반복 목표',checkins.map(r=>'• '+plain(r.title)+' 달성').join('\n'));
  if(thoughts.length)add('생각 · 메모',thoughts.map(t=>'• '+plain(t.body)).join('\n'));
  if(next.length)add('다음 할 일',next.map(t=>'• '+plain(journal.projects.find(p=>p.id===t.projectId)?.name)+': '+plain(t.title)).join('\n'));
  const hasActivity=Boolean(activities.length||completed.length||checkins.length||thoughts.length);
  const payload={username:'시그일정',allowed_mentions:{parse:[]},embeds:[{title:date+' 작업일지',description:hasActivity?'오늘의 작업과 다음 할 일을 정리했습니다.':'미리보기: 실제 활동 기록이 아직 없습니다. 아래 내용은 계획이며 전송하지 않습니다.',color:2839784,fields,footer:{text:'시그일정 · Asia/Seoul'}}]};
  validatePayload(payload);
  return {date,hasActivity,payload};
}
function settings(){
  const filename=path.join(root,'.env.discord');const env={};
  if(fs.existsSync(filename))for(const line of fs.readFileSync(filename,'utf8').split(/\r?\n/)){const match=line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(match){let value=match[2];if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);env[match[1]]=value;}}
  const raw=process.env.DISCORD_WEBHOOK_URL||env.DISCORD_WEBHOOK_URL;
  if(!raw)throw Error('웹훅 주소가 없습니다. 로컬 .env.discord에 DISCORD_WEBHOOK_URL을 설정해 주세요.');
  let url;try{url=new URL(raw);}catch{throw Error('웹훅 주소 형식이 올바르지 않습니다.');}
  if(url.protocol!=='https:'||url.hostname!=='discord.com'||url.port||url.username||url.password||url.hash||!/^\/api(?:\/v\d+)?\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url.pathname))throw Error('공식 Discord HTTPS 웹훅 주소만 사용할 수 있습니다.');
  for(const key of url.searchParams.keys())if(key!=='thread_id'&&key!=='wait')throw Error('웹훅 URL에 지원하지 않는 옵션이 있습니다.');
  const thread=process.env.DISCORD_THREAD_ID||env.DISCORD_THREAD_ID||url.searchParams.get('thread_id');
  if(thread&&!/^\d+$/.test(thread))throw Error('Discord 스레드 ID는 숫자여야 합니다.');
  url.search='';if(thread)url.searchParams.set('thread_id',thread);
  const target=hash(url.href);url.searchParams.set('wait','true');
  return {url,target};
}
async function main(args){
  const option=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
  const date=option('--date')||dateToday();if(!validDate(date))throw Error('날짜는 YYYY-MM-DD로 지정해 주세요.');
  const previewFile=path.join(local,date+'.preview.json');const stateFile=path.join(local,'state.json');
  const journalFile=path.join(root,'data','journal.json');
  const journalText=fs.readFileSync(journalFile,'utf8');const journal=JSON.parse(journalText);
  if(args.includes('--preview')){const preview=buildPreview(journal,date);preview.journalHash=hash(journalText);preview.payloadHash=hash(JSON.stringify(preview.payload));save(previewFile,preview);console.log(JSON.stringify({date,hasActivity:preview.hasActivity,approvalHash:preview.payloadHash,...(args.includes('--quiet')?{}:{payload:preview.payload})},null,2));return;}
  if(args.includes('--status')){const state=read(stateFile,{autoTarget:null,deliveries:{}});console.log(JSON.stringify({automaticEnabled:Boolean(state.autoTarget),deliveries:Object.entries(state.deliveries).map(([key,v])=>({date:key.split(':')[0],status:v.status,messageId:v.messageId||null}))},null,2));return;}
  if(args.includes('--disable-auto')){const state=read(stateFile,{autoTarget:null,deliveries:{}});state.autoTarget=null;save(stateFile,state);console.log('Automatic diary sending disabled.');return;}
  if(!args.includes('--send')&&!args.includes('--approve-auto'))throw Error('사용법: --preview | --send [--approve-first SHA256] | --approve-auto | --disable-auto | --status, 선택: --date YYYY-MM-DD');
  const {url,target}=settings();const state=read(stateFile,{autoTarget:null,deliveries:{}});
  if(args.includes('--approve-auto')){if(!Object.entries(state.deliveries).some(([key,v])=>key.endsWith(':'+target)&&v.status==='sent'))throw Error('시험 전송 성공과 사용자 확인 후에만 자동 전송을 활성화할 수 있습니다.');state.autoTarget=target;save(stateFile,state);console.log('Automatic sending enabled for this webhook, only when the user closes the day.');return;}
  const preview=read(previewFile,null);if(!preview)throw Error('먼저 일지 미리보기를 생성해 주세요.');
  if(hash(journalText)!==preview.journalHash)throw Error('미리보기 이후 기록이 바뀌었습니다. 다시 미리보기와 필요한 확인을 진행해 주세요.');
  const payloadHash=hash(JSON.stringify(preview.payload));if(payloadHash!==preview.payloadHash)throw Error('미리보기 파일이 변경되었습니다. 다시 생성해 주세요.');
  validatePayload(preview.payload);if(!preview.hasActivity)throw Error('실제 활동 기록이 없어 전송하지 않습니다.');
  if(state.autoTarget!==target&&option('--approve-first')!==payloadHash)throw Error('아직 자동 전송 승인 전입니다. 사용자에게 일지와 전송 대상 확인을 받은 후 승인된 미리보기 해시를 지정해 주세요.');
  const key=date+':'+target;const previous=state.deliveries[key];
  if(previous?.status==='sent'&&previous.payloadHash===payloadHash){console.log('Already sent; duplicate skipped.');return;}
  if(previous&&['pending','uncertain'].includes(previous.status))throw Error('이전 전송 성공 여부가 불확실합니다. 채널에서 확인하기 전에는 중복 전송하지 않습니다.');
  const messageId=previous?.messageId;
  if(messageId){url.pathname+='/messages/'+messageId;url.searchParams.delete('wait');}
  state.deliveries[key]={...previous,status:'pending',payloadHash};save(stateFile,state);
  let response;try{response=await fetch(url,{method:messageId?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(preview.payload),redirect:'error',signal:AbortSignal.timeout(20000)});}catch{state.deliveries[key]={...state.deliveries[key],status:'uncertain'};save(stateFile,state);throw Error('전송 응답을 확인하지 못했습니다. 채널을 확인한 뒤 재시도 여부를 결정해 주세요.');}
  if(!response.ok){state.deliveries[key].status=response.status>=500?'uncertain':'failed';save(stateFile,state);if(response.status===429){const retry=Number(response.headers.get('retry-after'));throw Error('Discord 전송 제한입니다.'+(Number.isFinite(retry)?' '+retry+'초 후 다시 시도해 주세요.':''));}throw Error('Discord 전송 실패: HTTP '+response.status);}
  let message;try{message=await response.json();}catch{}
  if(!message?.id){state.deliveries[key].status='uncertain';save(stateFile,state);throw Error('메시지 ID를 확인하지 못했습니다. 채널에서 전송 여부를 확인해 주세요.');}
  state.deliveries[key]={status:'sent',payloadHash,messageId:message.id,sentAt:new Date().toISOString()};save(stateFile,state);
  console.log(JSON.stringify({status:messageId?'updated':'sent',date,messageId:message.id}));
}
module.exports={buildPreview,validatePayload,main};
if(require.main===module)main(process.argv.slice(2)).catch(error=>{console.error(error.message);process.exitCode=1;});
