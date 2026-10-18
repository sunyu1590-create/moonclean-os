export type Connection = {
  id:string; store_id:string; display_name:string; mode:"mock"|"official";
  status:string; auto_sync:boolean; last_synced_at:string|null; last_result:string|null; created_at:string;
};
export type SyncJob = {
  id:string; connection_id:string; kind:"orders"|"products"|"refunds";
  status:"pending"|"running"|"success"|"partial_success"|"failed"|"cancelled";
  success_count:number; failure_count:number; error_summary:string|null; started_at:string; finished_at:string|null;
};
export type IntegrationSnapshot = {
  connections:Connection[]; jobs:SyncJob[];
  logs:{id:string;job_id:string;level:string;message:string;created_at:string}[];
  products:{id:string;connection_id:string;external_id:string;name:string;is_demo:boolean}[];
  skus:{id:string;connection_id:string;external_id:string;name:string;sku_code:string|null;selling_price:string}[];
  mappings:{id:string;connection_id:string;external_sku_id:string;sku_id:string;match_kind:string}[];
  history:{id:string;external_sku_id:string;sku_id:string|null;action:string;created_at:string}[];
  internalSkus:{id:string;sku_name:string;sku_code:string|null;product_id:string}[];
  orders:{id:string;external_id:string;status:string;placed_at:string;gross_sales:string;is_demo:boolean}[];
  refunds:{id:string;external_id:string;order_id:string;amount:string;status:string}[];
  cursors:{connection_id:string;kind:string;cursor_value:string|null;updated_at:string}[];
};
async function json(response:Response){
  const body=await response.json().catch(()=>({error:"服务端响应无效"}));
  if(!response.ok)throw new Error(body.error||`请求失败 (${response.status})`);
  return body;
}
export async function getIntegration(storeId:string):Promise<IntegrationSnapshot>{
  return json(await fetch(`/api/stores/${storeId}/integration`,{cache:"no-store"}));
}
export async function integrationAction<T=unknown>(storeId:string,body:unknown):Promise<T>{
  return json(await fetch(`/api/stores/${storeId}/integration`,{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),
  }));
}
