import {accessCookie,hasWorkspaceAccess,passwordMatches} from '@/lib/access';

export async function GET(request:Request){
 return Response.json({authorized:await hasWorkspaceAccess(request)},{headers:{'Cache-Control':'no-store'}});
}

export async function POST(request:Request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'须使用 JSON 请求'},{status:415});
 let body:unknown;
 try{body=await request.json();}catch{return Response.json({error:'请求格式无效'},{status:400});}
 const candidate=typeof body==='object'&&body!==null&&'password' in body?(body as {password?:unknown}).password:'';
 if(typeof candidate!=='string'||!(await passwordMatches(candidate)))return Response.json({error:'密码不正确'},{status:401});
 return Response.json({authorized:true},{headers:{'Set-Cookie':await accessCookie(),'Cache-Control':'no-store'}});
}
