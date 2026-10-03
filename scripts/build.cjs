require('./validate.cjs');
const fs=require('node:fs');const path=require('node:path');const root=path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'dist/data'),{recursive:true});
for(const file of ['index.html','styles.css','app.js','data/journal.json'])fs.copyFileSync(path.join(root,file),path.join(root,'dist',file));
console.log('Built public files in dist/.');
