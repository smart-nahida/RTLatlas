const fs=require('node:fs/promises');const path=require('node:path');
async function writableDemo(source,destination){
 try{await fs.access(path.join(destination,'design.sv'));return destination;}catch{}
 await fs.mkdir(destination,{recursive:true});await fs.cp(source,destination,{recursive:true,force:false,errorOnExist:false,filter:from=>path.basename(from)!=='.rtl-atlas'});return destination;
}
module.exports={writableDemo};
