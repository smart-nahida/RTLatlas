const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const {parseProject}=require('../electron/project.cjs');
test('desktop process bridge parses real project with elaborated instances',async()=>{const p=await parseProject(path.join(__dirname,'..','examples','vector_accelerator'));assert.equal(p.roots[0],'top');assert.ok(p.instances['top.u_accelerator.g_core[2].u_core.u_accumulator']);assert.match(p.files['design.sv'],/always_ff/);});
test('missing folder fails with parser diagnostic',async()=>{await assert.rejects(parseProject('/no/such/project'),/不存在|does not exist/);});
const fs=require('node:fs/promises');const os=require('node:os');
test('manifest choices cross the parser bridge and a selected manifest actually loads',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-choice-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.writeFile(path.join(root,'a.f'),'first.sv');await fs.writeFile(path.join(root,'b.f'),'second.sv');
 await fs.writeFile(path.join(root,'first.sv'),'module first;endmodule');await fs.writeFile(path.join(root,'second.sv'),'module second;endmodule');
 await assert.rejects(parseProject(root),e=>{assert.deepEqual(e.choices.map(c=>c.label),['a.f','b.f']);return true;});
 const selected=await parseProject(root,{selection:{projectFile:'b.f'}});assert.deepEqual(selected.roots,['second']);
});
