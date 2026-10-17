const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
class ProjectLocation{
 constructor(file){this.file=file;}
 read(){
  try{
   let directory=JSON.parse(fs.readFileSync(this.file,'utf8')).directory;
   if(typeof directory!=='string'||!path.isAbsolute(directory))return;
   while(true){try{if(fs.statSync(directory).isDirectory())return directory;}catch{}
    const parent=path.dirname(directory);if(parent===directory)return;directory=parent;
   }
  }catch{return;}
 }
 save(directory){
  if(typeof directory!=='string'||!path.isAbsolute(directory)||!fs.statSync(directory).isDirectory())return;
  fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+'.'+crypto.randomUUID()+'.tmp';
  try{fs.writeFileSync(tmp,JSON.stringify({directory}),{flag:'wx',mode:0o600});fs.renameSync(tmp,this.file);}
  finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
 }
}
module.exports={ProjectLocation};
