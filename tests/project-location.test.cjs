const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {ProjectLocation}=require('../electron/project-location.cjs');
test('last selected directory survives restart; deleted directories fall back to an existing ancestor',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-location-'));try{
  const project=path.join(tmp,'projects','design');fs.mkdirSync(project,{recursive:true});const file=path.join(tmp,'settings','location.json');
  const store=new ProjectLocation(file);assert.equal(store.read(),undefined);store.save(project);assert.equal(new ProjectLocation(file).read(),project);
  fs.rmdirSync(project);assert.equal(store.read(),path.dirname(project));fs.writeFileSync(file,'invalid json');assert.equal(store.read(),undefined);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
