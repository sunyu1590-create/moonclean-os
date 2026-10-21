import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase/config";
import { getSupabaseServiceKey } from "@/lib/supabase/service";
import { runMockSync } from "@/services/mock-sync";

export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const databaseKey = getSupabaseServiceKey();
  if (!secret || !databaseKey) return NextResponse.json({error:"后台调度尚未配置"},{status:503});
  if (request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({error:"无权执行后台任务"},{status:401});
  const config = supabaseConfig();
  const db = createClient(config.url, databaseKey, {auth:{persistSession:false,autoRefreshToken:false}});
  const {data:connections,error} = await db.from("platform_connections")
    .select("id,store_id").eq("mode","mock").eq("auto_sync",true).limit(10);
  if(error) return NextResponse.json({error:"读取调度连接失败"},{status:500});
  const results=[];
  for(const connection of connections||[]){
    for(const kind of ["products","orders","refunds"] as const){
      try{results.push({storeId:connection.store_id,connectionId:connection.id,kind,
        ...await runMockSync(db,connection.store_id,connection.id,kind)});
      }catch(cause){results.push({storeId:connection.store_id,connectionId:connection.id,kind,status:"failed",
        error:cause instanceof Error?cause.message:"后台同步失败"});}
    }
  }
  return NextResponse.json({connections:connections?.length||0,results});
}
