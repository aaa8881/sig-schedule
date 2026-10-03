const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'data/journal.json'),'utf8'));
const arrays=['categories','projects','tasks','routines','entries','thoughts'];
for(const key of arrays){assert(Array.isArray(data[key]),`${key} must be an array`);const ids=data[key].map(x=>x.id);assert.equal(new Set(ids).size,ids.length,`${key}: duplicate ID`);}
const has=(key,id)=>data[key].some(x=>x.id===id);
const date=value=>assert(/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value,`Invalid date: ${value}`);
assert.equal(data.schemaVersion,1);
for(const project of data.projects){assert(has('categories',project.categoryId),'Unknown category');assert(Array.isArray(project.groups)&&Array.isArray(project.notes));assert.equal(new Set(project.groups.map(g=>g.id)).size,project.groups.length);for(const group of project.groups)assert(['version','initiative'].includes(group.type));for(const note of project.notes){date(note.date);assert.equal(typeof note.body,'string');}}
for(const task of data.tasks){assert(has('projects',task.projectId),'Unknown task project');assert(['todo','doing','done'].includes(task.status));date(task.createdAt);assert.equal(typeof task.title,'string');if(task.groupId)assert(data.projects.find(p=>p.id===task.projectId).groups.some(g=>g.id===task.groupId),'Unknown group');if(task.status==='done')date(task.completedAt);}
for(const routine of data.routines){assert(has('categories',routine.categoryId));assert.equal(routine.frequency,'daily');date(routine.startDate);assert.equal(new Set(routine.checkins.map(c=>c.date)).size,routine.checkins.length,'Duplicate routine date');for(const check of routine.checkins){date(check.date);assert(check.date>=routine.startDate);}}
for(const entry of data.entries){date(entry.date);assert(['plan','activity'].includes(entry.kind));assert(entry.source,'Original input required');for(const id of entry.projectIds)assert(has('projects',id));for(const id of entry.taskIds||[])assert(has('tasks',id));}
for(const thought of data.thoughts){date(thought.date);assert.equal(typeof thought.body,'string');if(thought.projectId)assert(has('projects',thought.projectId));}
for(const file of ['index.html','styles.css','app.js'])assert(fs.statSync(path.join(root,file)).size>0);
console.log(`Valid: ${data.projects.length} projects, ${data.tasks.length} tasks, ${data.entries.length} entries, ${data.routines.length} routines.`);
