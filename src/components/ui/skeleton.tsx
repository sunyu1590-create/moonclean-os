import { cn } from "cn";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden="true" className={cn("mc-skeleton rounded-lg", className)} {...props} />;
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return <div role="status" aria-label="正在加载数据列表" className="mc-table-skeleton space-y-2.5 py-1">
    <span className="sr-only">正在加载数据列表…</span>
    <div className="grid gap-3 border-b border-[#edf2f7] pb-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns }, (_, index) => <Skeleton key={`head-${index}`} className="h-3 w-3/5" />)}
    </div>
    {Array.from({ length: rows }, (_, row) => <div key={row} className="grid items-center gap-3 rounded-xl border border-[#eef2f6] px-3 py-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {Array.from({ length: columns }, (_, column) => <Skeleton key={column} className={cn("h-3", column === 0 ? "w-4/5" : "w-3/5")} />)}
    </div>)}
  </div>;
}
