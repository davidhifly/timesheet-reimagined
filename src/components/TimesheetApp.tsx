"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type DayKey = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
type BlockSource = "calendar" | "history" | "ai" | "manual";
type ViewMode = "list" | "calendar";

interface TimeBlock {
  id: string;
  project: string;
  from: string;
  to: string;
  note: string;
  isGhost: boolean;
  source: BlockSource;
  removing?: boolean;
}

interface DayData {
  key: DayKey;
  label: string;
  shortLabel: string;
  date: string;
  isoDate: string;
  blocks: TimeBlock[];
  ghosts: TimeBlock[];
  submitted: boolean;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const NAV_BG  = "#5A2C10";
const ORANGE  = "#E8622A";
const GREEN   = "#457B48";
const BG_PAGE = "#F6F5F3";
const BORDER  = "#E4E2DC";
const TEXT    = "#1A1917";
const TEXT_2  = "#595550";
const TEXT_3  = "#9A9590";

// ─── Calendar grid constants ──────────────────────────────────────────────────

const CAL_START  = 7;   // 7:00 AM
const CAL_END    = 20;  // 8:00 PM
const HOUR_PX    = 64;  // px per hour

// ─── Mock data ────────────────────────────────────────────────────────────────

const PROJECTS = [
  "Project Alpha",
  "Project Beta",
  "Internal / Admin",
  "Client Workshop",
] as const;
type Project = (typeof PROJECTS)[number];

const PROJECT_COLOR: Record<Project, string> = {
  "Project Alpha":    "#3B7DD8",
  "Project Beta":     "#7A5CBF",
  "Internal / Admin": "#7A8694",
  "Client Workshop":  "#D4893A",
};

const PROJECT_BG: Record<Project, string> = {
  "Project Alpha":    "#EDF4FF",
  "Project Beta":     "#F3EEFF",
  "Internal / Admin": "#F4F5F6",
  "Client Workshop":  "#FFF4E8",
};

const PROJECT_BUDGET: Record<Project, { total: number; used: number } | null> = {
  "Project Alpha":    { total: 40, used: 22 },
  "Project Beta":     { total: 20, used: 8 },
  "Internal / Admin": null,
  "Client Workshop":  { total: 16, used: 5 },
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
  Fri: [
    { project: "Internal / Admin", from: "09:00", to: "09:30", note: "Standup" },
  ],
};

const PAST_ENTRIES: Partial<Record<DayKey, Array<{ project: Project; from: string; to: string; note: string }>>> = {
  Mon: [
    { project: "Project Alpha",    from: "09:30", to: "12:00", note: "Development" },
    { project: "Project Beta",     from: "13:00", to: "17:00", note: "Feature work" },
  ],
  Tue: [
    { project: "Project Alpha",    from: "09:30", to: "13:00", note: "Development" },
    { project: "Internal / Admin", from: "14:00", to: "15:00", note: "Team sync" },
  ],
};

const MOCK_SUGGESTIONS: Record<DayKey, Array<{ project: Project; from: string; to: string; note: string }>> = {
  Mon: [
    { project: "Project Alpha",    from: "09:30", to: "12:00", note: "Feature development" },
    { project: "Project Alpha",    from: "12:30", to: "14:00", note: "Code review" },
    { project: "Project Beta",     from: "15:30", to: "17:30", note: "Sprint tasks" },
  ],
  Tue: [
    { project: "Project Alpha",    from: "09:30", to: "11:00", note: "Feature development" },
    { project: "Client Workshop",  from: "11:00", to: "12:00", note: "Client call prep" },
    { project: "Project Beta",     from: "13:00", to: "17:00", note: "Backend implementation" },
  ],
  Wed: [
    { project: "Project Alpha",    from: "09:30", to: "12:30", note: "Development" },
    { project: "Project Beta",     from: "13:00", to: "15:00", note: "Testing & fixes" },
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

function nanoid() { return Math.random().toString(36).slice(2, 10); }
function parseTime(t: string) { const [h, m] = t.split(":").map(Number); return h + m / 60; }
function duration(b: TimeBlock) { return Math.max(0, parseTime(b.to) - parseTime(b.from)); }

function fmtHM(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return `${hrs}:${mins.toString().padStart(2, "0")}`;
}

function hourToTime(h: number): string {
  const hr = Math.max(CAL_START, Math.min(CAL_END, Math.floor(h)));
  const mn = h % 1 >= 0.5 ? "30" : "00";
  return `${String(hr).padStart(2, "0")}:${mn}`;
}

function timeToY(time: string): number {
  return (parseTime(time) - CAL_START) * HOUR_PX;
}

function getMondayOf(weekOffset: number): Date {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function buildWeekDates(weekOffset: number) {
  const monday = getMondayOf(weekOffset);
  const keys: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const out: Record<string, { display: string; iso: string }> = {};
  keys.forEach((k, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    out[k] = {
      display: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      iso: d.toISOString().slice(0, 10),
    };
  });
  return out as Record<DayKey, { display: string; iso: string }>;
}

function weekRangeLabel(weekOffset: number) {
  const monday = getMondayOf(weekOffset);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${monday.toLocaleDateString("en-GB", opts)} – ${friday.toLocaleDateString("en-GB", { ...opts, year: "numeric" })}`;
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

// ─── BudgetRing ───────────────────────────────────────────────────────────────

function BudgetRing({ project, weekHours }: { project: Project; weekHours: number }) {
  const budget = PROJECT_BUDGET[project];
  if (!budget) return null;
  const SIZE = 44, SW = 4, cx = SIZE / 2, r = cx - SW;
  const circ = 2 * Math.PI * r;
  const used = budget.used + weekHours;
  const fraction = Math.min(1, used / budget.total);
  const remaining = Math.max(0, budget.total - used);
  const color = PROJECT_COLOR[project];
  const isOver = used > budget.total;
  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0" title={`${project}: ${remaining}h / ${budget.total}h`}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#EDE9E2" strokeWidth={SW} />
        <circle cx={cx} cy={cx} r={r} fill="none"
          stroke={isOver ? ORANGE : color} strokeWidth={SW}
          strokeDasharray={`${fraction * circ} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: "stroke-dasharray 0.45s ease" }} />
        <text x={cx} y={cx + 3} textAnchor="middle" fontSize="8" fontWeight="700"
          fill={isOver ? ORANGE : TEXT} style={{ fontFamily: "var(--font-sans)" }}>
          {isOver ? "OVR" : `${remaining}h`}
        </text>
      </svg>
      <span className="text-[9px] font-medium leading-none" style={{ color: TEXT_3 }}>budget</span>
    </div>
  );
}

// ─── Source badge ─────────────────────────────────────────────────────────────

const SRC: Record<BlockSource, { label: string; color: string; bg: string } | null> = {
  calendar: { label: "CAL",  color: "#3B7DD8", bg: "#EDF4FF" },
  history:  { label: "HIST", color: "#7A5CBF", bg: "#F3EEFF" },
  ai:       { label: "AI",   color: ORANGE,    bg: "#FFF3ED" },
  manual:   null,
};

// ─── GhostRow (list view) ─────────────────────────────────────────────────────

function GhostRow({ block, onAccept, onDismiss }: {
  block: TimeBlock; onAccept: () => void; onDismiss: () => void;
}) {
  const color = PROJECT_COLOR[block.project as Project] ?? "#6B7280";
  const dur = duration(block);
  const src = SRC[block.source];
  return (
    <div className={cn(
      "group flex items-start gap-2.5 py-2.5 border-b border-dashed transition-all duration-200",
      block.removing ? "opacity-0 max-h-0 py-0 overflow-hidden pointer-events-none" : "opacity-50 hover:opacity-90"
    )} style={{ borderColor: `${color}60` }}>
      <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[13px] font-semibold leading-tight" style={{ color: TEXT }}>{block.project}</span>
          {src && <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{ backgroundColor: src.bg, color: src.color }}>{src.label}</span>}
        </div>
        <div className="text-[11px] mt-0.5 tabular-nums" style={{ color: TEXT_2 }}>{block.from}–{block.to}</div>
        {block.note && <div className="text-[11px] mt-0.5 truncate" style={{ color: TEXT_3 }}>{block.note}</div>}
        <div className="flex items-center gap-1.5 mt-1.5">
          <button onClick={onAccept}
            className="h-5 px-2 rounded text-[10px] font-semibold text-white border"
            style={{ backgroundColor: GREEN, borderColor: GREEN }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#376239")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = GREEN)}>
            ✓ Accept
          </button>
          <button onClick={onDismiss}
            className="h-5 px-2 rounded text-[10px] font-medium border"
            style={{ borderColor: BORDER, color: TEXT_3, backgroundColor: "white" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#DC2626"; e.currentTarget.style.borderColor = "#FECACA"; }}
            onMouseLeave={e => { e.currentTarget.style.color = TEXT_3; e.currentTarget.style.borderColor = BORDER; }}>
            Skip
          </button>
        </div>
      </div>
      <span className="text-sm font-bold tabular-nums shrink-0 mt-0.5" style={{ color: TEXT_2 }}>{fmtHM(dur)}</span>
    </div>
  );
}

// ─── EntryRow (list view) ─────────────────────────────────────────────────────

function EntryRow({ block, onRemove, submitted }: {
  block: TimeBlock; onRemove: () => void; submitted: boolean;
}) {
  const color = PROJECT_COLOR[block.project as Project] ?? "#6B7280";
  const dur = duration(block);
  return (
    <div className={cn(
      "group flex items-start gap-2.5 py-2.5 border-b transition-all duration-200 block-appear",
      block.removing ? "opacity-0 max-h-0 py-0 overflow-hidden pointer-events-none" : "opacity-100"
    )} style={{ borderColor: BORDER }}>
      <span className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <span className="text-[13px] font-semibold" style={{ color: TEXT }}>{block.project}</span>
        <div className="text-[11px] mt-0.5 tabular-nums" style={{ color: TEXT_2 }}>{block.from}–{block.to}</div>
        {block.note && <div className="text-[11px] mt-0.5 truncate" style={{ color: TEXT_3 }}>{block.note}</div>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        <span className="text-sm font-bold tabular-nums" style={{ color: TEXT }}>{fmtHM(dur)}</span>
        {!submitted && (
          <button onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-medium px-1.5 py-0.5 rounded border"
            style={{ borderColor: BORDER, color: TEXT_3 }}
            onMouseEnter={e => { e.currentTarget.style.color = "#DC2626"; e.currentTarget.style.borderColor = "#FECACA"; }}
            onMouseLeave={e => { e.currentTarget.style.color = TEXT_3; e.currentTarget.style.borderColor = BORDER; }}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

// ─── EntryForm (shared between list inline and calendar popup) ────────────────

function EntryForm({ from: initFrom = "09:00", to: initTo = "10:00", onAdd, onCancel, compact = false }: {
  from?: string; to?: string;
  onAdd: (p: string, from: string, to: string, note: string) => void;
  onCancel: () => void;
  compact?: boolean;
}) {
  const [project, setProject] = useState<string>(PROJECTS[0]);
  const [from, setFrom] = useState(initFrom);
  const [to, setTo]     = useState(initTo);
  const [note, setNote] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !from || !to) return;
    onAdd(project, from, to, note);
    setNote(""); onCancel();
  }

  const inputCls = "w-full h-7 px-2 text-xs rounded border bg-white focus:outline-none focus:ring-1 placeholder:text-gray-300 font-medium";
  return (
    <form onSubmit={submit} className={cn("space-y-1.5", compact ? "" : "")}>
      {!compact && (
        <div className="text-[11px] font-semibold uppercase tracking-wide pb-0.5" style={{ color: TEXT_3 }}>New entry</div>
      )}
      <Select value={project} onValueChange={v => v && setProject(v)}>
        <SelectTrigger className="h-7 text-xs rounded" style={{ borderColor: BORDER }}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROJECTS.map(p => (
            <SelectItem key={p} value={p} className="text-xs">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PROJECT_COLOR[p as Project] }} />
                {p}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-1 items-center">
        <input type="time" value={from} onChange={e => setFrom(e.target.value)}
          className={cn(inputCls, "flex-1")} style={{ borderColor: BORDER }} />
        <span className="text-gray-300 text-xs">–</span>
        <input type="time" value={to} onChange={e => setTo(e.target.value)}
          className={cn(inputCls, "flex-1")} style={{ borderColor: BORDER }} />
      </div>
      <input type="text" value={note} onChange={e => setNote(e.target.value)}
        placeholder="Notes (optional)" className={inputCls} style={{ borderColor: BORDER }} />
      <div className="flex gap-1.5 pt-0.5">
        <button type="submit"
          className="flex-1 h-7 rounded text-xs font-semibold text-white"
          style={{ backgroundColor: GREEN }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#376239")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = GREEN)}>
          Add entry
        </button>
        <button type="button" onClick={onCancel}
          className="h-7 px-3 rounded text-xs font-medium border"
          style={{ borderColor: BORDER, color: TEXT_2 }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── DayColumn (list view) ────────────────────────────────────────────────────

function DayColumn({ day, isToday, isCurrentWeek, allDays, onAcceptGhost, onDismissGhost,
  onAddBlock, onRemoveBlock, onSubmitDay, onSmartSuggest, isLoadingAI }: {
  day: DayData; isToday: boolean; isCurrentWeek: boolean;
  allDays: Record<DayKey, DayData>;
  onAcceptGhost: (id: string) => void; onDismissGhost: (id: string) => void;
  onAddBlock: (p: string, from: string, to: string, note: string) => void;
  onRemoveBlock: (id: string) => void; onSubmitDay: () => void;
  onSmartSuggest: () => void; isLoadingAI: boolean;
}) {
  const [showForm, setShowForm] = useState(false);

  const projectHoursWeek = new Map<string, number>();
  Object.values(allDays).forEach(d =>
    d.blocks.filter(b => !b.isGhost).forEach(b =>
      projectHoursWeek.set(b.project, (projectHoursWeek.get(b.project) ?? 0) + duration(b))
    )
  );
  const projectHoursToday = new Map<string, number>();
  day.blocks.filter(b => !b.isGhost).forEach(b =>
    projectHoursToday.set(b.project, (projectHoursToday.get(b.project) ?? 0) + duration(b))
  );
  let dominantProject: Project | null = null, dominantHours = 0;
  projectHoursToday.forEach((h, p) => {
    if (h > dominantHours && PROJECT_BUDGET[p as Project]) { dominantHours = h; dominantProject = p as Project; }
  });
  if (!dominantProject) {
    const fg = day.ghosts.find(g => PROJECT_BUDGET[g.project as Project]);
    if (fg) dominantProject = fg.project as Project;
  }

  const solidTotal = day.blocks.filter(b => !b.isGhost).reduce((s, b) => s + duration(b), 0);
  const isComplete = solidTotal >= 8, isPartial = solidTotal >= 6 && solidTotal < 8;
  const sorted = [...day.blocks, ...day.ghosts].sort((a, b) => parseTime(a.from) - parseTime(b.from));

  return (
    <div className={cn("flex flex-col bg-white rounded-xl border overflow-hidden transition-all duration-300", day.submitted ? "opacity-70" : "")}
      style={{
        borderColor: isToday && isCurrentWeek ? "#3B7DD8" : BORDER,
        boxShadow: isToday && isCurrentWeek ? "0 0 0 1.5px #3B7DD830, 0 2px 8px rgba(0,0,0,0.06)" : "0 1px 3px rgba(0,0,0,0.05)",
      }}>

      {/* Header */}
      <div className="px-3.5 pt-3 pb-0" style={{ borderBottom: `2px solid ${isToday && isCurrentWeek ? "#3B7DD8" : "transparent"}` }}>
        <div className="flex items-start justify-between gap-2 pb-2.5">
          <div>
            {isToday && isCurrentWeek && (
              <div className="text-[9px] font-bold uppercase tracking-widest mb-1 px-1.5 py-0.5 rounded inline-block" style={{ backgroundColor: "#3B7DD8", color: "white" }}>Today</div>
            )}
            {day.submitted && (
              <div className="text-[9px] font-bold uppercase tracking-widest mb-1 px-1.5 py-0.5 rounded inline-block" style={{ backgroundColor: "#D1FAE5", color: "#059669" }}>Done</div>
            )}
            <div className="text-sm font-bold" style={{ color: isToday && isCurrentWeek ? "#3B7DD8" : TEXT }}>{day.label}</div>
            <div className="text-[11px]" style={{ color: TEXT_3 }}>{day.date}</div>
            <div className="mt-1.5 flex items-baseline gap-1">
              <span className={cn("text-xl font-bold tabular-nums leading-none transition-colors duration-300",
                isComplete ? "text-emerald-600" : isPartial ? "text-amber-500" : solidTotal > 0 ? "text-red-400" : ""
              )} style={solidTotal === 0 ? { color: "#C8C4BC" } : {}}>
                {fmtHM(solidTotal)}
              </span>
              <span className="text-xs" style={{ color: TEXT_3 }}>/ 8:00</span>
            </div>
          </div>
          {dominantProject && <BudgetRing project={dominantProject} weekHours={projectHoursWeek.get(dominantProject) ?? 0} />}
        </div>
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto px-3.5" style={{ minHeight: "160px", maxHeight: "320px" }}>
        {sorted.length === 0 && !isLoadingAI && !showForm && (
          <div className="flex flex-col items-center justify-center h-24 select-none">
            <p className="text-xs" style={{ color: TEXT_3 }}>No time reported</p>
          </div>
        )}
        {sorted.map(block =>
          block.isGhost
            ? <GhostRow key={block.id} block={block} onAccept={() => onAcceptGhost(block.id)} onDismiss={() => onDismissGhost(block.id)} />
            : <EntryRow key={block.id} block={block} onRemove={() => onRemoveBlock(block.id)} submitted={day.submitted} />
        )}
        {isLoadingAI && (
          <div className="flex items-center gap-2 py-3 border-b" style={{ borderColor: `${ORANGE}40` }}>
            <span className="w-3 h-3 rounded-full border-2 shrink-0" style={{ borderColor: `${ORANGE}40`, borderTopColor: ORANGE, animation: "spin 0.7s linear infinite" }} />
            <span className="text-xs font-medium" style={{ color: ORANGE }}>Generating suggestions…</span>
          </div>
        )}
        {showForm && !day.submitted && (
          <div className="py-2">
            <EntryForm onAdd={(p, f, t, n) => onAddBlock(p, f, t, n)} onCancel={() => setShowForm(false)} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3.5 py-3 border-t space-y-1.5" style={{ borderColor: BORDER }}>
        {day.submitted ? (
          <div className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium" style={{ color: TEXT_3 }}>
            <span style={{ color: "#059669" }}>✓</span> Submitted &amp; locked
          </div>
        ) : (
          <>
            {!showForm && (
              <button onClick={() => setShowForm(true)}
                className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: GREEN }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#376239")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = GREEN)}>
                + Add entry
              </button>
            )}
            <button onClick={onSmartSuggest} disabled={isLoadingAI || showForm}
              className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-semibold border border-dashed transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: `${ORANGE}60`, color: ORANGE, backgroundColor: `${ORANGE}06` }}
              onMouseEnter={e => !isLoadingAI && (e.currentTarget.style.backgroundColor = `${ORANGE}10`)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = `${ORANGE}06`)}>
              {isLoadingAI ? (
                <><span className="w-3 h-3 rounded-full border-2 shrink-0" style={{ borderColor: `${ORANGE}40`, borderTopColor: ORANGE, animation: "spin 0.7s linear infinite" }} /> Thinking…</>
              ) : <>✦ Smart suggest</>}
            </button>
            <button onClick={onSubmitDay}
              className="w-full h-7 rounded-lg text-xs font-medium border"
              style={{ borderColor: BORDER, color: TEXT_2 }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = BG_PAGE)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
              Submit day for approval
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── CalendarBlock ────────────────────────────────────────────────────────────

function CalendarBlock({ block, top, height, isGhost, onAccept, onDismiss, onRemove, submitted }: {
  block: TimeBlock; top: number; height: number; isGhost: boolean;
  onAccept?: () => void; onDismiss?: () => void; onRemove?: () => void; submitted?: boolean;
}) {
  const color = PROJECT_COLOR[block.project as Project] ?? "#6B7280";
  const bg    = PROJECT_BG[block.project as Project]    ?? "#F4F5F6";
  const src   = SRC[block.source];
  const MIN_H = 22;

  return (
    <div
      data-block="true"
      className={cn(
        "absolute left-0.5 right-0.5 rounded-md overflow-hidden group transition-all duration-200 select-none",
        block.removing ? "opacity-0 scale-95 pointer-events-none" : "",
        isGhost ? "border-dashed border-2" : "border"
      )}
      style={{
        top: top + 1,
        height: Math.max(height - 2, MIN_H),
        borderColor: isGhost ? `${color}90` : `${color}55`,
        backgroundColor: isGhost ? `${color}18` : bg,
        opacity: block.removing ? 0 : isGhost ? 0.65 : 1,
        zIndex: isGhost ? 1 : 2,
      }}>

      <div className="px-1.5 pt-1 pb-1 h-full flex flex-col gap-0.5">
        {/* Top row: project dot + name + source badge */}
        <div className="flex items-start gap-1 overflow-hidden">
          <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: color }} />
          <span className="text-[10px] font-bold leading-tight truncate flex-1" style={{ color: TEXT }}>{block.project}</span>
          {src && height > 36 && (
            <span className="text-[8px] font-bold px-1 rounded shrink-0 leading-tight" style={{ backgroundColor: src.bg, color: src.color }}>{src.label}</span>
          )}
        </div>

        {/* Note */}
        {block.note && height > 38 && (
          <div className="text-[9px] truncate leading-tight" style={{ color: TEXT_2 }}>{block.note}</div>
        )}

        {/* Time range */}
        {height > 48 && (
          <div className="text-[9px] tabular-nums" style={{ color: TEXT_3 }}>{block.from}–{block.to}</div>
        )}

        {/* Ghost accept/dismiss */}
        {isGhost && height > 56 && (
          <div className="flex gap-1 mt-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <button onClick={e => { e.stopPropagation(); onAccept?.(); }}
              className="flex-1 text-[9px] font-bold py-0.5 rounded text-white"
              style={{ backgroundColor: GREEN }}>✓</button>
            <button onClick={e => { e.stopPropagation(); onDismiss?.(); }}
              className="flex-1 text-[9px] font-bold py-0.5 rounded border"
              style={{ borderColor: BORDER, color: TEXT_3, backgroundColor: "white" }}>✕</button>
          </div>
        )}

        {/* Quick accept on small ghost blocks */}
        {isGhost && height <= 56 && (
          <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/70 rounded-md">
            <button onClick={e => { e.stopPropagation(); onAccept?.(); }}
              className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center"
              style={{ backgroundColor: GREEN }}>✓</button>
            <button onClick={e => { e.stopPropagation(); onDismiss?.(); }}
              className="w-6 h-6 rounded-full text-xs font-bold border flex items-center justify-center"
              style={{ borderColor: BORDER, color: TEXT_3, backgroundColor: "white" }}>✕</button>
          </div>
        )}

        {/* Remove button for solid block */}
        {!isGhost && !submitted && (
          <button onClick={e => { e.stopPropagation(); onRemove?.(); }}
            className="absolute top-1 right-1 w-4 h-4 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px]"
            style={{ backgroundColor: `${color}25`, color: TEXT_2 }}>✕</button>
        )}
      </div>
    </div>
  );
}

// ─── Calendar popover (click-to-add) ─────────────────────────────────────────

function CalendarPopover({ dayKey, from, to, x, y, onAdd, onClose }: {
  dayKey: DayKey; from: string; to: string; x: number; y: number;
  onAdd: (p: string, from: string, to: string, note: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const W = 272, H = 220;
  const left = Math.min(x + 12, (typeof window !== "undefined" ? window.innerWidth : 1200) - W - 16);
  const top  = Math.min(y - 20, (typeof window !== "undefined" ? window.innerHeight : 800) - H - 16);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref}
      className="fixed z-50 bg-white rounded-xl border shadow-2xl p-4"
      style={{ left, top, width: W, borderColor: BORDER }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold" style={{ color: TEXT }}>New entry — {DAY_LABELS[dayKey]}</span>
        <button onClick={onClose} className="text-xs w-5 h-5 rounded flex items-center justify-center"
          style={{ color: TEXT_3 }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = BG_PAGE)}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>✕</button>
      </div>
      <EntryForm from={from} to={to} onAdd={onAdd} onCancel={onClose} compact />
    </div>
  );
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

function CalendarView({ days, isCurrentWeek, todayKey, onAcceptGhost, onDismissGhost,
  onAddBlock, onRemoveBlock, loadingAI, onSmartSuggest }: {
  days: Record<DayKey, DayData>; isCurrentWeek: boolean; todayKey: DayKey | null;
  onAcceptGhost: (dayKey: DayKey, id: string) => void;
  onDismissGhost: (dayKey: DayKey, id: string) => void;
  onAddBlock: (dayKey: DayKey, p: string, from: string, to: string, note: string) => void;
  onRemoveBlock: (dayKey: DayKey, id: string) => void;
  loadingAI: DayKey | null;
  onSmartSuggest: (dayKey: DayKey) => void;
}) {
  const [popover, setPopover] = useState<{ dayKey: DayKey; from: string; to: string; x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const HOURS = Array.from({ length: CAL_END - CAL_START }, (_, i) => CAL_START + i);
  const TOTAL_H = (CAL_END - CAL_START) * HOUR_PX;

  function handleColumnClick(e: React.MouseEvent<HTMLDivElement>, dayKey: DayKey) {
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    if (days[dayKey].submitted) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    const localY = e.clientY - rect.top + scrollTop;
    const rawHour = CAL_START + localY / HOUR_PX;
    const snapped = Math.floor(rawHour * 2) / 2;
    const fromH = Math.max(CAL_START, Math.min(CAL_END - 1, snapped));
    const toH   = Math.min(CAL_END, fromH + 1);
    const from = hourToTime(fromH);
    const to   = hourToTime(toH);
    setPopover({ dayKey, from, to, x: e.clientX, y: e.clientY });
  }

  return (
    <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: BORDER, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

      {/* ── Sticky header row ── */}
      <div className="sticky top-0 z-10 border-b bg-white" style={{ borderColor: BORDER }}>
        {/* Smart suggest row */}
        <div className="grid border-b" style={{ gridTemplateColumns: `52px repeat(5, 1fr)`, borderColor: BORDER }}>
          <div />
          {DAY_KEYS.map(k => {
            const isToday = k === todayKey && isCurrentWeek;
            const day = days[k];
            const total = day.blocks.filter(b => !b.isGhost).reduce((s, b) => s + duration(b), 0);
            return (
              <div key={k} className="px-2 py-2 border-l" style={{ borderColor: BORDER, backgroundColor: isToday && isCurrentWeek ? "#F0F6FF" : "white" }}>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div>
                    <div className="flex items-center gap-1.5">
                      {isToday && isCurrentWeek && (
                        <span className="text-[8px] font-bold uppercase tracking-widest px-1 py-0.5 rounded" style={{ backgroundColor: "#3B7DD8", color: "white" }}>Today</span>
                      )}
                      {day.submitted && (
                        <span className="text-[8px] font-bold uppercase tracking-widest px-1 py-0.5 rounded" style={{ backgroundColor: "#D1FAE5", color: "#059669" }}>Done</span>
                      )}
                    </div>
                    <div className="text-xs font-bold" style={{ color: isToday && isCurrentWeek ? "#3B7DD8" : TEXT }}>{k}</div>
                    <div className="text-[10px]" style={{ color: TEXT_3 }}>{day.date}</div>
                  </div>
                  <div className="text-right">
                    <span className={cn("text-base font-bold tabular-nums leading-none block",
                      total >= 8 ? "text-emerald-600" : total >= 6 ? "text-amber-500" : total > 0 ? "text-red-400" : ""
                    )} style={total === 0 ? { color: "#C8C4BC" } : {}}>{fmtHM(total)}</span>
                    <span className="text-[9px]" style={{ color: TEXT_3 }}>/ 8:00</span>
                  </div>
                </div>

                {/* Smart suggest */}
                {!day.submitted && (
                  <button onClick={() => onSmartSuggest(k)} disabled={loadingAI === k}
                    className="w-full flex items-center justify-center gap-1 h-6 rounded text-[10px] font-semibold border border-dashed transition-all disabled:opacity-50"
                    style={{ borderColor: `${ORANGE}50`, color: ORANGE, backgroundColor: `${ORANGE}06` }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = `${ORANGE}10`)}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = `${ORANGE}06`)}>
                    {loadingAI === k
                      ? <><span className="w-2.5 h-2.5 rounded-full border-2 shrink-0" style={{ borderColor: `${ORANGE}40`, borderTopColor: ORANGE, animation: "spin 0.7s linear infinite" }} /></>
                      : <>✦ Suggest</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable grid ── */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: "520px" }}>
        <div className="flex">

          {/* Time axis */}
          <div className="shrink-0 border-r" style={{ width: 52, borderColor: BORDER }}>
            <div style={{ height: TOTAL_H, position: "relative" }}>
              {HOURS.map(h => (
                <div key={h} className="absolute flex items-start justify-end pr-2 w-full"
                  style={{ top: (h - CAL_START) * HOUR_PX, height: HOUR_PX }}>
                  <span className="text-[10px] tabular-nums -mt-2" style={{ color: TEXT_3 }}>
                    {h < 12 ? `${h}` : h === 12 ? "12" : `${h - 12}`}
                    <span style={{ color: TEXT_3, fontSize: "8px" }}>{h < 12 ? "AM" : "PM"}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Day columns */}
          {DAY_KEYS.map(dayKey => {
            const day = days[dayKey];
            const isToday = dayKey === todayKey && isCurrentWeek;
            return (
              <div key={dayKey}
                className="flex-1 border-l relative"
                style={{ height: TOTAL_H, borderColor: BORDER, backgroundColor: isToday ? "#F8FAFF" : "white", cursor: day.submitted ? "default" : "crosshair" }}
                onClick={e => handleColumnClick(e, dayKey)}>

                {/* Hourly grid lines */}
                {HOURS.map(h => (
                  <div key={h}>
                    <div className="absolute w-full border-t" style={{ top: (h - CAL_START) * HOUR_PX, borderColor: "#F0EDE8" }} />
                    <div className="absolute w-full border-t border-dashed" style={{ top: (h - CAL_START) * HOUR_PX + HOUR_PX / 2, borderColor: "#F8F5F0" }} />
                  </div>
                ))}

                {/* Ghost blocks */}
                {day.ghosts.map(block => (
                  <CalendarBlock key={block.id} block={block}
                    top={timeToY(block.from)}
                    height={Math.max(duration(block) * HOUR_PX, 22)}
                    isGhost={true}
                    onAccept={() => onAcceptGhost(dayKey, block.id)}
                    onDismiss={() => onDismissGhost(dayKey, block.id)}
                  />
                ))}

                {/* Solid blocks */}
                {day.blocks.map(block => (
                  <CalendarBlock key={block.id} block={block}
                    top={timeToY(block.from)}
                    height={Math.max(duration(block) * HOUR_PX, 22)}
                    isGhost={false}
                    onRemove={() => onRemoveBlock(dayKey, block.id)}
                    submitted={day.submitted}
                  />
                ))}

                {/* Loading overlay */}
                {loadingAI === dayKey && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: `${ORANGE}06` }}>
                    <span className="w-5 h-5 rounded-full border-2" style={{ borderColor: `${ORANGE}30`, borderTopColor: ORANGE, animation: "spin 0.7s linear infinite" }} />
                  </div>
                )}

                {/* No time reported */}
                {day.blocks.length === 0 && day.ghosts.length === 0 && !loadingAI && (
                  <div className="absolute inset-0 flex items-start justify-center pt-8 pointer-events-none">
                    <span className="text-[10px]" style={{ color: TEXT_3 }}>No time reported</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Click-to-add popover */}
      {popover && (
        <CalendarPopover
          dayKey={popover.dayKey}
          from={popover.from}
          to={popover.to}
          x={popover.x}
          y={popover.y}
          onAdd={(p, f, t, n) => { onAddBlock(popover.dayKey, p, f, t, n); setPopover(null); }}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
}

// ─── Main app ─────────────────────────────────────────────────────────────────

const DAY_KEYS: DayKey[]                 = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_LABELS: Record<DayKey, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday" };

function buildDays(weekOffset: number): Record<DayKey, DayData> {
  const dates = buildWeekDates(weekOffset);
  const init = {} as Record<DayKey, DayData>;
  DAY_KEYS.forEach(k => {
    init[k] = {
      key: k, label: DAY_LABELS[k], shortLabel: k,
      date: dates[k].display, isoDate: dates[k].iso,
      blocks: [], ghosts: weekOffset === 0 ? initGhosts(k) : [],
      submitted: false,
    };
  });
  return init;
}

export default function TimesheetApp() {
  const [weekOffset, setWeekOffset]   = useState(0);
  const [viewMode, setViewMode]       = useState<ViewMode>("list");
  const [daysByWeek, setDaysByWeek]   = useState<Record<number, Record<DayKey, DayData>>>({ 0: buildDays(0) });
  const [loadingAI, setLoadingAI]     = useState<DayKey | null>(null);
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  useEffect(() => () => { timeoutRefs.current.forEach(clearTimeout); }, []);

  useEffect(() => {
    if (!daysByWeek[weekOffset])
      setDaysByWeek(prev => ({ ...prev, [weekOffset]: buildDays(weekOffset) }));
  }, [weekOffset]);

  const days = daysByWeek[weekOffset] ?? buildDays(weekOffset);

  const todayDow = new Date().getDay();
  const DOW_MAP: Record<number, DayKey> = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri" };
  const todayKey: DayKey | null = DOW_MAP[todayDow] ?? null;

  function updateDay(dayKey: DayKey, updater: (d: DayData) => DayData) {
    setDaysByWeek(prev => ({
      ...prev,
      [weekOffset]: { ...prev[weekOffset], [dayKey]: updater(prev[weekOffset][dayKey]) },
    }));
  }

  function animateRemove(dayKey: DayKey, blockId: string, kind: "ghost" | "block", afterFn: () => void) {
    updateDay(dayKey, d => ({
      ...d,
      [kind === "ghost" ? "ghosts" : "blocks"]: (kind === "ghost" ? d.ghosts : d.blocks).map(
        b => b.id === blockId ? { ...b, removing: true } : b
      ),
    }));
    const t = setTimeout(() => { afterFn(); timeoutRefs.current.delete(blockId); }, 240);
    timeoutRefs.current.set(blockId, t);
  }

  const acceptGhost  = useCallback((dayKey: DayKey, ghostId: string) => {
    animateRemove(dayKey, ghostId, "ghost", () =>
      updateDay(dayKey, d => {
        const ghost = d.ghosts.find(g => g.id === ghostId);
        if (!ghost) return d;
        return { ...d, ghosts: d.ghosts.filter(g => g.id !== ghostId), blocks: [...d.blocks, { ...ghost, isGhost: false, removing: false }] };
      })
    );
  }, [weekOffset]);

  const dismissGhost = useCallback((dayKey: DayKey, ghostId: string) => {
    animateRemove(dayKey, ghostId, "ghost", () =>
      updateDay(dayKey, d => ({ ...d, ghosts: d.ghosts.filter(g => g.id !== ghostId) }))
    );
  }, [weekOffset]);

  function addBlock(dayKey: DayKey, project: string, from: string, to: string, note: string) {
    updateDay(dayKey, d => ({
      ...d, blocks: [...d.blocks, { id: nanoid(), project, from, to, note, isGhost: false, source: "manual" as BlockSource }],
    }));
  }

  const removeBlock = useCallback((dayKey: DayKey, blockId: string) => {
    animateRemove(dayKey, blockId, "block", () =>
      updateDay(dayKey, d => ({ ...d, blocks: d.blocks.filter(b => b.id !== blockId) }))
    );
  }, [weekOffset]);

  function submitDay(dayKey: DayKey) {
    updateDay(dayKey, d => ({ ...d, submitted: true }));
  }

  async function smartSuggest(dayKey: DayKey) {
    if (loadingAI) return;
    setLoadingAI(dayKey);
    await new Promise(r => setTimeout(r, 1200));
    updateDay(dayKey, d => ({
      ...d, ghosts: [...d.ghosts, ...MOCK_SUGGESTIONS[dayKey].map(s => ({
        id: nanoid(), project: s.project, from: s.from, to: s.to,
        note: s.note, isGhost: true, source: "ai" as BlockSource,
      }))],
    }));
    setLoadingAI(null);
  }

  const weekTotal       = Object.values(days).flatMap(d => d.blocks.filter(b => !b.isGhost)).reduce((s, b) => s + duration(b), 0);
  const submittedCount  = Object.values(days).filter(d => d.submitted).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: BG_PAGE, fontFamily: "var(--font-sans)" }}>

      {/* ── Nav ── */}
      <nav style={{ backgroundColor: NAV_BG }}>
        <div className="max-w-[1440px] mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded flex items-center justify-center text-white font-black text-xs" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>T</div>
              <span className="text-white font-bold text-sm tracking-tight">Timesheet</span>
            </div>
            {(["Time", "Projects", "Reports"] as const).map(label => (
              <button key={label}
                className="text-xs font-medium px-2.5 py-1 rounded transition-colors"
                style={{ color: label === "Time" ? "white" : "rgba(255,255,255,0.65)", backgroundColor: label === "Time" ? "rgba(255,255,255,0.15)" : "transparent" }}
                onMouseEnter={e => { if (label !== "Time") e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { if (label !== "Time") e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Settings</span>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}>JS</div>
            <span className="text-xs text-white font-medium">Jane</span>
          </div>
        </div>
      </nav>

      {/* ── Sub-tabs ── */}
      <div className="bg-white border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-[1440px] mx-auto px-5 flex items-center">
          {(["Timesheet", "Pending approval", "Unsubmitted", "Approved"] as const).map(tab => (
            <button key={tab}
              className="px-4 py-3 text-xs font-semibold border-b-2 transition-colors"
              style={{ borderColor: tab === "Timesheet" ? ORANGE : "transparent", color: tab === "Timesheet" ? ORANGE : TEXT_3 }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="bg-white border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-[1440px] mx-auto px-5 h-12 flex items-center justify-between">
          {/* Week nav */}
          <div className="flex items-center gap-2">
            {[{ icon: "←", delta: -1 }, { icon: "→", delta: 1 }].map(({ icon, delta }) => (
              <button key={icon} onClick={() => setWeekOffset(w => w + delta)}
                className="w-7 h-7 rounded border flex items-center justify-center text-sm font-medium"
                style={{ borderColor: BORDER, color: TEXT_2 }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = BG_PAGE)}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "white")}>
                {icon}
              </button>
            ))}
            <h2 className="text-base font-bold ml-1" style={{ color: TEXT }}>
              {weekOffset === 0
                ? `Today: ${new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`
                : weekRangeLabel(weekOffset)}
            </h2>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)}
                className="text-xs font-medium ml-2"
                style={{ color: ORANGE }}>
                Return to this week
              </button>
            )}
          </div>

          {/* Right: view toggle + week total + dots */}
          <div className="flex items-center gap-4">
            {/* View toggle (Harvest/Toggl style) */}
            <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: BORDER }}>
              {(["list", "calendar"] as ViewMode[]).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className="px-3 h-7 text-xs font-semibold transition-colors capitalize"
                  style={{
                    backgroundColor: viewMode === mode ? ORANGE : "white",
                    color: viewMode === mode ? "white" : TEXT_2,
                    borderRight: mode === "list" ? `1px solid ${BORDER}` : "none",
                  }}>
                  {mode === "list" ? "List" : "Week"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {DAY_KEYS.map(k => (
                <div key={k} className="w-1.5 h-1.5 rounded-full transition-all" style={{ backgroundColor: days[k]?.submitted ? "#34D399" : BORDER }} />
              ))}
              <span className="text-xs ml-1 font-medium" style={{ color: TEXT_3 }}>{submittedCount}/5</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xs font-medium" style={{ color: TEXT_3 }}>Week total</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: TEXT }}>{fmtHM(weekTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-5 py-5">

        {viewMode === "list" ? (
          <>
            <div className="grid grid-cols-5 gap-3">
              {DAY_KEYS.map(k => (
                <DayColumn
                  key={`${weekOffset}-${k}`}
                  day={days[k]}
                  isToday={todayKey === k}
                  isCurrentWeek={weekOffset === 0}
                  allDays={days}
                  onAcceptGhost={id => acceptGhost(k, id)}
                  onDismissGhost={id => dismissGhost(k, id)}
                  onAddBlock={(p, f, t, n) => addBlock(k, p, f, t, n)}
                  onRemoveBlock={id => removeBlock(k, id)}
                  onSubmitDay={() => submitDay(k)}
                  onSmartSuggest={() => smartSuggest(k)}
                  isLoadingAI={loadingAI === k}
                />
              ))}
            </div>
            <div className="flex justify-end mt-5">
              <button
                className="h-9 px-5 rounded-lg text-sm font-semibold border transition-all"
                style={{ borderColor: BORDER, color: TEXT_2, backgroundColor: "white" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#AAA69E"; e.currentTarget.style.backgroundColor = BG_PAGE; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.backgroundColor = "white"; }}>
                Submit week for approval
              </button>
            </div>
          </>
        ) : (
          <>
            <CalendarView
              days={days}
              isCurrentWeek={weekOffset === 0}
              todayKey={todayKey}
              onAcceptGhost={acceptGhost}
              onDismissGhost={dismissGhost}
              onAddBlock={addBlock}
              onRemoveBlock={removeBlock}
              loadingAI={loadingAI}
              onSmartSuggest={smartSuggest}
            />
            <div className="flex justify-end mt-5">
              <button
                className="h-9 px-5 rounded-lg text-sm font-semibold border transition-all"
                style={{ borderColor: BORDER, color: TEXT_2, backgroundColor: "white" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#AAA69E"; e.currentTarget.style.backgroundColor = BG_PAGE; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.backgroundColor = "white"; }}>
                Submit week for approval
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
