"use client";
import { AppSelect } from "@/components/ui/app-select";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Clock3, ListTodo, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { MetricCard, PageHead, SectionCard } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type OperationTask, operationsRequest } from "@/lib/operations";
import { AiInsightPanel } from "@/components/ai-insight-panel";
type Status=OperationTask["status"];
type Priority=OperationTask["priority"];
type TaskRange="all"|"overdue"|"today"|"next7"|"no_due";
const statusName:Record<Status,string>={todo:"待处理",doing:"进行中",done:"已完成"};
const priorityName:Record<Priority,string>={low:"低",normal:"普通",high:"高"};
const taskSourceHref=(task:OperationTask)=>{
  if(!task.source_module||!task.source_id)return null;
  const routes={notes:"/notes",experiments:"/experiments",competitors:"/competitors","service-cases":"/service","copilot-conversations":"/copilot"} as const;
  const query=task.source_module==="copilot-conversations"?"conversation":"id";
  return {href:`${routes[task.source_module]}?${query}=${encodeURIComponent(task.source_id)}`,label:{notes:"笔记中心",experiments:"运营实验",competitors:"竞品档案","service-cases":"售后工单","copilot-conversations":"AI 对话"}[task.source_module]};
};
const blank={title:"",detail:"",priority:"normal" as Priority,status:"todo" as Status,dueDate:""};
function addTaskDays(day:string,count:number){const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+count);return date.toISOString().slice(0,10);}
const quickTasks=[
  {label:"核对库存",title:"核对热销商品库存",detail:"检查各 SKU 可售库存与预警线，确认是否需要补货。",priority:"high" as Priority},
  {label:"检查推广",title:"复盘近 7 天推广效果",detail:"核对广告消耗、归因成交与 ROAS，暂停明显低效计划并记录调整。",priority:"normal" as Priority},
  {label:"跟进售后",title:"处理待跟进售后",detail:"查看退款与售后原因，优先处理临近超时的订单。",priority:"high" as Priority},
  {label:"准备活动",title:"检查活动商品与价格",detail:"确认活动库存、商品价格、优惠设置和活动页面信息。",priority:"normal" as Priority},
];
type Feedback={success:boolean;title:string;message:string};
export default function TasksPage(){
  const {mode,activeStoreId,role,data,update}=useApp();
  const [tasks,setTasks]=useState<OperationTask[]>([]);const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [feedback,setFeedback]=useState<Feedback|null>(null);
  const [filter,setFilter]=useState<Status|"all">("all");const [range,setRange]=useState<TaskRange>("all");const [query,setQuery]=useState("");const [editing,setEditing]=useState<string|null>(null);
  const [form,setForm]=useState(blank);
  const today=data?new Intl.DateTimeFormat("en-CA",{timeZone:data.settings.store.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()):"";
  const load=useCallback(async():Promise<boolean>=>{
    if(mode==="local") { setLoading(false); setError(""); setTasks(data?.tasks||[]); return true; }
    if(!activeStoreId)return false;
    setLoading(true);setError("");
    try{const result=await operationsRequest<{tasks:OperationTask[]}>(activeStoreId,"tasks");setTasks(result.tasks);return true;}
    catch(cause){setError(cause instanceof Error?cause.message:"待办读取失败");return false;}
    finally{setLoading(false);}
  },[activeStoreId,mode,data?.tasks]);
  useEffect(()=>{queueMicrotask(()=>{setTasks([]);void load();});},[load]);
  const canEdit=mode==="local"||role!=="viewer";
  function startEdit(task:OperationTask){setEditing(task.id);setForm({title:task.title,detail:task.detail,priority:task.priority,status:task.status,dueDate:task.due_date||""});}
  async function save(event:React.FormEvent){
    event.preventDefault();if(!activeStoreId)return;
    setBusy(true);setError("");setFeedback(null);
    try{
      const payload={...form,title:form.title.trim(),detail:form.detail.trim(),dueDate:form.dueDate||null,...(editing?{id:editing}:{})};
      if(mode==="local"){
        const now=new Date().toISOString();
        await update(current=>{
          const previous=editing?(current.tasks||[]).find(task=>task.id===editing):undefined;
          const next:OperationTask={...previous,id:editing||crypto.randomUUID(),title:payload.title,detail:payload.detail,priority:payload.priority,status:payload.status,due_date:payload.dueDate,created_at:previous?.created_at||now,updated_at:now,completed_at:payload.status==="done"?(previous?.completed_at||now):null};
          return {...current,tasks:editing?(current.tasks||[]).map(task=>task.id===editing?next:task):[next,...(current.tasks||[])]};
        });
      } else {
        if(!activeStoreId)throw new Error("未找到当前店铺");
        if(editing){await operationsRequest(activeStoreId,"tasks",payload,"PATCH");}
        else{const created=await operationsRequest<OperationTask>(activeStoreId,"tasks",payload,"POST");setTasks(current=>[created,...current.filter(task=>task.id!==created.id)]);}
      }
      const title=form.title.trim();setEditing(null);setForm(blank);
      const refreshed=await load();
      const location=mode==="local"?"当前设备":"云端";
      setFeedback({success:true,title:editing?"任务已更新":"任务已创建",message:refreshed?`“${title}”已保存到${location}，并显示在任务列表中。`:`“${title}”已保存到${location}；列表暂时无法刷新，稍后点击刷新即可重新读取。`});
    }catch(cause){const message=cause instanceof Error?cause.message:"保存失败，请检查网络后重试。";setError(message);setFeedback({success:false,title:editing?"任务更新失败":"任务创建失败",message});}
    finally{setBusy(false);}
  }
  async function changeStatus(task:OperationTask,status:Status){
    setBusy(true);setError("");
    try{if(mode==="local")await update(current=>({...current,tasks:(current.tasks||[]).map(item=>item.id===task.id?{...item,status,updated_at:new Date().toISOString(),completed_at:status==="done"?(item.completed_at||new Date().toISOString()):null}:item)}));else{if(!activeStoreId)throw new Error("未找到当前店铺");await operationsRequest(activeStoreId,"tasks",{id:task.id,title:task.title,detail:task.detail,priority:task.priority,status,dueDate:task.due_date},"PATCH");}await load();setFeedback({success:true,title:"任务状态已更新",message:`“${task.title}”已设为${statusName[status]}。`});}
    catch(cause){const message=cause instanceof Error?cause.message:"更新失败，请重试。";setError(message);setFeedback({success:false,title:"更新失败",message});}
    finally{setBusy(false);}
  }
  async function remove(task:OperationTask){
    if((mode==="cloud"&&!activeStoreId)||!window.confirm(`确定删除“${task.title}”吗？`))return;
    setBusy(true);setError("");
    try{if(mode==="local")await update(current=>({...current,tasks:(current.tasks||[]).filter(item=>item.id!==task.id)}));else await operationsRequest(activeStoreId!,"tasks",{id:task.id},"DELETE");await load();setFeedback({success:true,title:"任务已删除",message:`“${task.title}”已从${mode==="local"?"本机":"云端"}任务列表删除。`});}
    catch(cause){const message=cause instanceof Error?cause.message:"删除失败，请重试。";setError(message);setFeedback({success:false,title:"删除失败",message});}
    finally{setBusy(false);}
  }
  const open=tasks.filter(task=>task.status!=="done");
  const overdue=open.filter(task=>task.due_date&&task.due_date<today);
  const dueSoonLimit = today ? (() => { const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 3); return date.toISOString().slice(0,10); })() : "";
  const visible=tasks.filter(task=>{
    if(filter!=="all"&&task.status!==filter)return false;
    const text=`${task.title} ${task.detail} ${task.priority}`.toLocaleLowerCase();
    if(query.trim()&&!text.includes(query.trim().toLocaleLowerCase()))return false;
    if(range==="overdue")return task.status!=="done"&&!!task.due_date&&task.due_date<today;
    if(range==="today")return task.status!=="done"&&task.due_date===today;
    if(range==="next7")return task.status!=="done"&&!!task.due_date&&task.due_date>=today&&task.due_date<=addTaskDays(today,7);
    if(range==="no_due")return task.status!=="done"&&!task.due_date;
    return true;
  }).sort((a,b)=>{
    const urgency=(task:OperationTask)=>task.status==="done"?3:task.due_date&&task.due_date<today?0:task.priority==="high"?1:task.priority==="normal"?2:3;
    return urgency(a)-urgency(b)||(a.due_date||"9999-99-99").localeCompare(b.due_date||"9999-99-99")||b.updated_at.localeCompare(a.updated_at);
  });
  return <>
    <PageHead eyebrow="TASKS / 运营待办" title="让每天的运营更有条理" description={mode==="local"?"任务仅保存在当前设备，可随本地数据备份或迁移到云端。":"记录补货、推广、售后等任务，按店铺同步给团队成员。"} action={<Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>刷新</Button>}/>
    {error&&<p role="alert" className="mb-5 rounded-xl bg-[var(--mc-tint-red)] p-4 text-sm text-[var(--mc-color-danger)]">{error}</p>}
    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="未完成" value={String(open.length)} icon={<ListTodo size={19}/>}/>
      <MetricCard label="已逾期" value={String(overdue.length)} tone={overdue.length?"red":"green"} icon={<Clock3 size={19}/>}/>
      <MetricCard label="今日到期" value={String(open.filter(task=>task.due_date===today).length)} tone={open.some(task=>task.due_date===today)?"red":"blue"} icon={<Clock3 size={19}/>}/>
      <MetricCard label="已完成" value={String(tasks.length-open.length)} tone="green" icon={<CheckCircle2 size={19}/>}/>
    </div>
    <AiInsightPanel feature="tasks" context={{ totalTasks: tasks.length, openTasks: open.length, overdueTasks: overdue.length, doingTasks: tasks.filter(task=>task.status==="doing").length, highPriorityOpen: open.filter(task=>task.priority==="high").length, dueSoon: open.filter(task=>task.due_date&&task.due_date>=today&&task.due_date<=dueSoonLimit).length }} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(310px,1fr)]">
      <SectionCard title="任务列表" sub="紧急任务优先展示；可按日期、状态和关键词快速定位" action={<div className="flex flex-wrap gap-2"><AppSelect aria-label="筛选任务状态" value={filter} onChange={e=>setFilter(e.target.value as Status|"all")} className="rounded-xl border border-border bg-card px-3 py-2 text-xs"><option value="all">全部状态</option>{Object.entries(statusName).map(([value,label])=><option key={value} value={value}>{label}</option>)}</AppSelect><AppSelect aria-label="筛选任务日期" value={range} onChange={e=>setRange(e.target.value as TaskRange)} className="rounded-xl border border-border bg-card px-3 py-2 text-xs"><option value="all">所有日期</option><option value="overdue">已逾期</option><option value="today">今日到期</option><option value="next7">未来 7 天</option><option value="no_due">未设置日期</option></AppSelect></div>}>
        <label className="relative mb-4 block"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/><Input aria-label="搜索任务" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索任务标题或说明" className="pl-9"/></label>
        {loading?<p className="text-sm text-muted-foreground">正在读取云端待办…</p>:visible.length===0?<p className="text-sm text-muted-foreground">没有符合条件的任务。试试清除筛选，或在右侧创建任务。</p>:<div className="space-y-3">{visible.map(task=>{const late=task.status!=="done"&&!!task.due_date&&task.due_date<today;const source=taskSourceHref(task);return <div key={task.id} className="rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-foreground">{task.title}</h3><p className="mt-1 text-xs text-muted-foreground">{statusName[task.status]} · {priorityName[task.priority]}优先级 {task.due_date?`· 截止 ${task.due_date}`:""} {late&&<span className="font-semibold text-[var(--mc-color-danger)]">· 已逾期</span>} {task.recommendation_key&&<span className="font-semibold text-primary">· 智能建议跟进</span>}</p></div>{canEdit&&<div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>startEdit(task)}>编辑</Button><Button size="sm" variant="outline" disabled={busy} aria-label={`删除 ${task.title}`} onClick={()=>void remove(task)}><Trash2 size={14}/></Button></div>}</div>
          {task.detail&&<p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{task.detail}</p>}
          {source&&<Link href={source.href} className="mt-2 inline-flex text-xs font-medium text-primary hover:underline">返回来源：{source.label}</Link>}
          {canEdit&&<div className="mt-3 flex gap-2">{task.status!=="doing"&&task.status!=="done"&&<Button size="sm" variant="outline" disabled={busy} onClick={()=>void changeStatus(task,"doing")}>开始处理</Button>}{task.status!=="done"?<Button size="sm" variant="outline" disabled={busy} onClick={()=>void changeStatus(task,"done")}>标记完成</Button>:<Button size="sm" variant="outline" disabled={busy} onClick={()=>void changeStatus(task,"todo")}>重新打开</Button>}</div>}
        </div>;})}</div>}
      </SectionCard>
      <SectionCard title={editing?"编辑任务":"新建任务"} sub="补货、活动准备、售后跟进都可以记录">
        {!canEdit?<p className="text-sm text-muted-foreground">当前账号仅能查看任务，或当前为本地演示模式。</p>:<form onSubmit={save} className="space-y-4">
          {!editing&&<div><p className="mb-2 text-xs font-medium text-muted-foreground">快速套用模板</p><div className="flex flex-wrap gap-2">{quickTasks.map(template=><Button key={template.label} type="button" size="sm" variant="outline" disabled={busy} onClick={()=>setForm(current=>({...current,...template}))}>{template.label}</Button>)}</div></div>}
          <div><label htmlFor="task-title" className="text-sm font-medium">标题</label><Input id="task-title" maxLength={160} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="mt-2" placeholder="例如：检查洗衣液库存" required/></div>
          <div><label htmlFor="task-detail" className="text-sm font-medium">说明</label><Textarea id="task-detail" maxLength={1000} value={form.detail} onChange={e=>setForm({...form,detail:e.target.value})} className="mt-2" placeholder="补充背景或处理步骤"/></div>
          <div className="grid grid-cols-2 gap-3"><div><label htmlFor="task-priority" className="text-sm font-medium">优先级</label><AppSelect id="task-priority" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value as Priority})} className="mt-2 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm">{Object.entries(priorityName).map(([value,label])=><option key={value} value={value}>{label}</option>)}</AppSelect></div><div><label htmlFor="task-status" className="text-sm font-medium">状态</label><AppSelect id="task-status" value={form.status} onChange={e=>setForm({...form,status:e.target.value as Status})} className="mt-2 h-10 w-full rounded-xl border border-border bg-card px-3 text-sm">{Object.entries(statusName).map(([value,label])=><option key={value} value={value}>{label}</option>)}</AppSelect></div></div>
          <div><label htmlFor="task-due" className="text-sm font-medium">截止日期（可选）</label><Input id="task-due" type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})} className="mt-2"/></div>
          <div className="flex gap-2"><Button type="submit" loading={busy} disabled={busy||!form.title.trim()}>{!busy&&<Plus size={16} />}{busy?"保存中…":editing?"保存修改":"创建任务"}</Button>{editing&&<Button type="button" variant="outline" onClick={()=>{setEditing(null);setForm(blank);}}>取消</Button>}</div>
        </form>}
      </SectionCard>
    </div>
    <Dialog open={feedback!==null} onOpenChange={open=>{if(!open)setFeedback(null);}}>
      <DialogContent className="rounded-3xl border border-border p-6 sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-start sm:text-left">
          <span className={`mb-2 grid size-12 place-items-center rounded-2xl ${feedback?.success?"bg-[var(--mc-tint-green)] text-[var(--mc-color-success)]":"bg-[var(--mc-tint-red)] text-[var(--mc-color-danger)]"}`}>{feedback?.success?<CheckCircle2 size={25}/>:<CircleAlert size={25}/>}</span>
          <DialogTitle className="text-lg font-semibold text-foreground">{feedback?.title}</DialogTitle>
          <DialogDescription className="leading-6 text-muted-foreground">{feedback?.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2 border-0 bg-transparent p-0 sm:justify-end">
          <Button type="button" onClick={()=>setFeedback(null)}>知道了</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
