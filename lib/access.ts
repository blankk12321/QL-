import {env} from 'cloudflare:workers';

const cookieName='tk_workspace_access';
const lifetimeMs=1000*60*60*12;

function password(){
 const value=(env as unknown as {WORKSPACE_ACCESS_PASSWORD?:string}).WORKSPACE_ACCESS_PASSWORD;
 if(!value)throw new Error('Workspace password is not configured');
 return value;
}

function bytes(value:string){return new TextEncoder().encode(value);}

function encode(bytesValue:ArrayBuffer){return Array.from(new Uint8Array(bytesValue)).map(value=>value.toString(16).padStart(2,'0')).join('');}

async function sign(value:string){
 const key=await crypto.subtle.importKey('raw',bytes(password()),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return encode(await crypto.subtle.sign('HMAC',key,bytes(value)));
}

async function same(left:string,right:string){
 const leftHash=await crypto.subtle.digest('SHA-256',bytes(left));
 const rightHash=await crypto.subtle.digest('SHA-256',bytes(right));
 const first=new Uint8Array(leftHash),second=new Uint8Array(rightHash);
 return first.length===second.length&&first.every((value,index)=>value===second[index]);
}

function valueFromCookie(request:Request){
 return request.headers.get('cookie')?.split(';').map(item=>item.trim()).find(item=>item.startsWith(cookieName+'='))?.slice(cookieName.length+1);
}

export async function hasWorkspaceAccess(request:Request){
 const value=valueFromCookie(request);
 if(!value)return false;
 const [expires,signature]=value.split('.');
 if(!expires||!signature||Number(expires)<Date.now())return false;
 return same(await sign(expires),signature);
}

export async function passwordMatches(candidate:string){
 return same(candidate,password());
}

export async function accessCookie(){
 const expires=String(Date.now()+lifetimeMs);
 const value=expires+'.'+await sign(expires);
 return `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.floor(lifetimeMs/1000)}`;
}
