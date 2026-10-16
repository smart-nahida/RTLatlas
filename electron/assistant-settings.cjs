const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const {normalizeConfig,requireApiKey}=require('./assistant.cjs');
class AssistantSettings{
 constructor(file,secureStorage){this.file=file;this.secure=secureStorage;}
 load(){
  if(!fs.existsSync(this.file))return null;const stored=JSON.parse(fs.readFileSync(this.file,'utf8'));
  if(stored.encryptedKey&&!this.secure.isEncryptionAvailable())throw Error('Unlock system key storage / 请解锁系统密钥存储');
  return normalizeConfig({...stored,apiKey:stored.encryptedKey?this.secure.decryptString(Buffer.from(stored.encryptedKey,'base64')):''});
 }
 public(){const config=this.load();return config?{baseUrl:config.baseUrl,model:config.model,stream:config.stream,hasKey:!!config.apiKey}:null;}
 save(input){
  const config=normalizeConfig(input);let existing=null;
  // A blank key retains the saved key only for the same endpoint; never send it to another host.
  if(!config.apiKey&&!input.clearKey)try{existing=this.load();}catch{}
  if(existing?.endpoint===config.endpoint)config.apiKey=existing.apiKey;
  requireApiKey(config);
  if(config.apiKey&&!this.secure.isEncryptionAvailable())throw Error('System key encryption unavailable / 系统密钥加密不可用，无法保存 API Key');
  const stored={baseUrl:config.baseUrl,model:config.model,stream:config.stream,encryptedKey:config.apiKey?this.secure.encryptString(config.apiKey).toString('base64'):''};
  fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=this.file+'.'+crypto.randomUUID()+'.tmp';
  try{fs.writeFileSync(tmp,JSON.stringify(stored),{mode:0o600,flag:'wx'});fs.renameSync(tmp,this.file);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
  return config;
 }
 clear(){if(fs.existsSync(this.file))fs.unlinkSync(this.file);}
}
module.exports={AssistantSettings};
