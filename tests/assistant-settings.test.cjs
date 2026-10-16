const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const crypto=require('node:crypto');
const {AssistantSettings}=require('../electron/assistant-settings.cjs');
// Substitute only the OS encryption boundary; settings IO and redaction use production code.
function secureStorage(){const key=crypto.randomBytes(32);return {isEncryptionAvailable:()=>true,encryptString:text=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]);},decryptString:buffer=>{const decipher=crypto.createDecipheriv('aes-256-gcm',key,buffer.subarray(0,12));decipher.setAuthTag(buffer.subarray(12,28));return Buffer.concat([decipher.update(buffer.subarray(28)),decipher.final()]).toString('utf8');}};}
test('keys persist encrypted and are never returned by public settings',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-api-')),file=path.join(dir,'api-settings.json'),secure=secureStorage(),store=new AssistantSettings(file,secure);
 try{store.save({baseUrl:'https://api.deepseek.com',model:'custom-model',apiKey:'private-api-key'});assert.ok(!fs.readFileSync(file,'utf8').includes('private-api-key'));assert.equal(store.public().hasKey,true);assert.equal(store.public().apiKey,undefined);assert.equal(new AssistantSettings(file,secure).load().apiKey,'private-api-key');store.save({baseUrl:'https://api.deepseek.com',model:'other-model',apiKey:''});assert.equal(store.load().apiKey,'private-api-key');store.save({baseUrl:'https://other.example/v1',model:'m',apiKey:''});assert.equal(store.load().apiKey,'');store.clear();assert.equal(store.load(),null);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('unavailable system encryption never falls back to plaintext storage',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-api-')),file=path.join(dir,'api-settings.json'),store=new AssistantSettings(file,{isEncryptionAvailable:()=>false});
 try{assert.throws(()=>store.save({baseUrl:'https://api.example.com',model:'m',apiKey:'secret'}),/encryption|加密/);assert.equal(fs.existsSync(file),false);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('official providers cannot be saved without an API key',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-api-')),file=path.join(dir,'api-settings.json'),store=new AssistantSettings(file,secureStorage());
 try{for(const baseUrl of ['https://api.deepseek.com','https://api.openai.com/v1'])assert.throws(()=>store.save({baseUrl,model:'m',apiKey:''}),/API Key|密钥/);assert.equal(fs.existsSync(file),false);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
