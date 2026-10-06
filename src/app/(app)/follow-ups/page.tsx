import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchAllLeads, LEAD_LIST_COLUMNS } from "@/lib/data";
import { reached } from "@/lib/metrics";
import { addDays, formatDate, fullPropertyAddress, ownerName, timeAgo, todayISO } from "@/lib/format";
import StatusBadge, { ScoreBadge } from "@/components/StatusBadge";
import QuickActions from "@/components/QuickActions";
import type { QuickAction } from "@/lib/actions/leads";
import type { Lead } from "@/lib/types";

export const metadata = { title: "Follow-ups · ADU Lead Tracker" };

const byPriority = (a: Lead, b: Lead) => (b.final_priority_score ?? 0) - (a.final_priority_score ?? 0);
const byDate = (a: Lead, b: Lead) =>
  (a.next_follow_up_date ?? "").localeCompare(b.next_follow_up_date ?? "") || byPriority(a, b);

function Bucket({
  title,
  description,
  leads,
  tone,
  actions,
  today,
}: {
  title: string;
  description: string;
  leads: Lead[];
  tone: "red" | "gold" | "green" | "neutral";
  actions: QuickAction[];
  today: string;
}) {
  const dot = { red: "bg-red-500", gold: "bg-gold", green: "bg-forest-500", neutral: "bg-cream-300" }[tone];
  return (
    <section className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          <h2 className="card-title">{title}</h2>
          <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-medium text-charcoal-light">{leads.length}</span>
        </div>
        <span className="hidden text-xs text-charcoal-light sm:block">{description}</span>
      </div>
      {leads.length === 0 ? (
        <p className="px-5 py-5 text-sm text-charcoal-light">None right now.</p>
      ) : (
        <ul className="divide-y divide-cream-100">
          {leads.map((l) => (
            <li key={l.id} className="grid gap-2 px-5 py-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/leads/${l.id}`} className="font-medium text-forest-800 hover:underline">{ownerName(l)}</Link>
                  <span className="font-mono text-xs text-charcoal-light">{l.lead_code}</span>
                  <ScoreBadge score={l.final_priority_score} />
                  <StatusBadge status={l.follow_up_status} />
                </div>
                <div className="mt-0.5 truncate text-xs text-charcoal-light">
                  {fullPropertyAddress(l)}
                  {l.next_follow_up_date && (
                    <span className={l.next_follow_up_date < today ? " font-medium text-red-700" : ""}>
                      {" "}· Due {formatDate(l.next_follow_up_date)}
                    </span>
                  )}
                  {l.last_qr_scan_at && <span> · Scanned {timeAgo(l.last_qr_scan_at)}</span>}
                </div>
              </div>
              <QuickActions leadId={l.id} actions={actions} size="sm" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function FollowUpsPage() {
  const supabase = await createClient();
  const all = await fetchAllLeads(supabase, LEAD_LIST_COLUMNS);
  const today = todayISO();
  const weekOut = addDays(today, 7);

  const active = all.filter((l) => l.follow_up_status !== "Do not contact" && l.follow_up_status !== "Funded");

  const overdue = active.filter((l) => l.next_follow_up_date && l.next_follow_up_date < today).sort(byDate);
  const dueToday = active.filter((l) => l.next_follow_up_date === today).sort(byPriority);
  const upcoming = active
    .filter((l) => l.next_follow_up_date && l.next_follow_up_date > today && l.next_follow_up_date <= weekOut)
    .sort(byDate);
  const scannedNotContacted = active.filter((l) => reached(l, "scanned") && !reached(l, "contacted")).sort(byPriority);
  const contactedNoAppt = active.filter((l) => reached(l, "contacted") && !reached(l, "appointment")).sort(byPriority);
  const apptNoApp = active.filter((l) => reached(l, "appointment") && !reached(l, "applied")).sort(byPriority);

  const contactActions: QuickAction[] = ["called", "texted", "appointment_booked", "follow_up_done", "snooze_1", "snooze_3", "snooze_7"];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Follow-ups</h1>
        <p className="mt-1 text-sm text-charcoal-light">
          {overdue.length} overdue · {dueToday.length} due today · {scannedNotContacted.length} scanned and waiting for a call
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Bucket title="Overdue" description="Follow-up date has passed" leads={overdue} tone="red" actions={contactActions} today={today} />
        <Bucket title="Due today" description="Scheduled for today" leads={dueToday} tone="gold" actions={contactActions} today={today} />
        <Bucket title="Scanned but not contacted" description="Hot — call these first" leads={scannedNotContacted} tone="gold" actions={["called", "texted", "appointment_booked", "snooze_1"]} today={today} />
        <Bucket title="Upcoming (7 days)" description="Coming up this week" leads={upcoming} tone="neutral" actions={["called", "texted", "follow_up_done", "snooze_3"]} today={today} />
        <Bucket title="Contacted, no appointment" description="Keep the conversation going" leads={contactedNoAppt} tone="green" actions={["called", "texted", "appointment_booked", "snooze_3", "snooze_7"]} today={today} />
        <Bucket title="Appointment, no application" description="Push toward application" leads={apptNoApp} tone="green" actions={["called", "texted", "applied", "snooze_3"]} today={today} />
      </div>
    </div>
  );
}
