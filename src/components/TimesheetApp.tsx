"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type DayKey    = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
type BlockSource = "calendar" | "history" | "ai" | "manual";
type ViewMode  = "week" | "day";
type DayType   = "work" | "vacation" | "sick";

interface TimeBlock {
  id: string; project: string; from: string; to: string;
  note: string; isGhost: boolean; source: BlockSource; removing?: boolean;
}

interface DayData {
  key: DayKey; label: string; date: string; isoDate: string;
  blocks: TimeBlock[]; ghosts: TimeBlock[];
  submitted: boolean; type: DayType;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

const NAV_BG  = "#5A2C10";
const ORANGE  = "#E8622A";
const GREEN   = "#457B48";
const BG_PAGE = "#F6F5F3";
const BORDER  = "#E4E2DC";
const TEXT    = "#1A1917";
const TEXT_2  = "#595550";
const TEXT_3  = "#9A9590";

const VACATION_BG = "#FEF3C7";
const VACATION_FG = "#D97706";
const SICK_BG     = "#FEE2E2";
const SICK_FG     = "#DC2626";

const CAL_START = 7;
const CAL_END   = 20;
const HOUR_PX   = 60;

// ─── Mock data ────────────────────────────────────────────────────────────────

const PROJECTS = ["Project Alpha", "Project Beta", "Internal / Admin", "Client Workshop"] as const;
type Project = (typeof PROJECTS)[number];

const PROJECT_COLOR: Record<Project, string> = {
  "Project Alpha": "#3B7DD8", "Project Beta": "#7A5CBF",
  "Internal / Admin": "#7A8694", "Client Workshop": "#D4893A",
};
const PROJECT_BG: Record<Project, string> = {
  "Project Alpha": "#EDF4FF", "Project Beta": "#F3EEFF",
  "Internal / Admin": "#F4F5F6", "Client Workshop": "#FFF4E8",
};
const PROJECT_BUDGET: Record<Project, { total: number; used: number } | null> = {
  "Project Alpha": { total: 40, used: 22 }, "Project Beta": { total: 20, used: 8 },
  "Internal / Admin": null, "Client Workshop": { total: 16, used: 5 },
};

const PROJECT_TASKS: Record<Project, string[]> = {
  "Project Alpha":    ["Frontend Development", "Backend Development", "Code Review", "Bug Fixes", "Planning"],
  "Project Beta":     ["Feature Work", "Testing", "Documentation", "Sprint Tasks"],
  "Internal / Admin": ["Standup", "Team Meeting", "Admin", "Training", "1:1"],
  "Client Workshop":  ["Preparation", "Facilitation", "Follow-up", "Materials"],
};

// Coworkers who already logged similar entries (for nudge hints)
const COWORKER_NUDGES: Partial<Record<DayKey, Array<{ coworker: string; avatar: string; project: Project; task: string; hours: number }>>> = {
  Mon: [
    { coworker: "Sarah K.", avatar: "SK", project: "Internal / Admin", task: "Standup", hours: 0.5 },
    { coworker: "Tom H.",   avatar: "TH", project: "Project Alpha",    task: "Planning", hours: 1.5 },
  ],
  Tue: [
    { coworker: "Sarah K.", avatar: "SK", project: "Internal / Admin", task: "Standup", hours: 0.5 },
    { coworker: "Mia L.",   avatar: "ML", project: "Client Workshop",  task: "Facilitation", hours: 1 },
  ],
  Wed: [
    { coworker: "Tom H.",   avatar: "TH", project: "Internal / Admin", task: "Team Meeting", hours: 1 },
    { coworker: "Mia L.",   avatar: "ML", project: "Project Beta",     task: "Testing",      hours: 2 },
  ],
  Thu: [
    { coworker: "Sarah K.", avatar: "SK", project: "Internal / Admin", task: "Standup",      hours: 0.5 },
    { coworker: "Tom H.",   avatar: "TH", project: "Project Alpha",    task: "Planning",     hours: 1.5 },
    { coworker: "Mia L.",   avatar: "ML", project: "Project Alpha",    task: "Code Review",  hours: 2 },
  ],
  Fri: [
    { coworker: "Sarah K.", avatar: "SK", project: "Internal / Admin", task: "Standup", hours: 0.5 },
  ],
};

const CALENDAR_EVENTS: Record<DayKey, Array<{ project: Project; from: string; to: string; note: string }>> = {
  Mon: [
    { project: "Internal / Admin", from: "09:00", to: "09:30", note: "Standup" },
    { project: "Project Alpha",    from: "14:00", to: "15:30", note: "Design review" },
  ],
  Tue: [
    { project: "Internal / Admin", from: "09:00", to: "09:30", note: "Standup" },
    { project: "Client Workshop",  from: "11:00", to: "12:00", note: "Client call" },
  ],
  Wed: [
    { project: "Internal / Admin", from: "09:00", to: "09:30", note: "Standup" },
    { project: "Internal / Admin", from: "15:00", to: "16:00", note: "Retro" },
  ],
  Thu: [
    { project: "Internal / Admin", from: "09:00", to: "09:30", note: "Standup" },
    { project: "Project Alpha",    from: "10:00", to: "11:30", note: "Planning" },
  ],
  Fri: [{ project: "Internal / Admin", from: "09:00", to: "09:30", note: "Standup" }],
};

const PAST_ENTRIES: Partial<Record<DayKey, Array<{ project: Project; from: string; to: string; note: string }>>> = {
  Mon: [
    { project: "Project Alpha", from: "09:30", to: "12:00", note: "Development" },
    { project: "Project Beta",  from: "13:00", to: "17:00", note: "Feature work" },
  ],
  Tue: [
    { project: "Project Alpha",    from: "09:30", to: "13:00", note: "Development" },
    { project: "Internal / Admin", from: "14:00", to: "15:00", note: "Team sync" },
  ],
};

const MOCK_SUGGESTIONS: Record<DayKey, Array<{ project: Project; from: string; to: string; note: string }>> = {
  Mon: [
    { project: "Project Alpha", from: "09:30", to: "12:00", note: "Feature development" },
    { project: "Project Alpha", from: "12:30", to: "14:00", note: "Code review" },
    { project: "Project Beta",  from: "15:30", to: "17:30", note: "Sprint tasks" },
  ],
  Tue: [
    { project: "Project Alpha",   from: "09:30", to: "11:00", note: "Feature development" },
    { project: "Client Workshop", from: "11:00", to: "12:00", note: "Client call prep" },
    { project: "Project Beta",    from: "13:00", to: "17:00", note: "Backend implementation" },
  ],
  Wed: [
    { project: "Project Alpha",    from: "09:30", to: "12:30", note: "Development" },
    { project: "Project Beta",     from: "13:00", to: "15:00", note: "Testing" },
    { project: "Internal / Admin", from: "15:00", to: "16:00", note: "Retro" },
  ],
  Thu: [
    { project: "Internal / Admin", from: "10:00", to: "11:30", note: "Planning" },
    { project: "Project Alpha",    from: "11:30", to: "13:00", note: "Design implementation" },
    { project: "Project Beta",     from: "14:00", to: "17:30", note: "Feature work" },
  ],
  Fri: [
    { project: "Project Alpha",    from: "09:30", to: "12:00", note: "Development" },
    { project: "Project Beta",     from: "13:00", to: "15:30", note: "Bug fixes" },
    { project: "Internal / Admin", from: "15:30", to: "16:30", note: "Weekly wrap-up" },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const nanoid = () => Math.random().toString(36).slice(2, 10);
const parseTime = (t: string) => { const [h, m] = t.split(":").map(Number); return h + m / 60; };
const duration = (b: TimeBlock) => Math.max(0, parseTime(b.to) - parseTime(b.from));

function fmtHM(h: number): string {
  const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60);
  return `${hrs}:${mins.toString().padStart(2, "0")}`;
}

function hourToTime(h: number): string {
  const hr = Math.max(CAL_START, Math.min(CAL_END - 1, Math.floor(h)));
  return `${String(hr).padStart(2, "0")}:${h % 1 >= 0.5 ? "30" : "00"}`;
}

function getMondayOf(weekOffset: number): Date {
  const today = new Date(); const dow = today.getDay();
  const m = new Date(today);
  m.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
  m.setHours(0, 0, 0, 0); return m;
}

function buildWeekDates(weekOffset: number): Record<DayKey, { display: string; iso: string }> {
  const monday = getMondayOf(weekOffset);
  const keys: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const out: Record<string, { display: string; iso: string }> = {};
  keys.forEach((k, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    out[k] = { display: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), iso: d.toISOString().slice(0, 10) };
  });
  return out as Record<DayKey, { display: string; iso: string }>;
}

function weekRangeLabel(weekOffset: number) {
  const m = getMondayOf(weekOffset); const f = new Date(m); f.setDate(m.getDate() + 4);
  return `${m.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${f.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

function initGhosts(dayKey: DayKey): TimeBlock[] {
  const ghosts: TimeBlock[] = [];
  const cal = CALENDAR_EVENTS[dayKey] ?? [];
  cal.forEach(ev => ghosts.push({ id: nanoid(), project: ev.project, from: ev.from, to: ev.to, note: ev.note, isGhost: true, source: "calendar" }));
  (PAST_ENTRIES[dayKey] ?? []).forEach(entry => {
    if (!cal.some(ev => ev.from === entry.from && ev.to === entry.to))
      ghosts.push({ id: nanoid(), project: entry.project, from: entry.from, to: entry.to, note: entry.note, isGhost: true, source: "history" });
  });
  return ghosts;
}

function buildDays(weekOffset: number): Record<DayKey, DayData> {
  const dates = buildWeekDates(weekOffset);
  const init = {} as Record<DayKey, DayData>;
  (["Mon", "Tue", "Wed", "Thu", "Fri"] as DayKey[]).forEach(k => {
    init[k] = {
      key: k, label: DAY_LABELS[k], date: dates[k].display, isoDate: dates[k].iso,
      blocks: [], ghosts: weekOffset === 0 ? initGhosts(k) : [],
      submitted: false, type: "work",
    };
  });
  return init;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_KEYS: DayKey[]                 = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_LABELS: Record<DayKey, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday" };
const HOURS = Array.from({ length: CAL_END - CAL_START }, (_, i) => CAL_START + i);
const TOTAL_H = (CAL_END - CAL_START) * HOUR_PX;
const SRC_BADGE: Record<BlockSource, { label: string; color: string; bg: string } | null> = {
  calendar: { label: "CAL",  color: "#3B7DD8", bg: "#EDF4FF" },
  history:  { label: "HIST", color: "#7A5CBF", bg: "#F3EEFF" },
  ai:       { label: "AI",   color: ORANGE,    bg: "#FFF3ED" },
  manual:   null,
};

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-xs font-medium select-none"
      style={{ color: checked ? TEXT : TEXT_3 }}>
      <div className={cn("relative w-8 h-4 rounded-full transition-colors duration-200")}
        style={{ backgroundColor: checked ? ORANGE : "#D1CFC8" }}>
        <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200")}
          style={{ transform: `translateX(${checked ? "18px" : "2px"})` }} />
      </div>
      {label}
    </button>
  );
}

// ─── Project budget bar (inline) ──────────────────────────────────────────────

function BudgetBar({ project, extraHours = 0 }: { project: Project; extraHours?: number }) {
  const budget = PROJECT_BUDGET[project];
  if (!budget) return <p className="text-[11px] mt-1" style={{ color: TEXT_3 }}>No budget set</p>;
  const used = budget.used + extraHours;
  const remaining = Math.max(0, budget.total - used);
  const frac = Math.min(1, used / budget.total);
  const isOver = used > budget.total;
  const color = PROJECT_COLOR[project];
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex justify-between text-[11px]" style={{ color: TEXT_2 }}>
        <span>{fmtHM(used)} used</span>
        <span style={{ color: isOver ? SICK_FG : TEXT_3 }}>{isOver ? `${fmtHM(used - budget.total)} over` : `${remaining}h left`} / {budget.total}h</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#EDE9E2" }}>
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${frac * 100}%`, backgroundColor: isOver ? SICK_FG : color }} />
      </div>
    </div>
  );
}

// ─── Add entry modal ──────────────────────────────────────────────────────────

function AddEntryModal({ defaultDay, days, onAdd, onClose }: {
  defaultDay: DayKey; days: Record<DayKey, DayData>;
  onAdd: (dayKey: DayKey, p: string, from: string, to: string, note: string) => void;
  onClose: () => void;
}) {
  const [project, setProject] = useState<string>("");
  const [task,    setTask]    = useState<string>("");
  const [dayIdx,  setDayIdx]  = useState<number>(DAY_KEYS.indexOf(defaultDay));
  const [hours,   setHours]   = useState<string>("");
  const [note,    setNote]    = useState("");

  const day = DAY_KEYS[dayIdx];
  const dayData = days[day];

  const weekHoursForProject = Object.values(days)
    .flatMap(d => d.blocks.filter(b => !b.isGhost && b.project === project))
    .reduce((s, b) => s + duration(b), 0);

  const tasks = project ? PROJECT_TASKS[project as Project] : [];

  const nudges = (COWORKER_NUDGES[day] ?? []).filter(
    n => n.project === project && n.task === task
  );

  function parseHoursInput(val: string): number {
    if (val.includes(":")) {
      const [h, m] = val.split(":").map(Number);
      return (isNaN(h) ? 0 : h) + (isNaN(m) ? 0 : m) / 60;
    }
    return parseFloat(val);
  }

  const parsedHours = parseHoursInput(hours);
  const canSubmit = !!project && !!task && !!hours && parsedHours > 0;

  function applyNudge(h: number) { setHours(String(h)); }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const from = "09:00";
    const toH = 9 + parsedHours;
    const toStr = `${String(Math.floor(toH)).padStart(2, "0")}:${toH % 1 >= 0.5 ? "30" : "00"}`;
    onAdd(day, project, from, toStr, note);
    onClose();
  }

  const inputCls = "w-full h-9 px-2.5 text-xs rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 font-medium placeholder:text-gray-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-[440px] overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>

        {/* Header with day navigation */}
        <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: BORDER }}>
          <h2 className="text-sm font-bold" style={{ color: TEXT }}>Add time entry</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setDayIdx(i => Math.max(0, i - 1))}
              disabled={dayIdx === 0}
              className="w-6 h-6 rounded flex items-center justify-center text-xs transition-colors"
              style={{ color: dayIdx === 0 ? TEXT_3 : TEXT_2, opacity: dayIdx === 0 ? 0.35 : 1 }}
              onMouseEnter={e => { if (dayIdx > 0) e.currentTarget.style.backgroundColor = BG_PAGE; }}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>‹</button>
            <span className="text-xs font-semibold px-1 tabular-nums" style={{ color: TEXT, minWidth: 96, textAlign: "center" }}>
              {DAY_LABELS[day]}, {dayData.date}
            </span>
            <button type="button" onClick={() => setDayIdx(i => Math.min(DAY_KEYS.length - 1, i + 1))}
              disabled={dayIdx === DAY_KEYS.length - 1}
              className="w-6 h-6 rounded flex items-center justify-center text-xs transition-colors"
              style={{ color: dayIdx === DAY_KEYS.length - 1 ? TEXT_3 : TEXT_2, opacity: dayIdx === DAY_KEYS.length - 1 ? 0.35 : 1 }}
              onMouseEnter={e => { if (dayIdx < DAY_KEYS.length - 1) e.currentTarget.style.backgroundColor = BG_PAGE; }}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>›</button>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center text-xs"
            style={{ color: TEXT_3 }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = BG_PAGE)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>✕</button>
        </div>

        <form onSubmit={submit} className="px-5 py-4 space-y-3">
          {/* Project + Task — full width flex row */}
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: TEXT_3 }}>
                Project <span style={{ color: ORANGE }}>*</span>
              </label>
              <Select value={project} onValueChange={v => { if (v) { setProject(v); setTask(""); } }}>
                <SelectTrigger className="h-9 text-xs rounded-lg w-full" style={{ borderColor: BORDER }}>
                  <SelectValue placeholder="Select project…" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECTS.map(p => (
                    <SelectItem key={p} value={p} className="text-xs">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PROJECT_COLOR[p as Project] }} />
                        {p}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-0">
              <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: TEXT_3 }}>
                Task <span style={{ color: ORANGE }}>*</span>
              </label>
              <Select value={task} onValueChange={v => v && setTask(v)} disabled={!project}>
                <SelectTrigger className="h-9 text-xs rounded-lg w-full" style={{ borderColor: BORDER, opacity: project ? 1 : 0.5 }}>
                  <SelectValue placeholder={project ? "Select task…" : "Pick project first"} />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map(t => (
                    <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {project && <BudgetBar project={project as Project} extraHours={weekHoursForProject} />}

          {/* Hours */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: TEXT_3 }}>
              Hours <span style={{ color: ORANGE }}>*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text" inputMode="decimal"
                value={hours} onChange={e => setHours(e.target.value)}
                placeholder="e.g. 1:30 or 2.5"
                className={inputCls} style={{ borderColor: BORDER }}
              />
              {parsedHours > 0 && (
                <span className="text-xs font-semibold tabular-nums whitespace-nowrap" style={{ color: ORANGE }}>
                  {fmtHM(parsedHours)}
                </span>
              )}
            </div>

            {/* Coworker nudge */}
            {nudges.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {nudges.map((n, i) => (
                  <button key={i} type="button"
                    onClick={() => applyNudge(n.hours)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors"
                    style={{ backgroundColor: "#FFF8F4", border: `1px solid #FBDECE` }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#FEF0E8")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#FFF8F4")}>
                    <span className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0 text-white"
                      style={{ backgroundColor: ORANGE }}>{n.avatar}</span>
                    <span className="text-[11px] flex-1" style={{ color: TEXT_2 }}>
                      <span className="font-semibold" style={{ color: TEXT }}>{n.coworker}</span> logged {n.hours}h for this — use same?
                    </span>
                    <span className="text-[11px] font-semibold" style={{ color: ORANGE }}>{n.hours}h ↵</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide block mb-1" style={{ color: TEXT_3 }}>Notes</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="What did you work on?" className={inputCls} style={{ borderColor: BORDER }} />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={!canSubmit}
              className="flex-1 h-9 rounded-lg text-xs font-semibold text-white transition-colors"
              style={{ backgroundColor: canSubmit ? GREEN : "#C8D0D8", cursor: canSubmit ? "pointer" : "not-allowed" }}
              onMouseEnter={e => { if (canSubmit) e.currentTarget.style.backgroundColor = "#376239"; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = canSubmit ? GREEN : "#C8D0D8"; }}>
              Add entry
            </button>
            <button type="button" onClick={onClose}
              className="h-9 px-4 rounded-lg text-xs font-medium border"
              style={{ borderColor: BORDER, color: TEXT_2 }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Click-to-add popover ─────────────────────────────────────────────────────

function GridPopover({ dayKey, from, to, x, y, days, onAdd, onClose }: {
  dayKey: DayKey; from: string; to: string; x: number; y: number;
  days: Record<DayKey, DayData>;
  onAdd: (p: string, from: string, to: string, note: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const W = 260;
  const left = Math.min(x + 10, (typeof window !== "undefined" ? window.innerWidth : 1200) - W - 8);
  const top  = Math.min(y - 16, (typeof window !== "undefined" ? window.innerHeight : 800) - 240);

  const [project, setProject] = useState<string>(PROJECTS[0]);
  const [fromT,   setFromT]   = useState(from);
  const [toT,     setToT]     = useState(to);
  const [note,    setNote]    = useState("");

  const weekHrs = Object.values(days).flatMap(d => d.blocks.filter(b => !b.isGhost && b.project === project))
    .reduce((s, b) => s + duration(b), 0);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const inputCls = "w-full h-7 px-2 text-xs rounded-md border bg-white focus:outline-none focus:ring-1 font-medium placeholder:text-gray-300";

  return (
    <div ref={ref} className="fixed z-50 bg-white rounded-xl border shadow-2xl p-3.5"
      style={{ left, top, width: W, borderColor: BORDER }}>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-bold" style={{ color: TEXT }}>{DAY_LABELS[dayKey]}</span>
        <button onClick={onClose} className="text-xs" style={{ color: TEXT_3 }}>✕</button>
      </div>
      <div className="space-y-2">
        <Select value={project} onValueChange={v => v && setProject(v)}>
          <SelectTrigger className="h-7 text-xs rounded-md" style={{ borderColor: BORDER }}><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROJECTS.map(p => (
              <SelectItem key={p} value={p} className="text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PROJECT_COLOR[p as Project] }} />{p}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <BudgetBar project={project as Project} extraHours={weekHrs} />
        <div className="flex gap-1 items-center">
          <input type="time" value={fromT} onChange={e => setFromT(e.target.value)} className={cn(inputCls, "flex-1")} style={{ borderColor: BORDER }} />
          <span className="text-gray-300 text-xs">–</span>
          <input type="time" value={toT} onChange={e => setToT(e.target.value)} className={cn(inputCls, "flex-1")} style={{ borderColor: BORDER }} />
        </div>
        <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Notes" className={inputCls} style={{ borderColor: BORDER }} />
        <button onClick={() => { onAdd(project, fromT, toT, note); onClose(); }}
          className="w-full h-7 rounded-md text-xs font-semibold text-white"
          style={{ backgroundColor: GREEN }}>Add entry</button>
      </div>
    </div>
  );
}

// ─── Calendar events sidebar ──────────────────────────────────────────────────

function CalendarSidebar({ selectedDay, allDays }: { selectedDay: DayKey; allDays: Record<DayKey, DayData> }) {
  const [collapsed, setCollapsed] = useState(false);
  const events = CALENDAR_EVENTS[selectedDay] ?? [];

  // Project totals for summary chart
  const projectTotals = new Map<Project, number>();
  PROJECTS.forEach(p => projectTotals.set(p, 0));
  Object.values(allDays).forEach(d =>
    d.blocks.filter(b => !b.isGhost).forEach(b =>
      projectTotals.set(b.project as Project, (projectTotals.get(b.project as Project) ?? 0) + duration(b))
    )
  );
  const maxH = Math.max(...Array.from(projectTotals.values()), 0.1);
  const weekTotal = Array.from(projectTotals.values()).reduce((s, h) => s + h, 0);

  if (collapsed) {
    return (
      <div className="shrink-0 flex flex-col items-center pt-1" style={{ width: 28 }}>
        <button
          onClick={() => setCollapsed(false)}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          title="Expand sidebar"
          style={{ color: TEXT_3, backgroundColor: "transparent" }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = BORDER)}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
          ›
        </button>
      </div>
    );
  }

  return (
    <div className="w-56 shrink-0 flex flex-col gap-0 overflow-y-auto" style={{ maxHeight: "calc(100vh - 160px)" }}>

      {/* Google Calendar events */}
      <div className="bg-white rounded-xl border overflow-hidden mb-3" style={{ borderColor: BORDER }}>
        <div className="px-3 py-2.5 border-b flex items-center gap-2" style={{ borderColor: BORDER }}>
          <span className="text-xs font-bold flex-1" style={{ color: TEXT }}>Calendar</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#EDF4FF", color: "#3B7DD8" }}>Google</span>
          <button
            onClick={() => setCollapsed(true)}
            className="w-5 h-5 rounded flex items-center justify-center ml-1 transition-colors"
            title="Collapse sidebar"
            style={{ color: TEXT_3 }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = BG_PAGE)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
            ‹
          </button>
        </div>
        <div className="px-3 py-2 space-y-1.5">
          {events.length === 0 ? (
            <p className="text-[11px] py-2 text-center" style={{ color: TEXT_3 }}>No events</p>
          ) : events.map((ev, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5 border-b last:border-0" style={{ borderColor: BORDER }}>
              <div className="w-0.5 self-stretch rounded-full shrink-0 mt-0.5" style={{ backgroundColor: PROJECT_COLOR[ev.project] }} />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold truncate" style={{ color: TEXT }}>{ev.note}</div>
                <div className="text-[10px] tabular-nums" style={{ color: TEXT_3 }}>{ev.from}–{ev.to}</div>
                <div className="text-[10px] truncate" style={{ color: TEXT_2 }}>{ev.project}</div>
              </div>
            </div>
          ))}
          <p className="text-[9px] pt-1" style={{ color: TEXT_3 }}>
            Connect Google Calendar to sync real events →
          </p>
        </div>
      </div>

      {/* Summary chart */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: BORDER }}>
        <div className="px-3 py-2.5 border-b" style={{ borderColor: BORDER }}>
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold" style={{ color: TEXT }}>This week</span>
            <span className="text-xs font-bold tabular-nums" style={{ color: ORANGE }}>{fmtHM(weekTotal)}</span>
          </div>
        </div>
        <div className="px-3 py-2.5 space-y-2.5">
          {PROJECTS.map(p => {
            const h = projectTotals.get(p) ?? 0;
            const frac = maxH > 0 ? h / maxH : 0;
            const color = PROJECT_COLOR[p];
            const budget = PROJECT_BUDGET[p];
            return (
              <div key={p} className="space-y-0.5">
                <div className="flex items-baseline justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[11px] font-medium truncate" style={{ color: TEXT_2 }}>{p.replace(" / Admin", "")}</span>
                  </div>
                  <span className="text-[11px] font-semibold tabular-nums shrink-0 ml-1" style={{ color: h > 0 ? color : TEXT_3 }}>
                    {fmtHM(h)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#EDE9E2" }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${frac * 100}%`, backgroundColor: color }} />
                </div>
                {budget && (
                  <div className="text-[9px]" style={{ color: TEXT_3 }}>{budget.used + h}h / {budget.total}h budget</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Calendar block (visual, in grid) ────────────────────────────────────────

function CalBlock({ block, isGhost, showSuggestions, onAccept, onDismiss, onRemove, submitted }: {
  block: TimeBlock; isGhost: boolean; showSuggestions: boolean;
  onAccept?: () => void; onDismiss?: () => void; onRemove?: () => void; submitted?: boolean;
}) {
  if (isGhost && !showSuggestions) return null;
  const color = PROJECT_COLOR[block.project as Project] ?? "#6B7280";
  const bg    = PROJECT_BG[block.project as Project]    ?? "#F4F5F6";
  const src   = SRC_BADGE[block.source];
  const h     = Math.max(duration(block) * HOUR_PX, 20);
  const top   = (parseTime(block.from) - CAL_START) * HOUR_PX;

  return (
    <div data-block="true"
      className={cn("absolute left-0.5 right-0.5 rounded-md overflow-hidden group transition-all duration-200 cursor-pointer",
        block.removing ? "opacity-0 scale-95 pointer-events-none" : "")}
      style={{
        top: top + 1, height: h - 2,
        borderColor: isGhost ? `${color}80` : `${color}50`,
        backgroundColor: isGhost ? `${color}20` : bg,
        border: isGhost ? `1.5px dashed` : `1px solid`,
        opacity: block.removing ? 0 : isGhost ? 0.6 : 1,
        zIndex: isGhost ? 1 : 2,
      }}>
      <div className="px-1.5 pt-1 h-full flex flex-col">
        <div className="flex items-start gap-1">
          <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: color }} />
          <span className="text-[10px] font-bold flex-1 truncate leading-tight" style={{ color: TEXT }}>{block.project}</span>
          {src && h > 30 && (
            <span className="text-[8px] font-bold px-1 rounded shrink-0" style={{ backgroundColor: src.bg, color: src.color }}>{src.label}</span>
          )}
        </div>
        {block.note && h > 36 && <div className="text-[9px] truncate mt-0.5" style={{ color: TEXT_2 }}>{block.note}</div>}
        {h > 48 && <div className="text-[9px] tabular-nums mt-0.5" style={{ color: TEXT_3 }}>{block.from}–{block.to}</div>}

        {isGhost && h > 54 && (
          <div className="flex gap-1 mt-auto pb-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={e => { e.stopPropagation(); onAccept?.(); }}
              className="flex-1 text-[9px] font-bold py-0.5 rounded text-white" style={{ backgroundColor: GREEN }}>✓</button>
            <button onClick={e => { e.stopPropagation(); onDismiss?.(); }}
              className="flex-1 text-[9px] font-bold py-0.5 rounded border" style={{ borderColor: BORDER, color: TEXT_3, backgroundColor: "white" }}>✕</button>
          </div>
        )}
        {isGhost && h <= 54 && (
          <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded-md">
            <button onClick={e => { e.stopPropagation(); onAccept?.(); }}
              className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center" style={{ backgroundColor: GREEN }}>✓</button>
            <button onClick={e => { e.stopPropagation(); onDismiss?.(); }}
              className="w-5 h-5 rounded-full text-[9px] font-bold border flex items-center justify-center" style={{ borderColor: BORDER, color: TEXT_3, backgroundColor: "white" }}>✕</button>
          </div>
        )}
        {!isGhost && !submitted && (
          <button onClick={e => { e.stopPropagation(); onRemove?.(); }}
            className="absolute top-0.5 right-0.5 w-4 h-4 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px]"
            style={{ backgroundColor: `${color}25`, color: TEXT_2 }}>✕</button>
        )}
      </div>
    </div>
  );
}

// ─── Unified week/day grid ────────────────────────────────────────────────────

function TimeGrid({ days, viewMode, selectedDay, isCurrentWeek, todayKey, showSuggestions, loadingAI,
  onSelectDay, onAcceptGhost, onDismissGhost, onRemoveBlock, onGridClick, onChangeDayType }: {
  days: Record<DayKey, DayData>; viewMode: ViewMode; selectedDay: DayKey;
  isCurrentWeek: boolean; todayKey: DayKey | null; showSuggestions: boolean;
  loadingAI: DayKey | null;
  onSelectDay: (k: DayKey) => void;
  onAcceptGhost: (dayKey: DayKey, id: string) => void;
  onDismissGhost: (dayKey: DayKey, id: string) => void;
  onRemoveBlock: (dayKey: DayKey, id: string) => void;
  onGridClick: (e: React.MouseEvent, dayKey: DayKey) => void;
  onChangeDayType: (dayKey: DayKey, t: DayType) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleDays = viewMode === "day" ? [selectedDay] : DAY_KEYS;
  const gridCols = `52px repeat(${visibleDays.length}, 1fr)`;

  return (
    <div className="bg-white rounded-xl border overflow-hidden flex flex-col" style={{ borderColor: BORDER, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>

      {/* ── Sticky column headers ── */}
      <div className="sticky top-0 z-10 border-b bg-white" style={{ borderColor: BORDER }}>
        <div className="grid" style={{ gridTemplateColumns: gridCols }}>
          <div className="border-r" style={{ borderColor: BORDER }} />
          {visibleDays.map(k => {
            const day = days[k];
            const isToday = k === todayKey && isCurrentWeek;
            const solidTotal = day.type !== "work" ? 8 : day.blocks.filter(b => !b.isGhost).reduce((s, b) => s + duration(b), 0);
            const isComplete = solidTotal >= 8;
            const isPartial  = solidTotal >= 6 && solidTotal < 8;

            return (
              <div key={k} className={cn("px-3 py-2.5 border-l", viewMode === "week" && "cursor-pointer")}
                style={{
                  borderColor: BORDER,
                  backgroundColor: day.type === "vacation" ? `${VACATION_BG}80`
                    : day.type === "sick" ? `${SICK_BG}80`
                    : isToday && isCurrentWeek ? "#F0F6FF" : "white",
                  borderBottom: isToday && isCurrentWeek ? `2px solid #3B7DD8` : `2px solid transparent`,
                }}
                onClick={() => viewMode === "week" && onSelectDay(k)}>
                <div className="flex items-start justify-between gap-1">
                  <div>
                    {isToday && isCurrentWeek && (
                      <div className="text-[8px] font-bold uppercase tracking-widest px-1 py-0.5 rounded inline-block mb-0.5" style={{ backgroundColor: "#3B7DD8", color: "white" }}>Today</div>
                    )}
                    <div className="text-xs font-bold" style={{ color: isToday && isCurrentWeek ? "#3B7DD8" : TEXT }}>{k}</div>
                    <div className="text-[10px]" style={{ color: TEXT_3 }}>{day.date}</div>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-base font-bold tabular-nums leading-none",
                      isComplete ? "text-emerald-600" : isPartial ? "text-amber-500" : solidTotal > 0 ? "text-red-400" : ""
                    )} style={solidTotal === 0 ? { color: "#C8C4BC" } : {}}>
                      {day.type !== "work" ? "8:00" : fmtHM(solidTotal)}
                    </div>
                    <div className="text-[9px]" style={{ color: TEXT_3 }}>/ 8:00</div>
                  </div>
                </div>

                {/* Day type selector */}
                <div className="flex items-center gap-1 mt-1.5" onClick={e => e.stopPropagation()}>
                  {(["work", "vacation", "sick"] as DayType[]).map(t => (
                    <button key={t} onClick={() => onChangeDayType(k, t)}
                      className="text-[9px] px-1.5 py-0.5 rounded font-semibold transition-all"
                      style={{
                        backgroundColor: day.type === t
                          ? (t === "vacation" ? VACATION_BG : t === "sick" ? SICK_BG : `${ORANGE}20`)
                          : "transparent",
                        color: day.type === t
                          ? (t === "vacation" ? VACATION_FG : t === "sick" ? SICK_FG : ORANGE)
                          : TEXT_3,
                        border: `1px solid ${day.type === t ? (t === "vacation" ? VACATION_FG + "60" : t === "sick" ? SICK_FG + "60" : ORANGE + "60") : BORDER}`,
                      }}>
                      {t === "work" ? "Work" : t === "vacation" ? "🌴 Vacat." : "🤒 Sick"}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Time grid body ── */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
        <div className="flex">

          {/* Time axis */}
          <div className="shrink-0 border-r" style={{ width: 52, height: TOTAL_H, position: "relative", borderColor: BORDER }}>
            {HOURS.map(h => (
              <div key={h} className="absolute flex items-start justify-end pr-2 w-full"
                style={{ top: (h - CAL_START) * HOUR_PX, height: HOUR_PX }}>
                <span className="text-[10px] tabular-nums -mt-2" style={{ color: TEXT_3 }}>
                  {h < 12 ? `${h}` : h === 12 ? "12" : `${h - 12}`}
                  <span className="text-[8px]">{h < 12 ? "AM" : "PM"}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {visibleDays.map(dayKey => {
            const day = days[dayKey];
            const isToday = dayKey === todayKey && isCurrentWeek;
            const isSpecial = day.type !== "work";

            return (
              <div key={dayKey}
                className="flex-1 border-l relative"
                style={{ height: TOTAL_H, borderColor: BORDER, backgroundColor: isToday && !isSpecial ? "#F8FAFF" : "white" }}
                onClick={e => !isSpecial && !day.submitted && onGridClick(e, dayKey)}>

                {/* Grid lines */}
                {HOURS.map(h => (
                  <div key={h}>
                    <div className="absolute w-full border-t" style={{ top: (h - CAL_START) * HOUR_PX, borderColor: "#F0EDE8" }} />
                    <div className="absolute w-full border-t border-dashed" style={{ top: (h - CAL_START) * HOUR_PX + HOUR_PX / 2, borderColor: "#F8F5F0" }} />
                  </div>
                ))}

                {/* Vacation / Sick overlay */}
                {isSpecial && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
                    style={{ backgroundColor: day.type === "vacation" ? `${VACATION_BG}90` : `${SICK_BG}90` }}>
                    <span className="text-3xl mb-2">{day.type === "vacation" ? "🌴" : "🤒"}</span>
                    <span className="text-sm font-bold" style={{ color: day.type === "vacation" ? VACATION_FG : SICK_FG }}>
                      {day.type === "vacation" ? "Vacation" : "Sick leave"}
                    </span>
                    <span className="text-xs mt-1" style={{ color: TEXT_3 }}>8:00 counted</span>
                  </div>
                )}

                {/* Ghost blocks */}
                {!isSpecial && day.ghosts.map(block => (
                  <CalBlock key={block.id} block={block} isGhost={true} showSuggestions={showSuggestions}
                    onAccept={() => onAcceptGhost(dayKey, block.id)}
                    onDismiss={() => onDismissGhost(dayKey, block.id)} />
                ))}

                {/* Solid blocks */}
                {!isSpecial && day.blocks.map(block => (
                  <CalBlock key={block.id} block={block} isGhost={false} showSuggestions={showSuggestions}
                    onRemove={() => onRemoveBlock(dayKey, block.id)} submitted={day.submitted} />
                ))}

                {/* Loading */}
                {loadingAI === dayKey && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: `${ORANGE}08` }}>
                    <span className="w-5 h-5 rounded-full border-2" style={{ borderColor: `${ORANGE}30`, borderTopColor: ORANGE, animation: "spin 0.7s linear infinite" }} />
                  </div>
                )}

                {/* No time reported */}
                {!isSpecial && day.blocks.length === 0 && day.ghosts.filter(g => showSuggestions).length === 0 && !loadingAI && (
                  <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none">
                    <span className="text-[10px]" style={{ color: TEXT_3 }}>No time reported</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Week progress footer ─────────────────────────────────────────────────────

function WeekProgress({ days }: { days: Record<DayKey, DayData> }) {
  const dayTotals = DAY_KEYS.map(k => {
    const day = days[k];
    if (day.type !== "work") return { key: k, hours: 8, type: day.type };
    const h = day.blocks.filter(b => !b.isGhost).reduce((s, b) => s + duration(b), 0);
    return { key: k, hours: h, type: "work" as DayType };
  });

  const weekTotal  = dayTotals.reduce((s, d) => s + d.hours, 0);
  const TARGET     = 40;
  const frac       = Math.min(1, weekTotal / TARGET);
  const isComplete = weekTotal >= TARGET;

  return (
    <div className="bg-white border-t sticky bottom-0 z-10" style={{ borderColor: BORDER }}>
      <div className="max-w-[1440px] mx-auto px-5 py-2.5 flex items-center gap-4">
        <span className="text-xs font-semibold shrink-0" style={{ color: TEXT }}>Weekly progress</span>
        <div className="flex gap-1 items-end">
          {dayTotals.map(({ key, hours, type }) => {
            const isToday = key === DAY_KEYS[new Date().getDay() - 1];
            const dayComplete = hours >= 8;
            return (
              <div key={key} className="flex flex-col items-center gap-0.5">
                <div className="w-7 rounded-sm overflow-hidden" style={{ height: 20, backgroundColor: "#EDE9E2" }}>
                  <div className="w-full rounded-sm transition-all duration-500" style={{
                    height: `${Math.min(1, hours / 8) * 100}%`,
                    marginTop: `${(1 - Math.min(1, hours / 8)) * 100}%`,
                    backgroundColor: type === "vacation" ? VACATION_FG : type === "sick" ? SICK_FG : dayComplete ? GREEN : ORANGE,
                  }} />
                </div>
                <span className="text-[8px] font-bold" style={{ color: isToday ? "#3B7DD8" : TEXT_3 }}>{key}</span>
              </div>
            );
          })}
        </div>
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#EDE9E2" }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${frac * 100}%`, backgroundColor: isComplete ? GREEN : ORANGE }} />
        </div>
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="text-lg font-bold tabular-nums" style={{ color: isComplete ? GREEN : TEXT }}>{fmtHM(weekTotal)}</span>
          <span className="text-xs" style={{ color: TEXT_3 }}>/ {TARGET}:00</span>
        </div>
        {isComplete && <span className="text-xs font-semibold shrink-0 px-2.5 py-1 rounded-full" style={{ backgroundColor: "#D1FAE5", color: "#059669" }}>✓ Week complete</span>}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function TimesheetApp() {
  const [weekOffset,       setWeekOffset]       = useState(0);
  const [viewMode,         setViewMode]          = useState<ViewMode>("week");
  const [selectedDay,      setSelectedDay]       = useState<DayKey>(() => {
    const dow = new Date().getDay();
    return ({ 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri" } as Record<number, DayKey>)[dow] ?? "Mon";
  });
  const [showSuggestions,  setShowSuggestions]  = useState(true);
  const [showAddModal,     setShowAddModal]     = useState(false);
  const [daysByWeek,       setDaysByWeek]       = useState<Record<number, Record<DayKey, DayData>>>({ 0: buildDays(0) });
  const [loadingAI,        setLoadingAI]        = useState<DayKey | null>(null);
  const [gridPopover,      setGridPopover]      = useState<{ dayKey: DayKey; from: string; to: string; x: number; y: number } | null>(null);
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => () => { timeoutRefs.current.forEach(clearTimeout); }, []);

  useEffect(() => {
    if (!daysByWeek[weekOffset])
      setDaysByWeek(prev => ({ ...prev, [weekOffset]: buildDays(weekOffset) }));
  }, [weekOffset]);

  const days = daysByWeek[weekOffset] ?? buildDays(weekOffset);

  const todayDow = new Date().getDay();
  const todayKey: DayKey | null = ({ 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri" } as Record<number, DayKey>)[todayDow] ?? null;

  function updateDay(dayKey: DayKey, updater: (d: DayData) => DayData) {
    setDaysByWeek(prev => ({
      ...prev, [weekOffset]: { ...prev[weekOffset], [dayKey]: updater(prev[weekOffset][dayKey]) },
    }));
  }

  function animateRemove(dayKey: DayKey, id: string, kind: "ghost" | "block", cb: () => void) {
    updateDay(dayKey, d => ({
      ...d,
      [kind === "ghost" ? "ghosts" : "blocks"]: (kind === "ghost" ? d.ghosts : d.blocks).map(
        b => b.id === id ? { ...b, removing: true } : b
      ),
    }));
    const t = setTimeout(() => { cb(); timeoutRefs.current.delete(id); }, 250);
    timeoutRefs.current.set(id, t);
  }

  const acceptGhost  = useCallback((dayKey: DayKey, id: string) => {
    animateRemove(dayKey, id, "ghost", () =>
      updateDay(dayKey, d => {
        const ghost = d.ghosts.find(g => g.id === id);
        if (!ghost) return d;
        return { ...d, ghosts: d.ghosts.filter(g => g.id !== id), blocks: [...d.blocks, { ...ghost, isGhost: false, removing: false }] };
      })
    );
  }, [weekOffset]);

  const dismissGhost = useCallback((dayKey: DayKey, id: string) => {
    animateRemove(dayKey, id, "ghost", () =>
      updateDay(dayKey, d => ({ ...d, ghosts: d.ghosts.filter(g => g.id !== id) }))
    );
  }, [weekOffset]);

  const removeBlock  = useCallback((dayKey: DayKey, id: string) => {
    animateRemove(dayKey, id, "block", () =>
      updateDay(dayKey, d => ({ ...d, blocks: d.blocks.filter(b => b.id !== id) }))
    );
  }, [weekOffset]);

  function addBlock(dayKey: DayKey, project: string, from: string, to: string, note: string) {
    updateDay(dayKey, d => ({
      ...d, blocks: [...d.blocks, { id: nanoid(), project, from, to, note, isGhost: false, source: "manual" as BlockSource }],
    }));
  }

  function changeDayType(dayKey: DayKey, t: DayType) {
    updateDay(dayKey, d => ({ ...d, type: t }));
  }

  async function smartSuggestAll() {
    if (loadingAI) return;
    for (const k of DAY_KEYS) {
      setLoadingAI(k);
      await new Promise(r => setTimeout(r, 400));
      updateDay(k, d => ({
        ...d, ghosts: [...d.ghosts, ...MOCK_SUGGESTIONS[k].map(s => ({
          id: nanoid(), project: s.project, from: s.from, to: s.to,
          note: s.note, isGhost: true, source: "ai" as BlockSource,
        }))],
      }));
    }
    setLoadingAI(null);
  }

  function handleGridClick(e: React.MouseEvent, dayKey: DayKey) {
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const scrollEl = (e.currentTarget as HTMLElement).closest(".overflow-y-auto");
    const scrollTop = scrollEl ? (scrollEl as HTMLElement).scrollTop : 0;
    const localY = e.clientY - rect.top + scrollTop;
    const rawH = CAL_START + localY / HOUR_PX;
    const snapped = Math.floor(rawH * 2) / 2;
    const from = hourToTime(Math.max(CAL_START, Math.min(CAL_END - 1, snapped)));
    const to   = hourToTime(Math.min(CAL_END, snapped + 1));
    setGridPopover({ dayKey, from, to, x: e.clientX, y: e.clientY });
  }

  const submittedAll = Object.values(days).every(d => d.submitted);
  const weekTotal    = DAY_KEYS.reduce((s, k) => {
    const d = days[k];
    if (d.type !== "work") return s + 8;
    return s + d.blocks.filter(b => !b.isGhost).reduce((ss, b) => ss + duration(b), 0);
  }, 0);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: BG_PAGE, fontFamily: "var(--font-sans)" }}>

      {/* ── Top nav ── */}
      <nav style={{ backgroundColor: NAV_BG }}>
        <div className="max-w-[1440px] mx-auto px-5 h-11 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded flex items-center justify-center text-white font-black text-xs" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>T</div>
              <span className="text-white font-bold text-sm">Timesheet</span>
            </div>
            {(["Time", "Projects", "Reports"] as const).map(label => (
              <button key={label} className="text-xs font-medium px-2 py-1 rounded transition-colors"
                style={{ color: label === "Time" ? "white" : "rgba(255,255,255,0.6)", backgroundColor: label === "Time" ? "rgba(255,255,255,0.15)" : "transparent" }}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>Settings</span>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>JS</div>
            <span className="text-xs text-white font-medium">Jane</span>
          </div>
        </div>
      </nav>

      {/* ── Sub-tabs ── */}
      <div className="bg-white border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-[1440px] mx-auto px-5 flex items-center">
          {(["Timesheet", "Pending approval", "Unsubmitted", "Approved"] as const).map(tab => (
            <button key={tab} className="px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors"
              style={{ borderColor: tab === "Timesheet" ? ORANGE : "transparent", color: tab === "Timesheet" ? ORANGE : TEXT_3 }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="bg-white border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-[1440px] mx-auto px-5 h-12 flex items-center justify-between gap-4">

          {/* Left: week nav + title */}
          <div className="flex items-center gap-2">
            {[{ icon: "←", delta: -1 }, { icon: "→", delta: 1 }].map(({ icon, delta }) => (
              <button key={icon} onClick={() => setWeekOffset(w => w + delta)}
                className="w-7 h-7 rounded border flex items-center justify-center text-sm font-medium"
                style={{ borderColor: BORDER, color: TEXT_2, backgroundColor: "white" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = BG_PAGE)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "white")}>
                {icon}
              </button>
            ))}
            <h2 className="text-sm font-bold ml-1" style={{ color: TEXT }}>
              {weekOffset === 0
                ? `Today: ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`
                : weekRangeLabel(weekOffset)}
            </h2>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="text-xs font-medium ml-1" style={{ color: ORANGE }}>
                Return to this week
              </button>
            )}
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-4">
            {/* Smart suggest toggle */}
            <Toggle checked={showSuggestions} onChange={setShowSuggestions} label="Suggestions" />

            {/* Refresh suggestions */}
            {showSuggestions && (
              <button onClick={smartSuggestAll} disabled={!!loadingAI}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-dashed disabled:opacity-40 transition-all"
                style={{ borderColor: `${ORANGE}60`, color: ORANGE, backgroundColor: `${ORANGE}06` }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${ORANGE}10`)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = `${ORANGE}06`)}>
                {loadingAI ? (
                  <span className="w-3 h-3 rounded-full border-2 shrink-0" style={{ borderColor: `${ORANGE}40`, borderTopColor: ORANGE, animation: "spin 0.7s linear infinite" }} />
                ) : <>✦</>}
                Smart suggest
              </button>
            )}

            {/* View toggle */}
            <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: BORDER }}>
              {(["week", "day"] as ViewMode[]).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className="px-3 h-7 text-xs font-semibold capitalize transition-colors"
                  style={{
                    backgroundColor: viewMode === mode ? ORANGE : "white",
                    color: viewMode === mode ? "white" : TEXT_2,
                    borderRight: mode === "week" ? `1px solid ${BORDER}` : "none",
                  }}>
                  {mode === "week" ? "Week" : "Day"}
                </button>
              ))}
            </div>

            {/* + Add entry */}
            <button onClick={() => setShowAddModal(true)}
              className="h-8 px-4 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
              style={{ backgroundColor: GREEN }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#376239")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = GREEN)}>
              + Add entry
            </button>

            {/* Submit week */}
            <button onClick={() => DAY_KEYS.forEach(k => updateDay(k, d => ({ ...d, submitted: true })))}
              disabled={submittedAll}
              className="h-8 px-4 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50"
              style={{ borderColor: submittedAll ? "#D1FAE5" : BORDER, color: submittedAll ? "#059669" : TEXT_2 }}>
              {submittedAll ? "✓ Week submitted" : "Submit week"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-5 py-4">
        <div className="flex gap-4">

          {/* Left sidebar */}
          <CalendarSidebar selectedDay={selectedDay} allDays={days} />

          {/* Grid */}
          <div className="flex-1 min-w-0">
            {/* Day view header */}
            {viewMode === "day" && (() => {
              const dayIdx = DAY_KEYS.indexOf(selectedDay);
              const dayData = days[selectedDay];
              const isToday = selectedDay === todayKey && weekOffset === 0;
              const loggedH = dayData.blocks.filter(b => !b.isGhost).reduce((s, b) => s + duration(b), 0);
              return (
                <div className="flex items-center gap-3 mb-4 px-1">
                  <button
                    onClick={() => setSelectedDay(DAY_KEYS[dayIdx - 1])}
                    disabled={dayIdx === 0}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-medium transition-colors"
                    style={{ color: dayIdx === 0 ? TEXT_3 : TEXT_2, opacity: dayIdx === 0 ? 0.35 : 1, backgroundColor: "transparent" }}
                    onMouseEnter={e => { if (dayIdx > 0) e.currentTarget.style.backgroundColor = BORDER; }}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                    ‹
                  </button>
                  <div className="flex-1 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-base font-bold" style={{ color: isToday ? "#3B7DD8" : TEXT }}>
                        {DAY_LABELS[selectedDay]}
                      </span>
                      <span className="text-sm font-medium" style={{ color: TEXT_3 }}>{dayData.date}</span>
                      {dayData.type === "vacation" && <span className="text-sm">🌴</span>}
                      {dayData.type === "sick"     && <span className="text-sm">🤒</span>}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: loggedH > 0 ? ORANGE : TEXT_3 }}>
                      {loggedH > 0 ? `${fmtHM(loggedH)} logged` : "Nothing logged yet"}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedDay(DAY_KEYS[dayIdx + 1])}
                    disabled={dayIdx === DAY_KEYS.length - 1}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-medium transition-colors"
                    style={{ color: dayIdx === DAY_KEYS.length - 1 ? TEXT_3 : TEXT_2, opacity: dayIdx === DAY_KEYS.length - 1 ? 0.35 : 1, backgroundColor: "transparent" }}
                    onMouseEnter={e => { if (dayIdx < DAY_KEYS.length - 1) e.currentTarget.style.backgroundColor = BORDER; }}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
                    ›
                  </button>
                </div>
              );
            })()}

            <TimeGrid
              days={days} viewMode={viewMode} selectedDay={selectedDay}
              isCurrentWeek={weekOffset === 0} todayKey={todayKey}
              showSuggestions={showSuggestions} loadingAI={loadingAI}
              onSelectDay={k => { setSelectedDay(k); setViewMode("day"); }}
              onAcceptGhost={acceptGhost} onDismissGhost={dismissGhost}
              onRemoveBlock={removeBlock} onGridClick={handleGridClick}
              onChangeDayType={changeDayType}
            />
          </div>
        </div>
      </main>

      {/* ── Week progress footer ── */}
      <WeekProgress days={days} />

      {/* ── Modals / popovers ── */}
      {showAddModal && (
        <AddEntryModal
          defaultDay={selectedDay} days={days}
          onAdd={(dayKey, p, f, t, n) => { addBlock(dayKey, p, f, t, n); setShowAddModal(false); }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {gridPopover && (
        <GridPopover
          dayKey={gridPopover.dayKey} from={gridPopover.from} to={gridPopover.to}
          x={gridPopover.x} y={gridPopover.y} days={days}
          onAdd={(p, f, t, n) => { addBlock(gridPopover.dayKey, p, f, t, n); setGridPopover(null); }}
          onClose={() => setGridPopover(null)}
        />
      )}
    </div>
  );
}
