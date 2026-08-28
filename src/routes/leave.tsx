import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarDays,
  CalendarClock,
  Check,
  CircleSlash,
  FileText,
  Hourglass,
  Paperclip,
  Plane,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusPill } from "@/components/shared/StatusPill";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { departments } from "@/lib/employee-data";
import { cn } from "@/lib/utils";
import {
  ANNUAL_ALLOWANCE,
  MONTHLY_CAP,
  dateKey,
  formatDate,
  formatDateTime,
  generateLeaveRequests,
  initials,
  leaveStatuses,
  leaveTypeTone,
  leaveTypes,
  usedDays,
  type LeaveRequest,
} from "@/lib/leave-data";

export const Route = createFileRoute("/leave")({
  head: () => ({
    meta: [
      { title: "Leave — OmniWork" },
      {
        name: "description",
        content: "Review, approve and track employee leave requests, balances and upcoming time off.",
      },
      { property: "og:title", content: "Leave — OmniWork" },
      {
        property: "og:description",
        content: "Review, approve and track employee leave requests, balances and upcoming time off.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
      {initials(name)}
    </span>
  );
}

function TypePill({ type }: { type: LeaveRequest["type"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        leaveTypeTone[type],
      )}
    >
      {type}
    </span>
  );
}

function Page() {
  const [today, setToday] = useState<Date | null>(null);
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [view, setView] = useState<"admin" | "employee">("admin");
  const [me, setMe] = useState<string>("");

  useEffect(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setToday(d);
    const generated = generateLeaveRequests(d);
    setRows(generated);
    setMe(generated[0]?.employee ?? "");
  }, []);

  const todayKey = today ? dateKey(today) : "";
  const year = today?.getFullYear() ?? new Date().getFullYear();

  const stats = useMemo(() => {
    const pending = rows.filter((r) => r.status === "Pending");
    const onLeave = rows.filter((r) => r.status === "Approved" && r.from <= todayKey && r.to >= todayKey);
    const upcoming = rows.filter((r) => r.status === "Approved" && r.from > todayKey);
    const approvedDays = rows
      .filter((r) => r.status === "Approved" && r.from.startsWith(String(year)))
      .reduce((s, r) => s + r.days, 0);
    return { pending: pending.length, onLeave: onLeave.length, upcoming: upcoming.length, approvedDays };
  }, [rows, todayKey, year]);

  const employeeOptions = useMemo(
    () => Array.from(new Set(rows.map((r) => r.employee))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const outToday = useMemo(
    () => rows.filter((r) => r.status === "Approved" && r.from <= todayKey && r.to >= todayKey),
    [rows, todayKey],
  );

  const isEmployeeView = view === "employee";
  const visibleRows = useMemo(
    () => (isEmployeeView ? rows.filter((r) => r.employee === me) : rows),
    [rows, isEmployeeView, me],
  );

  const active = rows.find((r) => r.id === openId) ?? null;

  /** an employee may withdraw a request that has not started yet and is not already closed */
  const canWithdraw = (r: LeaveRequest) =>
    (r.status === "Pending" || r.status === "Approved") && r.from > todayKey;

  const withdraw = (id: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "Cancelled",
              feedback: [
                ...r.feedback,
                {
                  id: `fb-${Date.now()}`,
                  author: r.employee,
                  role: "employee" as const,
                  text: "Leave request withdrawn by the employee.",
                  at: new Date().toISOString(),
                },
              ],
            }
          : r,
      ),
    );
    toast.info("Leave request withdrawn");
  };

  const decide = (id: string, status: "Approved" | "Denied") => {
    const note = comment.trim();
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              feedback: [
                ...r.feedback,
                {
                  id: `fb-${Date.now()}`,
                  author: "HR Admin",
                  text: note ? `${status}: ${note}` : `Request ${status.toLowerCase()} by HR Admin.`,
                  at: new Date().toISOString(),
                },
              ],
            }
          : r,
      ),
    );
    setComment("");
    const row = rows.find((r) => r.id === id);
    if (status === "Approved") toast.success(`Leave approved for ${row?.employee ?? "employee"}`);
    else toast.error(`Leave rejected for ${row?.employee ?? "employee"}`);
  };

  const reopen = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Pending" } : r)));
    toast.info("Request reopened — it is pending again");
  };

  const postFeedback = (id: string) => {
    if (!comment.trim()) return;
    setRows((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              feedback: [
                ...r.feedback,
                {
                  id: `fb-${Date.now()}`,
                  author: isEmployeeView ? r.employee : "HR Admin",
                  role: (isEmployeeView ? "employee" : "admin") as "employee" | "admin",
                  text: comment.trim(),
                  at: new Date().toISOString(),
                },
              ],
            }
          : r,
      ),
    );
    setComment("");
    toast.success(isEmployeeView ? "Comment sent to HR" : "Comment sent to the employee");
  };


  const columns: Column<LeaveRequest>[] = [
    {
      key: "employee",
      header: "Employee",
      searchable: true,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <Avatar name={r.employee} />
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.employee}</p>
            <p className="truncate text-xs text-muted-foreground">{r.designation}</p>
          </div>
        </div>
      ),
    },
    { key: "type", header: "Leave Type", accessor: (r) => r.type, cell: (r) => <TypePill type={r.type} /> },
    {
      key: "dates",
      header: "Leave Dates",
      accessor: (r) => r.from,
      cell: (r) => (
        <span className="whitespace-nowrap text-foreground">
          {formatDate(r.from)}
          {r.to !== r.from && ` – ${formatDate(r.to)}`}
        </span>
      ),
    },
    { key: "days", header: "Days", accessor: (r) => r.days, cell: (r) => <span className="tabular-nums">{r.days}</span> },
    { key: "status", header: "Status", accessor: (r) => r.status, cell: (r) => <StatusPill status={r.status} /> },
    {
      key: "appliedAt",
      header: "Applied Date",
      accessor: (r) => r.appliedAt,
      cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.appliedAt)}</span>,
    },
    { key: "department", header: "Department", accessor: (r) => r.department, className: "hidden" },
    {
      key: "actions",
      header: "Actions",
      cell: (r) =>
        isEmployeeView ? (
          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {canWithdraw(r) && (
              <Button size="sm" variant="destructive" onClick={() => withdraw(r.id)}>
                <Undo2 className="size-3.5" /> Withdraw
              </Button>
            )}
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => {
                setOpenId(r.id);
                setComment("");
              }}
            >
              Comments
            </button>
          </div>
        ) : r.status === "Pending" ? (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" onClick={() => decide(r.id, "Approved")}>
              <Check className="size-3.5" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={() => decide(r.id, "Denied")}>
              <X className="size-3.5" /> Deny
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              setOpenId(r.id);
              setComment("");
            }}
          >
            Add note
          </button>
        ),
    },

  ];

  const used = active ? usedDays(rows, active.employeeId, year) : 0;

  return (
    <AppShell>
      <PageHeader title="Leave" description="Review requests, track balances and keep an eye on who is off." />

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {(["admin", "employee"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                setOpenId(null);
                setComment("");
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "admin" ? "Admin view" : "Employee view"}
            </button>
          ))}
        </div>
        {isEmployeeView && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Viewing as
            <select
              value={me}
              onChange={(e) => setMe(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
            >
              {employeeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="text-xs text-muted-foreground">
          {isEmployeeView
            ? "Employees can comment on their own requests and withdraw upcoming leave."
            : "HR can decide requests and reply to employee comments."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Hourglass} label="Pending approval" value={stats.pending} caption="Awaiting a decision" highlight />
        <StatCard icon={Plane} label="Out today" value={stats.onLeave} caption="Currently on leave" />
        <StatCard icon={CalendarClock} label="Upcoming" value={stats.upcoming} caption="Approved future leave" />
        <StatCard icon={CalendarDays} label={`Days taken in ${year}`} value={stats.approvedDays} caption="Across all employees" />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-linear-to-r from-primary/12 via-card to-card p-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Who is out today</p>
            <p className="truncate text-xs text-muted-foreground">
              {outToday.length ? `${outToday.length} teammate(s) on approved leave` : "Everyone is in today"}
            </p>
          </div>
          <div className="flex shrink-0 -space-x-2">
            {outToday.slice(0, 6).map((r) => (
              <span
                key={r.id}
                title={`${r.employee} · ${r.type}`}
                className="flex size-9 items-center justify-center rounded-full border-2 border-card bg-primary/20 text-xs font-semibold text-primary"
              >
                {initials(r.employee)}
              </span>
            ))}
            {outToday.length > 6 && (
              <span className="flex size-9 items-center justify-center rounded-full border-2 border-card bg-secondary text-xs font-semibold text-muted-foreground">
                +{outToday.length - 6}
              </span>
            )}
          </div>
        </div>
        {outToday.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {outToday.map((r) => (
              <li key={`c-${r.id}`}>
                <button
                  type="button"
                  onClick={() => { setOpenId(r.id); setComment(""); }}
                  className="flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10"
                >
                  {r.employee}
                  <TypePill type={r.type} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <DataTable
          data={visibleRows}
          columns={columns}
          onRowClick={(r) => {
            setOpenId(r.id);
            setComment("");
          }}
          filters={[
            { key: "type", label: "Leave Type", options: leaveTypes },
            { key: "status", label: "Status", options: leaveStatuses },
            { key: "department", label: "Department", options: [...departments] },
            { key: "employee", label: "Employee", options: employeeOptions },
          ]}
          filterAccessor={(row, key) => String(row[key as keyof LeaveRequest] ?? "")}
          emptyMessage="No leave requests for this filter."
        />
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle>Leave Request Details</DialogTitle>
              </DialogHeader>

              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-base font-semibold text-primary">
                    {initials(active.employee)}
                  </span>
                  <div>
                    <p className="text-lg font-semibold text-foreground">{active.employee}</p>
                    <p className="text-sm text-muted-foreground">
                      {active.designation} · {active.department}
                    </p>
                  </div>
                </div>

                {isEmployeeView ? (
                  <div className="flex flex-col gap-4 rounded-xl border border-border bg-secondary/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Your request status</p>
                      <div className="mt-1"><StatusPill status={active.status} /></div>
                    </div>
                    {canWithdraw(active) ? (
                      <Button variant="destructive" onClick={() => withdraw(active.id)}>
                        <Undo2 className="size-4" /> Withdraw request
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Withdrawal is only possible before the leave start date.
                      </p>
                    )}
                  </div>
                ) : active.status === "Pending" ? (
                  <div className="flex flex-col gap-4 rounded-xl border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Hourglass className="size-4 text-warning" />
                        <p className="font-semibold text-foreground">Decision required</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        This request is pending. Approve it or deny it after reviewing the details below.
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="destructive" onClick={() => decide(active.id, "Denied")}>
                        <X className="size-4" /> Deny
                      </Button>
                      <Button onClick={() => decide(active.id, "Approved")}>
                        <Check className="size-4" /> Approve
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/40 p-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Decision</p>
                      <div className="mt-1"><StatusPill status={active.status} /></div>
                    </div>
                    <Button variant="outline" onClick={() => reopen(active.id)}>Reopen request</Button>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-info/25 bg-info/10 p-4">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-info/20 text-info">
                      <CalendarDays className="size-4" />
                    </span>
                    <p className="mt-3 text-sm text-muted-foreground">Days remaining</p>
                    <p className="text-2xl font-semibold text-foreground">{Math.max(0, ANNUAL_ALLOWANCE - used)}</p>
                  </div>
                  <div className="rounded-xl border border-primary/25 bg-primary/10 p-4">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/20 text-primary">
                      <CircleSlash className="size-4" />
                    </span>
                    <p className="mt-3 text-sm text-muted-foreground">Leave used</p>
                    <p className="text-2xl font-semibold text-foreground">
                      {used}/{ANNUAL_ALLOWANCE}
                    </p>
                    <p className="text-xs text-muted-foreground">Max {MONTHLY_CAP} day(s) per month</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                    <Field label="Status">
                      <StatusPill status={active.status} />
                    </Field>
                    <Field label="Leave type">
                      <TypePill type={active.type} />
                    </Field>
                    <Field label="Days requested">
                      <p className="text-sm text-foreground">{active.days}</p>
                    </Field>
                    <Field label="Applied date">
                      <p className="text-sm text-foreground">{formatDateTime(active.appliedAt)}</p>
                    </Field>
                    <Field label="Leave dates">
                      <p className="text-sm text-foreground">
                        {formatDate(active.from)} – {formatDate(active.to)}
                      </p>
                    </Field>
                    <Field label="Reason for leave">
                      <p className="text-sm leading-relaxed text-foreground">{active.reason}</p>
                    </Field>
                    <Field label="Supporting documents">
                      {active.documents.length ? (
                        <ul className="space-y-1">
                          {active.documents.map((d) => (
                            <li key={d} className="flex items-center gap-2 text-sm text-primary">
                              <Paperclip className="size-3.5" />
                              {d}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="size-3.5" /> None attached
                        </p>
                      )}
                    </Field>
                  </div>

                  <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                        {isEmployeeView ? "Comment for HR" : "Comment for employee"}
                      </p>
                      <Textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={
                          isEmployeeView ? "Reply to HR about this request…" : "Type a note for the employee…"
                        }
                        rows={4}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" disabled={!comment.trim()} onClick={() => postFeedback(active.id)}>
                        <MessageSquare className="size-4" /> Send comment
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isEmployeeView
                        ? "HR can see your comments and will reply in this same thread."
                        : active.status === "Pending"
                          ? "Any note typed above is attached to your decision."
                          : `This request is ${active.status.toLowerCase()}. You can still add comments or reopen it.`}
                    </p>

                    <div>
                      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Conversation</p>
                      {active.feedback.length ? (
                        <ul className="space-y-3">
                          {active.feedback.map((f) => {
                            const isAdmin = (f.role ?? "admin") === "admin";
                            return (
                              <li
                                key={f.id}
                                className={cn(
                                  "rounded-lg border p-3",
                                  isAdmin
                                    ? "border-border bg-secondary/40"
                                    : "border-primary/30 bg-primary/10",
                                )}
                              >
                                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-2">
                                    <span className="font-medium text-foreground">{f.author}</span>
                                    <span
                                      className={cn(
                                        "rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                                        isAdmin
                                          ? "border-border text-muted-foreground"
                                          : "border-primary/40 text-primary",
                                      )}
                                    >
                                      {isAdmin ? "HR" : "Employee"}
                                    </span>
                                  </span>
                                  <span>{formatDateTime(f.at)}</span>
                                </div>
                                <p className="mt-1 text-sm text-foreground">{f.text}</p>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No comments yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
