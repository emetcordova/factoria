import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhone,sendBotcakeFlow} from '../server/botcake.mjs';

test('Botcake formats WhatsApp once and sends the configured course flow',async()=>{
 assert.equal(normalizePhone('+51 974 209 670'),'51974209670');
 let request;
 const result=await sendBotcakeFlow({phone:'+51 974 209 670',flowId:'12345',customer:{name:'Ana Pérez'},config:{pageId:'waba_123',apiKey:'private-key'},fetcher:async(url,options)=>{request={url,options};return new Response(JSON.stringify({success:true,data:{message_id:'msg_1'}}),{status:200})}});
 assert.equal(request.url,'https://botcake.io/api/public_api/v1/pages/waba_123/flows/send_flow');
 assert.equal(request.options.headers['access-token'],'private-key');
 assert.equal(JSON.parse(request.options.body).psid,'wa_51974209670');
 assert.equal(JSON.parse(request.options.body).flow_id,12345);
 assert.equal(result.messageId,'msg_1');
});

test('Botcake error payload is never treated as successful delivery',async()=>{
 await assert.rejects(sendBotcakeFlow({phone:'+51974209670',flowId:'12345',config:{pageId:'waba_123',apiKey:'private-key'},fetcher:async()=>new Response(JSON.stringify({success:false,message:'Flow no disponible'}),{status:200})}),/Flow no disponible/);
});
