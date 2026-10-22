"use client";
import { AppSelect } from "@/components/ui/app-select";
import { useEffect, useState } from "react";
import { Users, UserPlus, Trash2, Crown, RefreshCw } from "lucide-react";
import { useApp } from "./app-provider";
import { SectionCard } from "./common";
import { Button } from "@/components/ui/button";
import { notifyFeedback } from "@/lib/feedback";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
interface Member {
  user_id: string;
  email: string;
  display_name: string;
  role: "owner" | "admin" | "editor" | "viewer";
  created_at: string;
}
export function TeamPanel() {
  const { activeStoreId, role, retry } = useApp();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "editor" | "viewer">(
    "editor",
  );
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<Member | null>(null);
  const [transfer, setTransfer] = useState<Member | null>(null);
  async function load() {
    if (
      !activeStoreId ||
      !(["owner", "admin"] as string[]).includes(role || "")
    )
      return;
    const response = await fetch(`/api/stores/${activeStoreId}/members`, {
      cache: "no-store",
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "加载成员失败");
    setMembers(body.members || []);
  }
  useEffect(() => {
    let active = true;
    if (!activeStoreId || (role !== "owner" && role !== "admin")) return;
    fetch(`/api/stores/${activeStoreId}/members`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        if (active) setMembers(body.members || []);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "加载成员失败");
      });
    return () => {
      active = false;
    };
  }, [activeStoreId, role]);
  async function act(input: unknown) {
    if (!activeStoreId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/stores/${activeStoreId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "操作失败");
      await load();
      await retry();
      setMessage("成员设置已保存");
      notifyFeedback({ kind: "success", title: "成员设置已更新", description: "权限变更已同步到当前店铺。" });
      setEmail("");
      setRemove(null);
      setTransfer(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
      notifyFeedback({ kind: "error", title: "成员操作失败", description: cause instanceof Error ? cause.message : "请重试。" });
    } finally {
      setBusy(false);
    }
  }
  if (role !== "owner" && role !== "admin") return null;
  return (
    <>
      <SectionCard
        title="团队成员"
        sub="成员可加入多个店铺，权限仅作用于当前店铺"
        action={<Users size={19} className="text-primary" />}
      >
        <div className="mb-5 grid gap-2 sm:grid-cols-[1fr_130px_auto]">
          <Input
            type="email"
            placeholder="输入成员注册并验证过的邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <AppSelect
            aria-label="成员角色"
            className="h-9 rounded-md border border-border bg-card px-2 text-sm"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as typeof newRole)}
          >
            {role === "owner" && <option value="admin">管理员</option>}
            <option value="editor">编辑者</option>
            <option value="viewer">查看者</option>
          </AppSelect>
          <Button
            disabled={busy || !email.trim()}
            onClick={() => void act({ action: "upsert", email, role: newRole })}
          >
            <UserPlus size={15} />
            添加或更新
          </Button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          成员需先注册并验证邮箱；已添加的成员再次提交会更新其角色。管理员仅能管理编辑者和查看者。
        </p>
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.user_id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 text-sm"
            >
              <div>
                <strong>{member.display_name || member.email}</strong>
                <p className="mt-0.5 text-xs text-muted-foreground">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--mc-tint-blue)] px-2.5 py-1 text-xs text-primary">
                  {member.role}
                </span>
                {member.role !== "owner" &&
                  (role === "owner" || member.role !== "admin") && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`移除 ${member.email}`}
                      onClick={() => setRemove(member)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  )}
                {role === "owner" && member.role !== "owner" && (
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`转移所有权给 ${member.email}`}
                    onClick={() => setTransfer(member)}
                  >
                    <Crown size={15} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-[var(--mc-color-danger)]">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mt-4 text-sm text-[var(--mc-color-success)]">
            {message}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => void load().catch(cause => setError(cause instanceof Error ? cause.message : "刷新失败"))}
        >
          <RefreshCw size={14} />
          刷新成员
        </Button>
      </SectionCard>
      <AlertDialog open={!!remove} onOpenChange={(v) => !v && setRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>移除店铺成员？</AlertDialogTitle>
            <AlertDialogDescription>
              「{remove?.email}」将立即失去此店铺的访问权限，不影响其其他店铺。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                if (remove) void act({ action: "remove", email: remove.email });
              }}
            >
              确认移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!transfer}
        onOpenChange={(v) => !v && setTransfer(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认转移店铺所有权？</AlertDialogTitle>
            <AlertDialogDescription>
              所有权将转给「{transfer?.email}
              」。您会变为管理员；只有新所有者能再次转移所有权。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                if (transfer)
                  void act({
                    action: "transfer",
                    targetUserId: transfer.user_id,
                  });
              }}
            >
              确认转移
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
