import {handleLeads} from '../server/leads.mjs';
export const config={api:{bodyParser:false}};
export default async function handler(req,res){
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>4096){res.statusCode=413;res.end('Payload too large');return;}chunks.push(chunk);}
 const headers=new Headers();
 for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
 const request=new Request(new URL(req.url,`https://${req.headers.host}`),{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
 const response=await handleLeads(request,process.env);
 res.statusCode=response.status;response.headers.forEach((value,key)=>res.setHeader(key,value));res.end(Buffer.from(await response.arrayBuffer()));
}
