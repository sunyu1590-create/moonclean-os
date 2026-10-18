"use client";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { notifyFeedback } from "@/lib/feedback";
import { localWorkspaceKey, resourceSchemas, type WorkspaceResource, type WorkspaceRow } from "@/lib/workspace";

function readLocal(storeId: string, resource: WorkspaceResource): WorkspaceRow[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(localWorkspaceKey(storeId,resource)) || "[]"); return Array.isArray(value) ? value as WorkspaceRow[] : []; }
  catch { return []; }
}
function writeLocal(storeId: string, resource: WorkspaceResource, rows: WorkspaceRow[]) { localStorage.setItem(localWorkspaceKey(storeId,resource),JSON.stringify(rows)); }

export function useWorkspaceResource(resource: WorkspaceResource) {
  const { mode, activeStoreId } = useApp();
  const [rows,setRows] = useState<WorkspaceRow[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const refresh = useCallback(async () => {
    if (!activeStoreId) { setRows([]); setError("请先选择或创建店铺。"); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      if (mode === "local") setRows(readLocal(activeStoreId,resource));
      else {
        const response=await fetch(`/api/stores/${activeStoreId}/workspace/${resource}`,{cache:"no-store"});
        const result=await response.json() as {rows?:WorkspaceRow[];error?:string};
        if(!response.ok) throw new Error(result.error||"云端数据加载失败");
        setRows(result.rows||[]);
      }
    } catch(cause) { setError(cause instanceof Error?cause.message:"读取失败"); }
    finally { setLoading(false); }
  },[activeStoreId,mode,resource]);
  useEffect(()=>{const timer=window.setTimeout(()=>void refresh(),0);return()=>window.clearTimeout(timer);},[refresh]);
  const mutate=useCallback(async (method:"POST"|"PATCH"|"DELETE",value:Record<string,unknown>,success:string): Promise<WorkspaceRow|void> => {
    let created: WorkspaceRow|void = undefined;
    if(!activeStoreId) throw new Error("请先选择店铺");
    if(mode==="local") {
      const current=readLocal(activeStoreId,resource);
      if(method==="DELETE") {
        const id=String(value.id); const restore=value.restore===true;
        const field=value.archive===true||value.restoreArchive===true?"archived_at":resource==="notes"||resource==="copilot-conversations"?"deleted_at":"archived_at";
        const next=current.map(row=>row.id===id?{...row,[field]:restore?null:new Date().toISOString()}:row);
        writeLocal(activeStoreId,resource,next); setRows(next);
      } else {
        const checked=(method==="PATCH"?resourceSchemas[resource].partial():resourceSchemas[resource]).parse(value) as Record<string, unknown>;
        const now=new Date().toISOString();
        if(method==="POST") {
          const row={...checked,id:crypto.randomUUID(),store_id:activeStoreId,created_by:"local-user",created_at:now,updated_at:now} as WorkspaceRow;
          const next=[row,...current];writeLocal(activeStoreId,resource,next);setRows(next);created=row;
        } else {
          const id=String(checked.id||"");
          if ((resource === "notes" || resource === "service-templates") && current.some(row => row.id === id && Object.keys(checked).some(key => !["id"].includes(key) && row[key] !== checked[key]))) {
            const source=current.find(row=>row.id===id)!;
            const historyResource:WorkspaceResource=resource === "notes" ? "note-versions" : "service-template-versions";
            const history=readLocal(activeStoreId,historyResource);
            const historyRow:WorkspaceRow=resource === "notes"
              ? {id:crypto.randomUUID(),store_id:activeStoreId,note_id:id,version_number:history.filter(v=>v.note_id===id).length+1,title:String(checked.title??source.title),body_markdown:String(checked.body_markdown??source.body_markdown),created_at:now}
              : {id:crypto.randomUUID(),store_id:activeStoreId,template_id:id,version_number:history.filter(v=>v.template_id===id).length+1,title:String(checked.title??source.title),category:String(checked.category??source.category),body:String(checked.body??source.body),created_at:now};
            writeLocal(activeStoreId,historyResource,[historyRow,...history]);
          }
          const next=current.map(row=>row.id===id?{...row,...checked,updated_at:now}:row);
          writeLocal(activeStoreId,resource,next);setRows(next);
        }
      }
    } else {
      const response=await fetch(`/api/stores/${activeStoreId}/workspace/${resource}`,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(value)});
      const result=await response.json() as {error?:string;id?:string;[key:string]:unknown};
      if(!response.ok) throw new Error(result.error||"云端保存失败");
      if(method==="POST") created=result as WorkspaceRow;
      await refresh();
    }
    notifyFeedback({kind:"success",title:success,description:mode==="cloud"?"已保存到云端店铺。":"已保存在此设备。"});
    return created;
  },[activeStoreId,mode,resource,refresh]);
  return {rows,loading,error,refresh,create:(v:Record<string,unknown>)=>mutate("POST",v,"已创建"),update:(v:Record<string,unknown>)=>mutate("PATCH",v,"已保存"),remove:(id:string)=>mutate("DELETE",{id},"已移入回收站"),archive:(id:string)=>mutate("DELETE",{id,archive:true},"已归档"),restore:(id:string)=>mutate("DELETE",{id,restore:true},"已恢复"),unarchive:(id:string)=>mutate("DELETE",{id,restore:true,restoreArchive:true},"已取消归档")};
}
