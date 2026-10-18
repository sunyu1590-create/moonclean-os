"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, ListTodo, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { MetricCard, PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type OperationTask, operationsRequest } from "@/lib/operations";
type Status=OperationTask["status"];
type Priority=OperationTask["priority"];
const statusName:Record<Status,string>={todo:"待处理",doing:"进行中",done:"已完成"};
const priorityName:Record<Priority,string>={low:"低",normal:"普通",high:"高"};
const blank={title:"",detail:"",priority:"normal" as Priority,status:"todo" as Status,dueDate:""};
export default function TasksPage(){
  const {mode,activeStoreId,role,data}=useApp();
  const [tasks,setTasks]=useState<OperationTask[]>([]);const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [notice,setNotice]=useState("");
  const [filter,setFilter]=useState<Status|"all">("all");const [editing,setEditing]=useState<string|null>(null);
  const [form,setForm]=useState(blank);
  const today=data?new Intl.DateTimeFormat("en-CA",{timeZone:data.settings.store.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()):"";
  const load=useCallback(async()=>{
    if(!activeStoreId)return;
    setLoading(true);setError("");
    try{const result=await operationsRequest<{tasks:OperationTask[]}>(activeStoreId,"tasks");setTasks(result.tasks);}
    catch(cause){setError(cause instanceof Error?cause.message:"待办读取失败");}
    finally{setLoading(false);}
  },[activeStoreId]);
  useEffect(()=>{queueMicrotask(()=>{setTasks([]);void load();});},[load]);
  const canEdit=mode==="cloud"&&role!=="viewer";
  function startEdit(task:OperationTask){setEditing(task.id);setForm({title:task.title,detail:task.detail,priority:task.priority,status:task.status,dueDate:task.due_date||""});}
  async function save(event:React.FormEvent){
    event.preventDefault();if(!activeStoreId)return;
    setBusy(true);setError("");setNotice("");
    try{
      await operationsRequest(activeStoreId,"tasks",{...form,dueDate:form.dueDate||null,...(editing?{id:editing}:{})},editing?"PATCH":"POST");
      setEditing(null);setForm(blank);await load();setNotice("待办已保存到云端。");
    }catch(cause){setError(cause instanceof Error?cause.message:"保存失败");}
    finally{setBusy(false);}
  }
  async function changeStatus(task:OperationTask,status:Status){
    if(!activeStoreId)return;
    setBusy(true);setError("");setNotice("");
    try{await operationsRequest(activeStoreId,"tasks",{id:task.id,title:task.title,detail:task.detail,priority:task.priority,status,dueDate:task.due_date},"PATCH");await load();setNotice("状态已更新。");}
    catch(cause){setError(cause instanceof Error?cause.message:"更新失败");}
    finally{setBusy(false);}
  }
  async function remove(task:OperationTask){
    if(!activeStoreId||!window.confirm(`确定删除“${task.title}”吗？`))return;
    setBusy(true);setError("");setNotice("");
    try{await operationsRequest(activeStoreId,"tasks",{id:task.id},"DELETE");await load();setNotice("待办已删除。");}
    catch(cause){setError(cause instanceof Error?cause.message:"删除失败");}
    finally{setBusy(false);}
  }
  const open=tasks.filter(task=>task.status!=="done");
  const overdue=open.filter(task=>task.due_date&&task.due_date<today);
  const visible=tasks.filter(task=>filter==="all"||task.status===filter);
  return <>
    <PageHead eyebrow="TASKS / 运营待办" title="让每天的运营更有条理" description="记录补货、推广、售后等任务，按店铺同步给团队成员。" action={<Button variant="outline" onClick={()=>void load()} disabled={loading||mode!=="cloud"}><RefreshCw size={16}/>刷新</Button>}/>
    {mode!=="cloud"&&<p className="mb-5 rounded-2xl bg-[#e8f5ff] p-4 text-sm text-[#476d91]">待办功能使用云端店铺。配置 Supabase 并登录后即可跨设备使用。</p>}
    {error&&<p role="alert" className="mb-5 rounded-xl bg-[#fff0f1] p-4 text-sm text-[#d35760]">{error}</p>}
    {notice&&<p role="status" className="mb-5 rounded-xl bg-[#e7f8f4] p-4 text-sm text-[#167c68]">{notice}</p>}
    <div className="mb-5 grid gap-4 sm:grid-cols-3">
      <MetricCard label="未完成" value={String(open.length)} icon={<ListTodo size={19}/>}/>
      <MetricCard label="已逾期" value={String(overdue.length)} tone={overdue.length?"red":"green"} icon={<Clock3 size={19}/>}/>
      <MetricCard label="已完成" value={String(tasks.length-open.length)} tone="green" icon={<CheckCircle2 size={19}/>}/>
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(310px,1fr)]">
      <SectionCard title="任务列表" sub="按当前店铺查看，已完成任务保留记录" action={<select aria-label="筛选任务状态" value={filter} onChange={e=>setFilter(e.target.value as Status|"all")} className="rounded-xl border border-[#e3eaf1] bg-white px-3 py-2 text-xs"><option value="all">全部</option>{Object.entries(statusName).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>}>
        {loading?<p className="text-sm text-[#8194a8]">正在读取云端待办…</p>:visible.length===0?<p className="text-sm text-[#8194a8]">暂无任务，可在右侧创建。</p>:<div className="space-y-3">{visible.map(task=>{const late=task.status!=="done"&&!!task.due_date&&task.due_date<today;return <div key={task.id} className="rounded-2xl border border-[#e9eef3] p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-[#26374c]">{task.title}</h3><p className="mt-1 text-xs text-[#8c9aaa]">{statusName[task.status]} · {priorityName[task.priority]}优先级 {task.due_date?`· 截止 ${task.due_date}`:""} {late&&<span className="font-semibold text-[#e85d65]">· 已逾期</span>}</p></div>{canEdit&&<div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>startEdit(task)}>编辑</Button><Button size="sm" variant="outline" disabled={busy} aria-label={`删除 ${task.title}`} onClick={()=>void remove(task)}><Trash2 size={14}/></Button></div>}</div>
          {task.detail&&<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#66788b]">{task.detail}</p>}
          {canEdit&&<div className="mt-3 flex gap-2">{task.status!=="doing"&&task.status!=="done"&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void changeStatus(task,"doing")}>开始处理</Button>}{task.status!=="done"?<Button size="sm" variant="outline" disabled={busy} onClick={()=>void changeStatus(task,"done")}>标记完成</Button>:<Button size="sm" variant="outline" disabled={busy} onClick={()=>void changeStatus(task,"todo")}>重新打开</Button>}</div>}
        </div>;})}</div>}
      </SectionCard>
      <SectionCard title={editing?"编辑任务":"新建任务"} sub="补货、活动准备、售后跟进都可以记录">
        {!canEdit?<p className="text-sm text-[#8194a8]">当前账号仅能查看任务，或当前为本地演示模式。</p>:<form onSubmit={save} className="space-y-4">
          <div><label htmlFor="task-title" className="text-sm font-medium">标题</label><Input id="task-title" maxLength={160} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="mt-2" placeholder="例如：检查洗衣液库存" required/></div>
          <div><label htmlFor="task-detail" className="text-sm font-medium">说明</label><Textarea id="task-detail" maxLength={1000} value={form.detail} onChange={e=>setForm({...form,detail:e.target.value})} className="mt-2" placeholder="补充背景或处理步骤"/></div>
          <div className="grid grid-cols-2 gap-3"><div><label htmlFor="task-priority" className="text-sm font-medium">优先级</label><select id="task-priority" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Priority})} className="mt-2 h-10 w-full rounded-xl border border-[#e3eaf1] bg-white px-3 text-sm">{Object.entries(priorityName).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div><div><label htmlFor="task-status" className="text-sm font-medium">状态</label><select id="task-status" value={form.status} onChange={e=>setForm({...form,status:e.target.value as Status})} className="mt-2 h-10 w-full rounded-xl border border-[#e3eaf1] bg-white px-3 text-sm">{Object.entries(statusName).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div></div>
          <div><label htmlFor="task-due" className="text-sm font-medium">截止日期（可选）</label><Input id="task-due" type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})} className="mt-2"/></div>
          <div className="flex gap-2"><Button disabled={busy||!form.title.trim()}><Plus size={16}/>{busy?"保存中…":editing?"保存修改":"创建任务"}</Button>{editing&&<Button type="button" variant="outline" onClick={()=>{setEditing(null);setForm(blank);}}>取消</Button>}</div>
        </form>}
      </SectionCard>
    </div>
  </>;
}
