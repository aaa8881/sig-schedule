'use strict';
let journal;
let categoryFilter = 'all';
let recordProject = 'all';
let recordDate = '';
const app = document.getElementById('app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const statusNames = {todo:'할 일',doing:'진행 중',done:'완료'};
const seoulDate = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const displayDate = value => new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Seoul'}).format(new Date(value+'T12:00:00+09:00'));
const categoryName = id => journal.categories.find(item=>item.id===id)?.name || '';
const projectTasks = id => journal.tasks.filter(task=>task.projectId===id);
function heading(eyebrow,title,subtitle){return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${esc(title)}</h1><p class="subtitle">${esc(subtitle)}</p></div><span class="date-box">${displayDate(seoulDate())}</span></div>`;}
function taskRows(tasks){return `<div class="task-list">${tasks.map(task=>`<div class="task-row"><span class="task-state ${task.status}" aria-hidden="true"></span><span class="task-title">${esc(task.title)}</span><span class="badge ${task.status}">${statusNames[task.status]}</span></div>`).join('')}</div>`;}
function projectCard(project,detailed=false){
  const tasks=projectTasks(project.id), done=tasks.filter(t=>t.status==='done').length;
  const state=tasks.length&&done===tasks.length?'done':tasks.some(t=>t.status==='doing')?'doing':'todo';
  const groups = project.groups.map(group=>{
    const groupTasks=tasks.filter(t=>t.groupId===group.id);
    return detailed||groupTasks.length?`<div class="group-heading">${group.type==='version'?'버전 · ':''}${esc(group.name)}</div>${taskRows(groupTasks)}${!groupTasks.length?'<p class="empty-inline">등록된 할 일이 없습니다.</p>':''}`:'';
  }).join('');
  const miscellaneous=tasks.filter(t=>!t.groupId);
  return `<article class="project-card"><div class="project-head"><a class="project-id" href="#project/${encodeURIComponent(project.id)}"><span class="project-icon ${esc(project.id)}">${project.id==='beartown'?'B':'M'}</span><div><div class="category-label">${esc(categoryName(project.categoryId))}</div><h2>${esc(project.name)}</h2></div></a><span class="badge ${state}">${statusNames[state]}</span></div><p class="project-description">${esc(project.description)}</p><div class="progress-meta"><span>등록한 할 일 기준</span><span>${done} / ${tasks.length} 완료</span></div><div class="progress-track" role="progressbar" aria-label="${esc(project.name)} 등록한 할 일 완료율" aria-valuenow="${tasks.length?Math.round(done/tasks.length*100):0}" aria-valuemin="0" aria-valuemax="100"><span style="width:${tasks.length?done/tasks.length*100:0}%"></span></div>${groups}${miscellaneous.length?'<div class="group-heading">기타 작업</div>'+taskRows(miscellaneous):''}${detailed?`<div class="notes"><h3>기타사항</h3>${project.notes.length?project.notes.map(note=>`<p><time>${esc(note.date)}</time> · ${esc(note.body)}</p>`).join(''):'<p class="empty-inline">작은 버그 수정, 오타, 작업 중 메모를 모아둘 공간입니다.<br>아직 등록된 기타사항은 없습니다.</p>'}</div>`:''}</article>`;
}
function routineCard(routine){
  const today=seoulDate(); const anchor=new Date(today+'T12:00:00Z');
  const weekday=(anchor.getUTCDay()+6)%7; anchor.setUTCDate(anchor.getUTCDate()-weekday);
  const dates=Array.from({length:7},(_,i)=>{const date=new Date(anchor);date.setUTCDate(date.getUTCDate()+i);return date.toISOString().slice(0,10);});
  const hits=dates.filter(date=>routine.checkins.some(check=>check.date===date));
  return `<section class="panel"><div class="section-header"><h2>꾸준히 하기</h2><span class="badge">매일</span></div><div class="routine-name">${esc(routine.title)}</div><p class="routine-sub">${esc(categoryName(routine.categoryId))} · 하루 한 번</p><div class="week">${dates.map((date,i)=>`<div class="week-day">${['월','화','수','목','금','토','일'][i]}<span class="day-circle ${hits.includes(date)?'checked':date===today?'current':''}" title="${date}: ${hits.includes(date)?'달성':'기록 없음'}">${hits.includes(date)?'✓':Number(date.slice(-2))}</span></div>`).join('')}</div><div class="routine-foot">이번 주 ${hits.length}회 달성<br>${routine.checkins.some(check=>check.date===today)?'오늘의 목표를 달성했어요.':'오늘은 아직 운동 기록이 없어요.'}</div></section>`;
}
function entryCard(entry){return `<article class="entry"><div class="entry-header"><span class="badge ${entry.kind==='plan'?'plan':'done'}">${entry.kind==='plan'?'계획':'활동'}</span><h3>${esc(entry.title)}</h3><time>${esc(entry.date)}</time></div><p>${esc(entry.body)}</p></article>`;}
function empty(title,body,symbol='◇'){return `<div class="empty-state"><div class="empty-symbol" aria-hidden="true">${symbol}</div><h2>${esc(title)}</h2><p>${esc(body)}</p></div>`;}
function todayView(){
  const today=seoulDate();const done=journal.tasks.filter(t=>t.status==='done').length;
  const entries=journal.entries.filter(e=>e.date===today);
  return heading('MY DAILY LOG','오늘의 흐름','진행 중인 작업과 매일의 작은 목표를 한눈에.')+`<div class="stats"><div class="stat"><div class="stat-label">프로젝트</div><div class="stat-value">${journal.projects.length}<small>개</small></div></div><div class="stat"><div class="stat-label">진행 중인 할 일</div><div class="stat-value">${journal.tasks.filter(t=>t.status==='doing').length}<small>개</small></div></div><div class="stat"><div class="stat-label">다음 할 일</div><div class="stat-value">${journal.tasks.filter(t=>t.status==='todo').length}<small>개</small></div></div><div class="stat"><div class="stat-label">완료한 할 일</div><div class="stat-value">${done}<small>개</small></div></div></div><div class="workspace"><section><div class="section-header"><h2>이어가는 프로젝트</h2><a class="text-link" href="#projects">전체 보기</a></div><div class="project-list">${journal.projects.map(p=>projectCard(p)).join('')}</div></section><div class="right-column">${journal.routines.map(routineCard).join('')}<section class="panel"><div class="section-header"><h2>생각 한 조각</h2><span aria-hidden="true">◇</span></div>${journal.thoughts.length?`<p class="thought-empty">${esc(journal.thoughts.at(-1).body)}</p>`:'<p class="thought-empty">아직 모아둔 생각이 없어요.<br>문득 떠오른 아이디어도<br>여기에 차곡차곡.</p>'}<a class="text-link" href="#thoughts">생각 모음 보기</a></section></div></div><section class="activity"><div class="section-header"><h2>오늘의 기록</h2><a class="text-link" href="#records">날짜별로 보기</a></div><div class="panel">${entries.length?entries.map(entryCard).join(''):'<p class="empty-inline">오늘의 활동 기록은 아직 없습니다.</p>'}</div></section>`;
}
function projectsView(){const projects=journal.projects.filter(p=>categoryFilter==='all'||p.categoryId===categoryFilter);const routines=journal.routines.filter(r=>categoryFilter==='all'||r.categoryId===categoryFilter);return heading('PROJECTS','프로젝트','큰 목표 안에서 작은 작업을 이어갑니다.')+`<div class="filters" aria-label="카테고리">${[{id:'all',name:'전체'},...journal.categories].map(c=>`<button class="filter ${categoryFilter===c.id?'selected':''}" data-category="${c.id}" aria-pressed="${categoryFilter===c.id}">${esc(c.name)}</button>`).join('')}</div><div class="projects-grid">${projects.map(p=>projectCard(p,true)).join('')}${routines.map(routineCard).join('')}</div>${!projects.length&&!routines.length?empty('아직 시작한 프로젝트가 없어요','새로운 목표가 생기면 이곳에 모아둘게요.','▦'):''}`;}
function recordsView(){const entries=journal.entries.filter(e=>(recordProject==='all'||e.projectIds.includes(recordProject))&&(!recordDate||e.date===recordDate));const dates=[...new Set(entries.map(e=>e.date))].sort().reverse();return heading('TIMELINE','날짜별 기록','어떤 작업을 어떻게 이어왔는지 돌아보는 공간.')+`<div class="records-controls"><label>프로젝트<select id="record-project"><option value="all">전체 프로젝트</option>${journal.projects.map(p=>`<option value="${p.id}" ${recordProject===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><label>날짜<input type="date" id="record-date" value="${esc(recordDate)}"></label>${recordDate?'<button class="filter" id="clear-date">날짜 초기화</button>':''}</div>${dates.length?dates.map(date=>`<section class="timeline-day"><h2>${displayDate(date)} <span class="small-label">${date.slice(0,4)}</span></h2><div class="panel">${entries.filter(e=>e.date===date).map(entryCard).join('')}</div></section>`).join(''):empty('이 조건에 맞는 기록이 없어요','다른 날짜나 프로젝트를 선택해 보세요.','◷')}`;}
function thoughtsView(){return heading('COLLECTION','생각 모음','아이디어, 메모, 오래 기억하고 싶은 문장들.')+(journal.thoughts.length?`<div class="projects-grid">${journal.thoughts.map(t=>`<article class="thought-card"><span class="badge">${esc(t.type||'생각')}</span><p>${esc(t.body)}</p><time>${esc(t.date)}</time>${t.tags?.length?`<p class="empty-inline">${t.tags.map(tag=>'#'+esc(tag)).join(' ')}</p>`:''}</article>`).join('')}</div>`:empty('첫 생각을 기다리고 있어요','떠오른 아이디어나 기억하고 싶은 말을 편하게 이야기해 주세요.'));}
function render(){
  if(!journal)return;
  const hash=location.hash.slice(1)||'today';const [route,id]=hash.split('/');
  const current=['today','projects','records','thoughts'].includes(route)?route:route==='project'?'projects':'today';
  document.querySelectorAll('[data-view]').forEach(a=>{a.classList.toggle('active',a.dataset.view===current);if(a.dataset.view===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  const labels={today:'오늘',projects:'프로젝트',records:'날짜별 기록',thoughts:'생각 모음'};
  document.getElementById('breadcrumb').textContent='나의 작업 공간 / '+labels[current];
  if(route==='project'){
    const project=journal.projects.find(p=>p.id===decodeURIComponent(id||''));
    app.innerHTML=project?`<a class="back-link" href="#projects">프로젝트 목록</a>`+heading(categoryName(project.categoryId),project.name,project.description)+`<div class="project-detail">${projectCard(project,true)}<div class="section-header"><h2>이 프로젝트의 기록</h2></div><div class="panel">${journal.entries.filter(e=>e.projectIds.includes(project.id)).sort((a,b)=>b.date.localeCompare(a.date)).map(entryCard).join('')||'<p class="empty-inline">아직 활동 기록이 없습니다.</p>'}</div></div>`:empty('프로젝트를 찾을 수 없어요','프로젝트 목록에서 다시 선택해 주세요.');
  }else app.innerHTML=({today:todayView,projects:projectsView,records:recordsView,thoughts:thoughtsView}[current])();
  document.title=(route==='project'?journal.projects.find(p=>p.id===id)?.name||'프로젝트':labels[current])+' · '+journal.site.name;
}
document.addEventListener('click',event=>{const button=event.target.closest('[data-category]');if(button){categoryFilter=button.dataset.category;render();}if(event.target.closest('#clear-date')){recordDate='';render();}});
document.addEventListener('change',event=>{if(event.target.id==='record-project'){recordProject=event.target.value;render();}if(event.target.id==='record-date'){recordDate=event.target.value;render();}});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
fetch('./data/journal.json',{cache:'no-cache'}).then(response=>{if(!response.ok)throw Error('HTTP '+response.status);return response.json();}).then(data=>{journal=data;document.getElementById('updated').textContent='최근 기록 '+[...journal.entries.map(e=>e.date),...journal.tasks.map(t=>t.createdAt),...journal.thoughts.map(t=>t.date),...journal.routines.flatMap(r=>r.checkins.map(c=>c.date))].sort().at(-1);render();}).catch(()=>{app.innerHTML='<div class="error"><h2>기록을 불러오지 못했어요.</h2><p>잠시 후 새로고침해 주세요. 로컬에서는 미리보기 서버로 열어야 합니다.</p></div>';});
