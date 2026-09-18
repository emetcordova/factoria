import {handleApi} from '../server/commerce.mjs';
export const config={api:{bodyParser:false}};
export default async function handler(req,res) {
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>1000000){res.statusCode=413;res.end('Payload too large');return;}chunks.push(chunk);}
 const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(','):v);
 const url=new URL(req.url,'https://internal.invalid');
 const request=new Request(url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
 const response=await handleApi(request,process.env);
 res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await response.arrayBuffer()));
}
