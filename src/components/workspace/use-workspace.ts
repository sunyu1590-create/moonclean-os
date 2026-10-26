"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";
import { notifyFeedback } from "@/lib/feedback";
import { dedupeWorkspaceRequest, getWorkspaceCache, getWorkspaceCacheTtl, setWorkspaceCache, WORKSPACE_REFRESH_EVENT } from "@/lib/workspace-cache";
import { CACHE_PREFERENCES_EVENT } from "@/lib/cache-preferences";
import type { WorkspaceFeature } from "@/lib/workspace-usage";
import { localWorkspaceKey, resourceSchemas, workspacePatchSchema, type WorkspaceResource, type WorkspaceRow } from "@/lib/workspace";

function readLocal(storeId: string, resource: WorkspaceResource): WorkspaceRow[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(localWorkspaceKey(storeId,resource)) || "[]"); return Array.isArray(value) ? value as WorkspaceRow[] : []; }
  catch { return []; }
}
function writeLocal(storeId: string, resource: WorkspaceResource, rows: WorkspaceRow[]) { localStorage.setItem(localWorkspaceKey(storeId,resource),JSON.stringify(rows)); }
export function useWorkspaceResource(resource: WorkspaceResource, feature: WorkspaceFeature) {
  const { mode, activeStoreId, user } = useApp();
  const userId = user?.id || "";
  const [rows,setRows] = useState<WorkspaceRow[]>([]);
  const [loading,setLoading] = useState(true);
  const [refreshing,setRefreshing] = useState(false);
  const [error,setError] = useState("");
  const [lastUpdated,setLastUpdated] = useState<number | null>(null);
  const rowsRef = useRef(rows);
  const activeKeyRef = useRef("");

  const commitRows = useCallback((next: WorkspaceRow[]) => {
    rowsRef.current = next;
    setRows(next);
  }, []);

  const refresh = useCallback(async (force = false):Promise<boolean> => {
    if (!activeStoreId) {
      commitRows([]); setError("请先选择或创建店铺。"); setLoading(false); setRefreshing(false); return false;
    }
    if (mode === "local") {
      commitRows(readLocal(activeStoreId,resource)); setError(""); setLoading(false); setRefreshing(false); setLastUpdated(Date.now()); return true;
    }
    if (!userId) { setLoading(false); return false; }

    const requestKey = `${userId}:${activeStoreId}:${resource}`;
    const cached = getWorkspaceCache(userId,activeStoreId,resource,feature);
    if (cached && activeKeyRef.current === requestKey) {
      commitRows(cached.rows);
      setLastUpdated(cached.updatedAt);
      if (!force && Date.now() - cached.updatedAt < getWorkspaceCacheTtl()) {
        setError(""); setLoading(false); setRefreshing(false); return true;
      }
    }
    setError("");
    setRefreshing(true);
    if (!cached) setLoading(true);
    try {
      const next = await dedupeWorkspaceRequest(requestKey, async () => {
      const response = await fetch(`/api/stores/${encodeURIComponent(activeStoreId)}/workspace/${resource}`,{cache:"no-store"});
      const result = await response.json() as {rows?:WorkspaceRow[];error?:string};
      if (!response.ok) throw new Error(result.error||"云端数据加载失败");
        return result.rows || [];
      });
      if (activeKeyRef.current === requestKey) {
        commitRows(next);
        const updatedAt = Date.now();
        setLastUpdated(updatedAt);
        setError("");
        setWorkspaceCache(userId,activeStoreId,resource,next,updatedAt,feature);
      }
      return true;
    }
    catch(cause) {
      if (activeKeyRef.current === requestKey) setError(cause instanceof Error?cause.message:"读取失败");
      return false;
    }
    finally {
      if (activeKeyRef.current === requestKey) { setLoading(false); setRefreshing(false); }
    }
  },[activeStoreId,commitRows,feature,mode,resource,userId]);

  useEffect(()=>{
    const requestKey = `${userId}:${activeStoreId || ""}:${resource}`;
    activeKeyRef.current = requestKey;
    const frame=window.requestAnimationFrame(()=>{
      if(activeKeyRef.current!==requestKey)return;
      if (mode === "cloud" && activeStoreId && userId) {
        const cached = getWorkspaceCache(userId,activeStoreId,resource,feature);
        if (cached) {
          commitRows(cached.rows); setLastUpdated(cached.updatedAt); setLoading(false); setError("");
        } else { commitRows([]); setLastUpdated(null); setLoading(true); }
      } else { setLastUpdated(null); }
      void refresh(false).catch(()=>{});
    });

    const onRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{refreshers: Array<() => Promise<void>>}>).detail;
      detail?.refreshers.push(async()=>{if(!await refresh(true))throw new Error("部分模块数据未能刷新");});
    };
    let timer = 0;
    const scheduleRefresh = () => {
      window.clearInterval(timer);
      timer = window.setInterval(() => {
      if (mode === "cloud" && document.visibilityState === "visible") void refresh(true);
      }, getWorkspaceCacheTtl());
    };
    scheduleRefresh();
    const onCachePreferences = () => { scheduleRefresh(); void refresh(true); };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible" || mode !== "cloud" || !activeStoreId || !userId) return;
      const cached = getWorkspaceCache(userId,activeStoreId,resource);
      if (!cached || Date.now() - cached.updatedAt >= getWorkspaceCacheTtl()) void refresh(true);
    };
    window.addEventListener(WORKSPACE_REFRESH_EVENT,onRefresh);
    window.addEventListener(CACHE_PREFERENCES_EVENT,onCachePreferences);
    document.addEventListener("visibilitychange",onVisibilityChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
      window.removeEventListener(WORKSPACE_REFRESH_EVENT,onRefresh);
      window.removeEventListener(CACHE_PREFERENCES_EVENT,onCachePreferences);
      document.removeEventListener("visibilitychange",onVisibilityChange);
    };
  },[activeStoreId,commitRows,feature,mode,refresh,resource,userId]);

  const mutate=useCallback(async (method:"POST"|"PATCH"|"DELETE",value:Record<string,unknown>,success:string): Promise<WorkspaceRow|void> => {
    let created: WorkspaceRow|void = undefined;
    if(!activeStoreId) throw new Error("请先选择店铺");
    if(mode==="local") {
      const current=readLocal(activeStoreId,resource);
      if(method==="DELETE") {
        const id=String(value.id); const restore=value.restore===true;
        const field=value.archive===true||value.restoreArchive===true?"archived_at":resource==="notes"||resource==="copilot-conversations"?"deleted_at":"archived_at";
        const next=current.map(row=>row.id===id?{...row,[field]:restore?null:new Date().toISOString()}:row);
        writeLocal(activeStoreId,resource,next); commitRows(next);
      } else {
        const payload={...value}; delete payload.__silent;
        const checked=(method==="PATCH"?workspacePatchSchema(resource):resourceSchemas[resource]).parse(payload) as Record<string,unknown>;
        const now=new Date().toISOString();
        if(method==="POST") {
          const row={...checked,id:typeof checked.id==="string"?checked.id:crypto.randomUUID(),store_id:activeStoreId,created_by:"local-user",created_at:now,updated_at:now} as WorkspaceRow;
          const next=[row,...current];writeLocal(activeStoreId,resource,next);commitRows(next);created=row;
        } else {
          const id=String(checked.id||"");
          const source=current.find(row=>row.id===id);
          if(!source) throw new Error("记录不存在，可能已被删除或切换了店铺。");
          const merged=resourceSchemas[resource].parse({...source,...checked}) as Record<string,unknown>;
          if ((resource === "notes" || resource === "service-templates") && current.some(row => row.id === id && Object.keys(checked).some(key => !["id"].includes(key) && row[key] !== checked[key]))) {
            const historyResource:WorkspaceResource=resource === "notes" ? "note-versions" : "service-template-versions";
            const history=readLocal(activeStoreId,historyResource);
            const historyRow:WorkspaceRow=resource === "notes"
              ? {id:crypto.randomUUID(),store_id:activeStoreId,note_id:id,version_number:history.filter(v=>v.note_id===id).length+1,title:String(checked.title??source.title),body_markdown:String(checked.body_markdown??source.body_markdown),created_at:now}
              : {id:crypto.randomUUID(),store_id:activeStoreId,template_id:id,version_number:history.filter(v=>v.template_id===id).length+1,title:String(checked.title??source.title),category:String(checked.category??source.category),body:String(checked.body??source.body),created_at:now};
            writeLocal(activeStoreId,historyResource,[historyRow,...history]);
          }
          const next=current.map(row=>row.id===id?{...row,...merged,updated_at:now}:row);
          writeLocal(activeStoreId,resource,next);commitRows(next);created=next.find(row=>row.id===id);
        }
      }
    } else {
      const payload={...value}; delete payload.__silent;
      const response=await fetch(`/api/stores/${encodeURIComponent(activeStoreId)}/workspace/${resource}`,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const result=await response.json() as {error?:string;id?:string;[key:string]:unknown};
      if(!response.ok) throw new Error(result.error||"云端保存失败");
      const current=rowsRef.current;
      const now=new Date().toISOString();
      let next=current;
      if(method==="POST") {
        created=result as WorkspaceRow;
        next=[created,...current.filter(row=>row.id!==created!.id)];
      } else if(method==="PATCH") {
        const updated=result as WorkspaceRow;
        next=current.map(row=>row.id===updated.id?updated:row);
        created=updated;
      } else {
        const id=String(value.id);
        const field=value.archive===true||value.restoreArchive===true?"archived_at":resource==="notes"||resource==="copilot-conversations"?"deleted_at":"archived_at";
        next=current.map(row=>row.id===id?{...row,[field]:value.restore===true?null:now}:row);
      }
      commitRows(next);
      if(userId) {
        const updatedAt=Date.now();
        setLastUpdated(updatedAt);
        setWorkspaceCache(userId,activeStoreId,resource,next,updatedAt,feature);
      }
    }
    if(success)notifyFeedback({kind:"success",title:success,description:mode==="cloud"?"已保存到云端店铺。":"已保存在此设备。"});
    return created;
  },[activeStoreId,commitRows,feature,mode,resource,userId]);
  return {rows,loading,refreshing,error,lastUpdated,refresh,create:(v:Record<string,unknown>)=>mutate("POST",v,v.__silent===true?"":"已创建"),update:(v:Record<string,unknown>)=>mutate("PATCH",v,v.__silent===true?"":"已保存"),remove:(id:string)=>mutate("DELETE",{id},"已移入回收站"),archive:(id:string)=>mutate("DELETE",{id,archive:true},"已归档"),restore:(id:string)=>mutate("DELETE",{id,restore:true},"已恢复"),unarchive:(id:string)=>mutate("DELETE",{id,restore:true,restoreArchive:true},"已取消归档")};
}
