import {request} from '@playwright/test';
export default async function(){const api=await request.newContext({ignoreHTTPSErrors:true});try{await api.post('https://localhost:4178/__fixture/stop',{headers:{origin:'https://localhost:4178'}});}finally{await api.dispose();}}
