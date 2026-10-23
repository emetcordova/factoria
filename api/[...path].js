import {handleApi} from '../server/commerce.mjs';
export const config={api:{bodyParser:false}};
export default async function handler(req,res) {
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>1000000){res.statusCode=413;res.end('Payload too large');return;}chunks.push(chunk);}
 const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join(','):v);
 const url=new URL(req.url,`https://${req.headers.host}`);
 const request=new Request(url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
 // Date, schedule and prices are intentionally sourced only from public/site-settings.json.
 // Strip legacy/content overrides so old Vercel values cannot silently change the offer.
 const runtimeEnv={...process.env};
 for(const key of ['EVENT_DAY','EVENT_MONTH','EVENT_YEAR','EVENT_DATE','EVENT_TIME','COURSE_PRICE_PEN','ORDER_BUMP_PEN'])delete runtimeEnv[key];
 for(const key of Object.keys(runtimeEnv))if(key.startsWith('COURSE_PRICE_'))delete runtimeEnv[key];
 const response=await handleApi(request,runtimeEnv);
 res.statusCode=response.status;response.headers.forEach((v,k)=>res.setHeader(k,v));res.end(Buffer.from(await response.arrayBuffer()));
}
