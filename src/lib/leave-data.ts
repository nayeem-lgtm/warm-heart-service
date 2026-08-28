import { employees } from "@/lib/employee-data";

export type LeaveType = "PTO" | "Unpaid";
export type LeaveStatus = "Pending" | "Approved" | "Denied" | "Cancelled";

export type LeaveFeedback = {
  id: string;
  author: string;
  role?: "admin" | "employee";
  text: string;
  at: string;
};

export type LeaveRequest = {
  id: string;
  employeeId: string;
  employee: string;
  designation: string;
  department: string;
  type: LeaveType;
  from: string; // yyyy-MM-dd
  to: string;
  days: number;
  status: LeaveStatus;
  appliedAt: string; // ISO
  reason: string;
  documents: string[];
  feedback: LeaveFeedback[];
};

export const leaveTypes: LeaveType[] = ["PTO", "Unpaid"];
export const leaveStatuses: LeaveStatus[] = ["Pending", "Approved", "Denied", "Cancelled"];

export const leaveTypeTone: Record<LeaveType, string> = {
  PTO: "bg-primary/15 text-primary border-primary/30",
  Unpaid: "bg-muted text-muted-foreground border-border",
};

/** annual entitlement per employee */
export const ANNUAL_ALLOWANCE = 15;
export const MONTHLY_CAP = 2;

const pad = (n: number) => String(n).padStart(2, "0");
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const reasons = [
  "Family commitment out of town, will hand over pending tasks before leaving.",
  "Feeling unwell since last night, need a day of rest as advised.",
  "Attending a close relative's wedding ceremony.",
  "Personal errand that can only be done on a working day.",
  "Recovering from fever, doctor advised one day off.",
  "Travelling back to hometown, returning the same week.",
];

export function generateLeaveRequests(today: Date): LeaveRequest[] {
  const rows: LeaveRequest[] = [];
  let n = 0;
  for (let i = 0; i < 46; i++) {
    const emp = employees[i % employees.length]!;
    const r1 = rand(i + 1);
    const r2 = rand(i + 21);
    const r3 = rand(i + 41);

    const offset = Math.floor(r1 * 70) - 8; // some upcoming, most past
    const start = new Date(today);
    start.setDate(start.getDate() - offset);
    const days = r2 > 0.86 ? 3 : r2 > 0.62 ? 2 : 1;
    const end = new Date(start);
    end.setDate(end.getDate() + days - 1);

    const applied = new Date(start);
    applied.setDate(applied.getDate() - (1 + Math.floor(r3 * 4)));
    applied.setHours(9 + Math.floor(r1 * 10), Math.floor(r3 * 59), 0, 0);

    const status: LeaveStatus =
      start > today ? (r3 > 0.45 ? "Pending" : "Approved") : r3 > 0.9 ? "Denied" : r3 < 0.06 ? "Cancelled" : "Approved";

    const type: LeaveType = r2 > 0.28 ? "PTO" : "Unpaid";

    rows.push({
      id: `lv-${++n}`,
      employeeId: emp.id,
      employee: `${emp.firstName} ${emp.lastName}`,
      designation: emp.designation,
      department: emp.department,
      type,
      from: dateKey(start),
      to: dateKey(end),
      days,
      status,
      appliedAt: applied.toISOString(),
      reason: reasons[i % reasons.length]!,
      documents: r1 > 0.7 ? ["medical-certificate.pdf"] : [],
      feedback:
        status === "Denied"
          ? [
              {
                id: `fb-${n}`,
                author: "HR Admin",
                text: "Team coverage is not available on these dates, please reschedule.",
                at: applied.toISOString(),
              },
            ]
          : [],
    });
  }
  return rows.sort((a, b) => b.appliedAt.localeCompare(a.appliedAt));
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** approved days used this calendar year for an employee */
export function usedDays(rows: LeaveRequest[], employeeId: string, year: number) {
  return rows
    .filter((r) => r.employeeId === employeeId && r.status === "Approved" && r.from.startsWith(String(year)))
    .reduce((s, r) => s + r.days, 0);
}
