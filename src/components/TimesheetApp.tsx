"use client";

import { useState, useEffect, useRef } from "react";
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

const ACCENT = "#E07348";           // Harvest-ish warm orange
const BG_PAGE = "#F4F2EF";          // warm off-white
const BORDER = "#E3DED7";           // warm gray border
const TEXT_PRIMARY = "#1A1917";
const TEXT_SECONDARY = "#6B6760";
const TEXT_MUTED = "#9E9A94";

// ─── Mock data ────────────────────────────────────────────────────────────────

const PROJECTS = [
  "Project Alpha",
  "Project Beta",
  "Internal / Admin",
  "Client Workshop",
] as const;

type Project = (typeof PROJECTS)[number];

const PROJECT_COLOR: Record<Project, string> = {
  "Project Alpha":   "#3B7DD8",
  "Project Beta":    "#7A5CBF",
  "Internal / Admin":"#7A8694",
  "Client Workshop": "#D4893A",
};

const PROJECT_BG: Record<Project, string> = {
  "Project Alpha":   "#EDF4FF",
  "Project Beta":    "#F3EEFF",
  "Internal / Admin":"#F4F5F6",
  "Client Workshop": "#FFF4E8",
};

const PROJECT_BUDGET: Record<Project, { total: number; used: number } | null> = {
  "Project Alpha":   { total: 40, used: 22 },
  "Project Beta":    { total: 20, used: 8 },
  "Internal / Admin": null,
  "Client Workshop": { total: 16, used: 5 },
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

function nanoid() {
  return Math.random().toString(36).slice(2, 10);
}

function parseTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}

function duration(b: TimeBlock) {
  return Math.max(0, parseTime(b.to) - parseTime(b.from));
}

function fmtHours(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

/** Returns the Monday of the current week + weekOffset weeks */
function getMondayOf(weekOffset: number): Date {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function buildWeekDates(weekOffset: number): Record<DayKey, { display: string; iso: string }> {
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
  const m = monday.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const f = friday.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return `${m} – ${f}`;
}

function initGhosts(dayKey: DayKey): TimeBlock[] {
  const ghosts: TimeBlock[] = [];
  const cal = CALENDAR_EVENTS[dayKey] ?? [];
  cal.forEach((ev) =>
    ghosts.push({ id: nanoid(), project: ev.project, from: ev.from, to: ev.to, note: ev.note, isGhost: true, source: "calendar" })
  );
  (PAST_ENTRIES[dayKey] ?? []).forEach((entry) => {
    const overlap = cal.some((ev) => ev.from === entry.from && ev.to === entry.to);
    if (!overlap)
      ghosts.push({ id: nanoid(), project: entry.project, from: entry.from, to: entry.to, note: entry.note, isGhost: true, source: "history" });
  });
  return ghosts;
}

// ─── BudgetRing ───────────────────────────────────────────────────────────────

function BudgetRing({ project, weekHours }: { project: Project; weekHours: number }) {
  const budget = PROJECT_BUDGET[project];
  if (!budget) return null;

  const SIZE = 48, SW = 4.5, cx = SIZE / 2, r = cx - SW;
  const circ = 2 * Math.PI * r;
  const used = budget.used + weekHours;
  const fraction = Math.min(1, used / budget.total);
  const remaining = Math.max(0, budget.total - used);
  const color = PROJECT_COLOR[project];
  const isOver = used > budget.total;

  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#EDE9E3" strokeWidth={SW} />
        <circle
          cx={cx} cy={cx} r={r} fill="none"
          stroke={isOver ? "#E07348" : color}
          strokeWidth={SW}
          strokeDasharray={`${fraction * circ} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: "stroke-dasharray 0.45s ease" }}
        />
        <text x={cx} y={cx + 3.5} textAnchor="middle" fontSize="8.5" fontWeight="700"
          fill={isOver ? "#E07348" : TEXT_PRIMARY}
          style={{ fontFamily: "var(--font-sans)" }}>
          {isOver ? "over" : `${remaining}h`}
        </text>
      </svg>
      <span className="text-[9px] font-medium" style={{ color: TEXT_MUTED }}>left</span>
    </div>
  );
}

// ─── DailyTotal ───────────────────────────────────────────────────────────────

function DailyTotal({ blocks }: { blocks: TimeBlock[] }) {
  const total = blocks.filter((b) => !b.isGhost).reduce((s, b) => s + duration(b), 0);
  const isGreen = total >= 8;
  const isAmber = total >= 6 && total < 8;
  const hasAny = total > 0;

  return (
    <div className={cn(
      "inline-flex items-baseline gap-1 tabular-nums transition-all duration-300",
    )}>
      <span className={cn(
        "text-base font-bold transition-colors duration-300",
        isGreen && "text-emerald-600",
        isAmber && "text-amber-500",
        !isGreen && !isAmber && hasAny && "text-red-400",
        !hasAny && "text-gray-300",
      )}>
        {fmtHours(total)}
      </span>
      <span className="text-xs font-medium" style={{ color: TEXT_MUTED }}>/ 8h</span>
    </div>
  );
}

// ─── Source badge ─────────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<BlockSource, { label: string; bg: string; color: string }> = {
  calendar: { label: "CAL",  bg: "#EDF4FF", color: "#3B7DD8" },
  history:  { label: "HIST", bg: "#F3EEFF", color: "#7A5CBF" },
  ai:       { label: "AI",   bg: "#FFF4E8", color: "#D4893A" },
  manual:   { label: "",     bg: "transparent", color: "transparent" },
};

// ─── GhostBlock ───────────────────────────────────────────────────────────────

function GhostBlock({ block, onAccept, onDismiss }: {
  block: TimeBlock; onAccept: () => void; onDismiss: () => void;
}) {
  const color = PROJECT_COLOR[block.project as Project] ?? "#6B7280";
  const dur = duration(block);
  const src = SOURCE_LABEL[block.source];

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-dashed p-2.5 transition-all duration-200 ease-out cursor-default",
        block.removing
          ? "opacity-0 translate-x-1.5 scale-[0.97] pointer-events-none max-h-0 overflow-hidden py-0 mb-0"
          : "opacity-50 hover:opacity-90"
      )}
      style={{ borderColor: `${color}80`, backgroundColor: `${color}08` }}
    >
      <div className="flex items-start justify-between gap-2 pr-14">
        <div className="flex-1 min-w-0">
          {/* Project line */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[11px] font-semibold truncate" style={{ color: TEXT_PRIMARY }}>
              {block.project}
            </span>
          </div>
          {/* Time + duration */}
          <div className="text-[11px] tabular-nums" style={{ color: TEXT_SECONDARY }}>
            {block.from}–{block.to}
            <span className="ml-1.5 font-semibold" style={{ color: ACCENT }}>{fmtHours(dur)}</span>
          </div>
          {block.note && (
            <div className="text-[10px] mt-0.5 truncate" style={{ color: TEXT_MUTED }}>{block.note}</div>
          )}
        </div>

        {/* Source badge */}
        {src.label && (
          <span className="absolute top-2.5 right-2.5 text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded"
            style={{ backgroundColor: src.bg, color: src.color }}>
            {src.label}
          </span>
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button onClick={onAccept}
          className="h-6 px-2 rounded text-[10px] font-bold text-white transition-colors"
          style={{ backgroundColor: "#3DAA6E" }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#2E9960")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#3DAA6E")}
          title="Accept">
          ✓ Accept
        </button>
        <button onClick={onDismiss}
          className="h-6 px-2 rounded text-[10px] font-bold border transition-colors"
          style={{ borderColor: BORDER, color: TEXT_MUTED, backgroundColor: "white" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#DC3545"; e.currentTarget.style.borderColor = "#FECACA"; }}
          onMouseLeave={e => { e.currentTarget.style.color = TEXT_MUTED; e.currentTarget.style.borderColor = BORDER; }}
          title="Dismiss">
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── SolidBlock ───────────────────────────────────────────────────────────────

function SolidBlock({ block, onRemove, submitted }: {
  block: TimeBlock; onRemove: () => void; submitted: boolean;
}) {
  const color = PROJECT_COLOR[block.project as Project] ?? "#6B7280";
  const bg    = PROJECT_BG[block.project as Project]    ?? "#F9FAFB";
  const dur   = duration(block);

  return (
    <div
      className={cn(
        "group relative rounded-lg border p-2.5 transition-all duration-200 ease-out block-appear",
        block.removing ? "opacity-0 scale-[0.97] pointer-events-none max-h-0 overflow-hidden py-0 mb-0" : "opacity-100"
      )}
      style={{ backgroundColor: bg, borderColor: `${color}40` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[11px] font-semibold truncate" style={{ color: TEXT_PRIMARY }}>
              {block.project}
            </span>
          </div>
          <div className="text-[11px] tabular-nums" style={{ color: TEXT_SECONDARY }}>
            {block.from}–{block.to}
            <span className="ml-1.5 font-semibold" style={{ color: ACCENT }}>{fmtHours(dur)}</span>
          </div>
          {block.note && (
            <div className="text-[10px] mt-0.5 truncate" style={{ color: TEXT_MUTED }}>{block.note}</div>
          )}
        </div>

        {!submitted && (
          <button onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] hover:bg-red-50"
            style={{ color: TEXT_MUTED }}
            onMouseEnter={e => (e.currentTarget.style.color = "#DC3545")}
            onMouseLeave={e => (e.currentTarget.style.color = TEXT_MUTED)}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ─── QuickAddForm ─────────────────────────────────────────────────────────────

function QuickAddForm({ onAdd, disabled }: {
  onAdd: (p: string, from: string, to: string, note: string) => void;
  disabled: boolean;
}) {
  const [project, setProject] = useState<string>(PROJECTS[0]);
  const [from, setFrom]       = useState("09:00");
  const [to, setTo]           = useState("10:00");
  const [note, setNote]       = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !from || !to) return;
    onAdd(project, from, to, note);
    setNote("");
  }

  const inputBase = cn(
    "w-full h-8 px-2.5 text-xs rounded-md border bg-white",
    "focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-300",
    "disabled:opacity-40 transition-colors font-medium placeholder:text-gray-300"
  );

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <Select value={project} onValueChange={(v) => v && setProject(v)} disabled={disabled}>
        <SelectTrigger className="h-8 text-xs rounded-md"
          style={{ borderColor: BORDER }}>
          <SelectValue placeholder="Project" />
        </SelectTrigger>
        <SelectContent>
          {PROJECTS.map((p) => (
            <SelectItem key={p} value={p} className="text-xs">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: PROJECT_COLOR[p as Project] }} />
                {p}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <input type="time" value={from} onChange={e => setFrom(e.target.value)}
          disabled={disabled} className={cn(inputBase, "flex-1")}
          style={{ borderColor: BORDER }} />
        <span className="text-gray-300 text-xs shrink-0">–</span>
        <input type="time" value={to} onChange={e => setTo(e.target.value)}
          disabled={disabled} className={cn(inputBase, "flex-1")}
          style={{ borderColor: BORDER }} />
      </div>

      <input type="text" value={note} onChange={e => setNote(e.target.value)}
        placeholder="Note (optional)" disabled={disabled}
        className={inputBase} style={{ borderColor: BORDER }} />

      <button type="submit" disabled={disabled}
        className="w-full h-8 rounded-md text-xs font-semibold text-white transition-colors disabled:opacity-40"
        style={{ backgroundColor: ACCENT }}
        onMouseEnter={e => !disabled && (e.currentTarget.style.backgroundColor = "#C85E38")}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = ACCENT)}>
        + Add entry
      </button>
    </form>
  );
}

// ─── DayColumn ────────────────────────────────────────────────────────────────

function DayColumn({ day, isToday, isCurrentWeek, allDays, onAcceptGhost, onDismissGhost,
  onAddBlock, onRemoveBlock, onSubmitDay, onSmartSuggest, isLoadingAI }: {
  day: DayData; isToday: boolean; isCurrentWeek: boolean;
  allDays: Record<DayKey, DayData>;
  onAcceptGhost: (id: string) => void; onDismissGhost: (id: string) => void;
  onAddBlock: (p: string, from: string, to: string, note: string) => void;
  onRemoveBlock: (id: string) => void; onSubmitDay: () => void;
  onSmartSuggest: () => void; isLoadingAI: boolean;
}) {
  // Project hours across the whole week for budget ring
  const projectHoursWeek = new Map<string, number>();
  Object.values(allDays).forEach((d) =>
    d.blocks.filter(b => !b.isGhost).forEach(b =>
      projectHoursWeek.set(b.project, (projectHoursWeek.get(b.project) ?? 0) + duration(b))
    )
  );

  // Dominant budgeted project for this day
  const projectHoursToday = new Map<string, number>();
  day.blocks.filter(b => !b.isGhost).forEach(b =>
    projectHoursToday.set(b.project, (projectHoursToday.get(b.project) ?? 0) + duration(b))
  );

  let dominantProject: Project | null = null;
  let dominantHours = 0;
  projectHoursToday.forEach((h, p) => {
    if (h > dominantHours && PROJECT_BUDGET[p as Project]) {
      dominantHours = h; dominantProject = p as Project;
    }
  });
  if (!dominantProject) {
    const firstGhost = day.ghosts.find(g => PROJECT_BUDGET[g.project as Project]);
    if (firstGhost) dominantProject = firstGhost.project as Project;
  }

  const sorted = [...day.blocks, ...day.ghosts].sort(
    (a, b) => parseTime(a.from) - parseTime(b.from)
  );

  const hasGhosts = day.ghosts.some(g => !g.removing);

  return (
    <div className={cn(
      "flex flex-col rounded-xl border overflow-hidden transition-all duration-300",
      isToday && isCurrentWeek
        ? "ring-2 shadow-md"
        : "shadow-sm",
      day.submitted ? "opacity-75" : ""
    )}
    style={{
      borderColor: isToday && isCurrentWeek ? "#3B7DD8" : BORDER,
      boxShadow: isToday && isCurrentWeek
        ? "0 0 0 2px #3B7DD830, 0 2px 8px rgba(0,0,0,0.07)"
        : "0 1px 4px rgba(0,0,0,0.05)",
      backgroundColor: "white",
    }}>

      {/* ── Column header ── */}
      <div className={cn("px-3 pt-3 pb-2.5 border-b")}
        style={{
          borderColor: BORDER,
          backgroundColor: isToday && isCurrentWeek ? "#F0F6FF" : "white",
        }}>
        <div className="flex items-start justify-between gap-1 mb-2">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              {isToday && isCurrentWeek && (
                <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: "#3B7DD8", color: "white" }}>
                  Today
                </span>
              )}
              {day.submitted && (
                <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: "#D1FAE5", color: "#059669" }}>
                  Done
                </span>
              )}
            </div>
            <div className="font-bold text-sm" style={{ color: isToday && isCurrentWeek ? "#3B7DD8" : TEXT_PRIMARY }}>
              {day.label}
            </div>
            <div className="text-[11px] font-medium" style={{ color: TEXT_MUTED }}>{day.date}</div>
          </div>

          {dominantProject && (
            <BudgetRing
              project={dominantProject}
              weekHours={projectHoursWeek.get(dominantProject) ?? 0}
            />
          )}
        </div>

        {/* Daily total */}
        <DailyTotal blocks={day.blocks} />
      </div>

      {/* ── Blocks ── */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1.5"
        style={{ minHeight: "220px", maxHeight: "360px", backgroundColor: "white" }}>

        {sorted.length === 0 && !isLoadingAI && (
          <div className="flex flex-col items-center justify-center h-24 select-none">
            <div className="text-xl mb-1" style={{ color: BORDER }}>·  ·  ·</div>
            <span className="text-xs" style={{ color: TEXT_MUTED }}>No entries yet</span>
          </div>
        )}

        {sorted.map((block) =>
          block.isGhost ? (
            <div key={block.id} style={{ transition: "opacity 0.2s, transform 0.2s, max-height 0.28s", maxHeight: block.removing ? "0" : "160px", overflow: "hidden" }}>
              <GhostBlock block={block} onAccept={() => onAcceptGhost(block.id)} onDismiss={() => onDismissGhost(block.id)} />
            </div>
          ) : (
            <div key={block.id} style={{ transition: "opacity 0.2s, transform 0.2s, max-height 0.28s", maxHeight: block.removing ? "0" : "160px", overflow: "hidden" }}>
              <SolidBlock block={block} onRemove={() => onRemoveBlock(block.id)} submitted={day.submitted} />
            </div>
          )
        )}

        {isLoadingAI && (
          <div className="flex items-center gap-2 px-2.5 py-3 rounded-lg border border-dashed"
            style={{ borderColor: `${ACCENT}50`, backgroundColor: `${ACCENT}08` }}>
            <span className="w-3.5 h-3.5 rounded-full border-2 shrink-0"
              style={{ borderColor: `${ACCENT}40`, borderTopColor: ACCENT, animation: "spin 0.7s linear infinite" }} />
            <span className="text-xs font-medium" style={{ color: ACCENT }}>Generating suggestions…</span>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-2.5 pb-2.5 pt-2 border-t space-y-1.5"
        style={{ borderColor: BORDER, backgroundColor: day.submitted ? "#FAFAF9" : "white" }}>

        {day.submitted ? (
          <div className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium"
            style={{ color: TEXT_MUTED }}>
            <span style={{ color: "#059669" }}>✓</span>
            Day submitted &amp; locked
          </div>
        ) : (
          <>
            {/* Smart suggest */}
            <button onClick={onSmartSuggest} disabled={isLoadingAI}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold border border-dashed transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: `${ACCENT}60`, color: ACCENT, backgroundColor: `${ACCENT}06` }}
              onMouseEnter={e => !isLoadingAI && (e.currentTarget.style.backgroundColor = `${ACCENT}12`)}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = `${ACCENT}06`)}>
              {isLoadingAI ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 shrink-0"
                    style={{ borderColor: `${ACCENT}40`, borderTopColor: ACCENT, animation: "spin 0.7s linear infinite" }} />
                  Thinking…
                </>
              ) : (
                <>✦ Smart suggest</>
              )}
            </button>

            <QuickAddForm onAdd={onAddBlock} disabled={isLoadingAI} />

            {/* Submit */}
            <button onClick={onSubmitDay}
              className="w-full py-1.5 text-xs font-semibold rounded-md border transition-all duration-150"
              style={{ borderColor: BORDER, color: TEXT_SECONDARY, backgroundColor: "transparent" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#F4F2EF"; e.currentTarget.style.borderColor = "#C8C4BE"; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.borderColor = BORDER; }}>
              Submit day ✓
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main app ─────────────────────────────────────────────────────────────────

const DAY_KEYS: DayKey[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_LABELS: Record<DayKey, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday" };

function buildDays(weekOffset: number): Record<DayKey, DayData> {
  const dates = buildWeekDates(weekOffset);
  const init = {} as Record<DayKey, DayData>;
  DAY_KEYS.forEach((k) => {
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
  const [weekOffset, setWeekOffset] = useState(0);
  const [daysByWeek, setDaysByWeek] = useState<Record<number, Record<DayKey, DayData>>>({
    0: buildDays(0),
  });
  const [loadingAI, setLoadingAI]   = useState<DayKey | null>(null);
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => () => { timeoutRefs.current.forEach(clearTimeout); }, []);

  // Ensure week data exists when navigating
  useEffect(() => {
    if (!daysByWeek[weekOffset]) {
      setDaysByWeek(prev => ({ ...prev, [weekOffset]: buildDays(weekOffset) }));
    }
  }, [weekOffset]);

  const days = daysByWeek[weekOffset] ?? buildDays(weekOffset);

  // Today info
  const todayDow = new Date().getDay();
  const DOW_TO_KEY: Record<number, DayKey> = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri" };
  const todayKey: DayKey | null = DOW_TO_KEY[todayDow] ?? null;

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
    const t = setTimeout(() => { afterFn(); timeoutRefs.current.delete(blockId); }, 280);
    timeoutRefs.current.set(blockId, t);
  }

  function acceptGhost(dayKey: DayKey, ghostId: string) {
    animateRemove(dayKey, ghostId, "ghost", () =>
      updateDay(dayKey, d => {
        const ghost = d.ghosts.find(g => g.id === ghostId);
        if (!ghost) return d;
        return { ...d, ghosts: d.ghosts.filter(g => g.id !== ghostId), blocks: [...d.blocks, { ...ghost, isGhost: false, removing: false }] };
      })
    );
  }

  function dismissGhost(dayKey: DayKey, ghostId: string) {
    animateRemove(dayKey, ghostId, "ghost", () =>
      updateDay(dayKey, d => ({ ...d, ghosts: d.ghosts.filter(g => g.id !== ghostId) }))
    );
  }

  function addBlock(dayKey: DayKey, project: string, from: string, to: string, note: string) {
    updateDay(dayKey, d => ({
      ...d, blocks: [...d.blocks, { id: nanoid(), project, from, to, note, isGhost: false, source: "manual" }],
    }));
  }

  function removeBlock(dayKey: DayKey, blockId: string) {
    animateRemove(dayKey, blockId, "block", () =>
      updateDay(dayKey, d => ({ ...d, blocks: d.blocks.filter(b => b.id !== blockId) }))
    );
  }

  function submitDay(dayKey: DayKey) {
    updateDay(dayKey, d => ({ ...d, submitted: true }));
  }

  async function smartSuggest(dayKey: DayKey) {
    if (loadingAI) return;
    setLoadingAI(dayKey);
    await new Promise(r => setTimeout(r, 1200));
    const suggestions = MOCK_SUGGESTIONS[dayKey];
    updateDay(dayKey, d => ({
      ...d,
      ghosts: [...d.ghosts, ...suggestions.map(s => ({
        id: nanoid(), project: s.project, from: s.from, to: s.to,
        note: s.note, isGhost: true, source: "ai" as BlockSource,
      }))],
    }));
    setLoadingAI(null);
  }

  const submittedCount = Object.values(days).filter(d => d.submitted).length;
  const allSubmitted   = submittedCount === 5;

  return (
    <div className="min-h-screen" style={{ backgroundColor: BG_PAGE, fontFamily: "var(--font-sans)" }}>

      {/* ── Header ── */}
      <header className="bg-white border-b sticky top-0 z-20" style={{ borderColor: BORDER }}>
        <div className="max-w-[1440px] mx-auto px-5 h-13 flex items-center justify-between" style={{ height: "52px" }}>

          {/* Logo + title */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, #C85E38)` }}>T</div>
            <span className="text-sm font-bold" style={{ color: TEXT_PRIMARY }}>Timesheet</span>
          </div>

          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <button onClick={() => setWeekOffset(w => w - 1)}
              className="w-7 h-7 rounded flex items-center justify-center text-sm transition-colors"
              style={{ color: TEXT_SECONDARY }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#F4F2EF")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
              ←
            </button>

            <button onClick={() => setWeekOffset(0)}
              className="px-3 h-7 rounded text-xs font-semibold transition-colors"
              style={{
                backgroundColor: weekOffset === 0 ? `${ACCENT}15` : "transparent",
                color: weekOffset === 0 ? ACCENT : TEXT_SECONDARY,
                border: weekOffset === 0 ? `1px solid ${ACCENT}40` : "1px solid transparent",
              }}>
              {weekOffset === 0 ? "This week" : weekRangeLabel(weekOffset)}
            </button>

            <button onClick={() => setWeekOffset(w => w + 1)}
              className="w-7 h-7 rounded flex items-center justify-center text-sm transition-colors"
              style={{ color: TEXT_SECONDARY }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#F4F2EF")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
              →
            </button>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3">
            {allSubmitted && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: "#D1FAE5", color: "#059669" }}>
                Week complete ✓
              </span>
            )}
            <div className="flex items-center gap-1.5">
              {DAY_KEYS.map(k => (
                <div key={k}
                  className="w-2 h-2 rounded-full transition-all duration-300"
                  style={{ backgroundColor: days[k]?.submitted ? "#34D399" : BORDER }}
                  title={DAY_LABELS[k]} />
              ))}
              <span className="text-xs ml-1 font-medium" style={{ color: TEXT_MUTED }}>
                {submittedCount}/5
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Grid ── */}
      <main className="max-w-[1440px] mx-auto px-5 py-5">
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
      </main>
    </div>
  );
}
