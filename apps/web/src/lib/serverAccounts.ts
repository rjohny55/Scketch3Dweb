import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import path from 'node:path';
import {createHash,randomBytes,randomUUID,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {NextResponse} from 'next/server';
const scrypt=promisify(scryptCallback);
export const SESSION_COOKIE='scketch3d_session';
export type AccountUser={id:string;username:string;displayName:string;role:'admin'|'user';legacyOwner:boolean;mcpAllowed:boolean};
type UserRow={id:string;username:string;display_name:string;role:'admin'|'user';legacy_owner:number;active:number;password_hash:string;mcp_allowed:number};
const globalDb=globalThis as typeof globalThis&{__scketchAccountsDb?:DatabaseSync};
export function accountDirectory(){return path.resolve(process.env.SCKETCH3DWEB_SHARED_PROJECTS_DIR||path.join(process.cwd(),'.codex/projects'),'.accounts');}
export function accountDb(){
 if(globalDb.__scketchAccountsDb)return globalDb.__scketchAccountsDb;
 const root=accountDirectory();mkdirSync(root,{recursive:true,mode:0o700});chmodSync(root,0o700);
 const db=new DatabaseSync(path.join(root,'accounts.sqlite'));db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','user')),active INTEGER NOT NULL DEFAULT 1,legacy_owner INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
 CREATE TABLE IF NOT EXISTS login_attempts(bucket TEXT PRIMARY KEY,count INTEGER NOT NULL,started_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,shared INTEGER NOT NULL DEFAULT 0,revision TEXT NOT NULL,size INTEGER NOT NULL,updated_at INTEGER NOT NULL,has_thumbnail INTEGER NOT NULL DEFAULT 0,category TEXT NOT NULL DEFAULT 'general',version INTEGER NOT NULL DEFAULT 0,draft_of TEXT,base_revision TEXT);
 CREATE TABLE IF NOT EXISTS project_versions(project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,version INTEGER NOT NULL,revision TEXT NOT NULL,author_id TEXT NOT NULL REFERENCES users(id),saved_at INTEGER NOT NULL,size INTEGER NOT NULL,has_thumbnail INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(project_id,version));
 CREATE TABLE IF NOT EXISTS app_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY AUTOINCREMENT,project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,author_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,version INTEGER NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS project_likes(project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(project_id,user_id));
 CREATE TABLE IF NOT EXISTS activity_likes(event_id INTEGER NOT NULL REFERENCES activity(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(event_id,user_id));
 CREATE TABLE IF NOT EXISTS activity_comments(id TEXT PRIMARY KEY,event_id INTEGER NOT NULL REFERENCES activity(id) ON DELETE CASCADE,author_id TEXT NOT NULL REFERENCES users(id),body TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS projects_owner ON projects(owner_id);
 CREATE TABLE IF NOT EXISTS mcp_keys(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,prefix TEXT NOT NULL,created_at INTEGER NOT NULL,last_used_at INTEGER,revoked_at INTEGER);
 CREATE INDEX IF NOT EXISTS mcp_keys_user ON mcp_keys(user_id);`);
 if(!(db.prepare('PRAGMA table_info(users)').all() as {name:string}[]).some(c=>c.name==='mcp_allowed')){db.exec("ALTER TABLE users ADD COLUMN mcp_allowed INTEGER NOT NULL DEFAULT 0; UPDATE users SET mcp_allowed=1 WHERE role='admin';");}
 initializeLegacyMcpKey(db);
 chmodSync(path.join(root,'accounts.sqlite'),0o600);globalDb.__scketchAccountsDb=db;return db;
}
export function publicUser(row:UserRow):AccountUser{return {id:row.id,username:row.username,displayName:row.display_name,role:row.role,legacyOwner:!!row.legacy_owner,mcpAllowed:!!row.mcp_allowed};}
export function currentUser(request:Request):AccountUser|null{
 const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
 if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const row=accountDb().prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').get(hash(token),Date.now()) as UserRow|undefined;
 return row?publicUser(row):null;
}
export const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
export function sameOrigin(request:Request){
 const site=request.headers.get('sec-fetch-site');if(site&&!['same-origin','none'].includes(site))return false;
 const origin=request.headers.get('origin');if(!origin)return true;
 try{const url=new URL(request.url);const actual=new URL(origin),scheme=request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()||url.protocol.replace(':','');return actual.host===(request.headers.get('host')||url.host)&&actual.protocol===scheme+':';}catch{return false;}
}
export function accountError(message:string,status=400){return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store, private'}});}
export function accountJson(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'no-store, private'}});}
export function requireAccount(request:Request,admin=false):AccountUser|NextResponse{
 if(!sameOrigin(request))return accountError('Cross-origin requests are forbidden.',403);
 const user=currentUser(request);if(!user)return accountError('Sign in to continue.',401);
 if(admin&&user.role!=='admin')return accountError('Administrator access is required.',403);return user;
}
export function validateUsername(value:unknown){if(typeof value!=='string'||! /^[\p{L}\p{N}_.-]{3,40}$/u.test(value.trim()))throw Error('Use 3–40 letters, numbers, dots, dashes or underscores for the login.');return value.trim().toLowerCase();}
export function validatePassword(value:unknown):string{if(typeof value!=='string'||value.length<10||value.length>256)throw Error('Use a password between 10 and 256 characters.');return value;}
export async function passwordHash(password:string){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64) as Buffer;return `scrypt:${salt}:${key.toString('hex')}`;}
export async function passwordMatches(password:string,encoded:string){const [,salt,key]=encoded.split(':');if(!salt||!key)return false;const actual=await scrypt(password,salt,64) as Buffer;const expected=Buffer.from(key,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);}
export function sessionResponse(request:Request,user:AccountUser){
 const token=randomBytes(32).toString('hex'),db=accountDb(),expires=Date.now()+7*24*3600*1000;
 db.prepare('DELETE FROM sessions WHERE expires_at<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),user.id,expires);
 const response=accountJson({user});response.cookies.set(SESSION_COOKIE,token,{httpOnly:true,sameSite:'lax',secure:new URL(request.url).protocol==='https:'||request.headers.get('x-forwarded-proto')==='https',path:'/',maxAge:7*24*3600});return response;
}
export async function createAccount(input:Record<string,unknown>,bootstrap=false){
 const username=validateUsername(input.username),password=validatePassword(input.password),displayName=typeof input.displayName==='string'?input.displayName.trim().slice(0,80):username;
 if(!displayName)throw Error('Enter a display name.');
 const encoded=await passwordHash(password),db=accountDb(),id=randomUUID();
 db.exec('BEGIN IMMEDIATE');try{
  if(bootstrap&&(db.prepare('SELECT count(*) AS n FROM users').get() as {n:number}).n!==0)throw Error('Initial setup has already been completed.');
  db.prepare('INSERT INTO users(id,username,display_name,password_hash,role,legacy_owner,created_at) VALUES(?,?,?,?,?,?,?)').run(id,username,displayName,encoded,bootstrap||input.role==='admin'?'admin':'user',bootstrap?1:0,Date.now());db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');if(String(e).includes('UNIQUE'))throw Error('This login is already in use.');throw e;}
 db.prepare('UPDATE users SET mcp_allowed=? WHERE id=?').run(bootstrap||input.role==='admin'||input.mcpAllowed===true?1:0,id);
 initializeLegacyMcpKey(db);
 return publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id) as UserRow);
}
export function consumeLoginAttempt(request:Request,username:string){
 const db=accountDb(),now=Date.now(),window=15*60*1000;
 db.prepare('DELETE FROM login_attempts WHERE started_at<?').run(now-window);
 // The socket-facing Host is shared by this local deployment; do not trust client-supplied forwarding IPs.
 for(const [bucket,limit] of [[`login:${username}`,10],['global',60]] as const){
  const row=db.prepare('SELECT count FROM login_attempts WHERE bucket=?').get(bucket) as {count:number}|undefined;
  if((row?.count??0)>=limit)return false;
 }
 for(const bucket of [`login:${username}`,'global'])db.prepare('INSERT INTO login_attempts VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1').run(bucket,now);
 return true;
}

export function recordActivity(projectId:string,authorId:string,kind:string,version:number){accountDb().prepare('INSERT INTO activity(project_id,author_id,kind,version,created_at) VALUES(?,?,?,?,?)').run(projectId,authorId,kind,version,Date.now());}

function initializeLegacyMcpKey(db:DatabaseSync){
 // Bind the existing local client once; revocation must survive every restart.
 if(db.prepare("SELECT value FROM app_metadata WHERE key='mcp_legacy_key_migrated'").get())return;
 const owner=db.prepare("SELECT id FROM users WHERE legacy_owner=1 AND role='admin' AND active=1").get() as {id:string}|undefined;
 const token=process.env.SCKETCH3DWEB_MCP_TOKEN??'';
 if(!owner||token.length<32)return;
 db.exec('BEGIN IMMEDIATE');try{
  if(!db.prepare("SELECT value FROM app_metadata WHERE key='mcp_legacy_key_migrated'").get()){
   db.prepare('INSERT OR IGNORE INTO mcp_keys(id,user_id,name,token_hash,prefix,created_at) VALUES(?,?,?,?,?,?)').run('legacy-controller',owner.id,'Existing local connection',hash(token),token.slice(0,8),Date.now());
   db.prepare("INSERT INTO app_metadata(key,value) VALUES('mcp_legacy_key_migrated','1')").run();
  }db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
