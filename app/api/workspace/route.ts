import {database} from '@/lib/db';
import {initialProfiles,inspectData,type Daily,type Profile,type Report} from '@/lib/model';
import {validateRecords,validateProfiles,validDate,parseCsv} from '@/lib/validation';
export async function readWorkspace(){const data=await database().prepare('SELECT key,value FROM workspace').all<{key:string;value:string}>();const items=Object.fromEntries(data.results.map(r=>[r.key,JSON.parse(r.value)]));return {profiles:(items.profiles||initialProfiles) as Profile[],records:Object.entries(items).filter(([k])=>k.startsWith('daily:')).map(([,v])=>v) as Daily[],reports:(Object.entries(items).filter(([k])=>k.startsWith('report:')).map(([,v])=>v) as Report[]).sort((a,b)=>b.at.localeCompare(a.at))};}
export async function GET(){try{return Response.json(await readWorkspace(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'数据服务暂不可用'},{status:503});}}
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)return Response.json({error:'只接受工作台内的操作。API 采集尚未配置。'},{status:403});
 if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'须使用 JSON 请求'},{status:415});
 let body;try{const text=await request.text();if(text.length>1500000)return Response.json({error:'请求过大'},{status:413});body=JSON.parse(text);}catch{return Response.json({error:'JSON 格式无效'},{status:400});}
 let changes:{key:string;value:unknown}[]=[];let message='';
 try{if(body.action==='profiles'){changes=[{key:'profiles',value:validateProfiles(body.profiles)}];message='店铺与账号登记已保存。';}
 else if(body.action==='records'||body.action==='csv'){const rows=body.action==='csv'?parseCsv(body.csv):validateRecords(body.records);changes=rows.map(r=>({key:'daily:'+r.date+':'+r.profile,value:r}));message=`已保存 ${rows.length} 条日报；同日同账号更新，不重复累加。`;}
 else if(body.action==='inspect'){if(!validDate(body.date))throw Error('统计日期无效');const w=await readWorkspace();const report={at:new Date().toISOString(),date:body.date,alerts:inspectData(w.records,w.profiles,body.date)};changes=[{key:'report:'+body.date,value:report}];message='巡检记录已保存。';}
 else throw Error('不支持的操作');
 }catch(e){return Response.json({error:(e as Error).message},{status:400});}
 try{const db=database();await db.batch(changes.map(x=>db.prepare('INSERT INTO workspace (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(x.key,JSON.stringify(x.value),new Date().toISOString())));return Response.json({message});}catch{return Response.json({error:'保存失败，请重试；数据未确认写入。'},{status:503});}
}
