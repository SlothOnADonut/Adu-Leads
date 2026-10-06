"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useMemo, useState, useTransition } from "react";
import { autoMap, buildLeadRows, IMPORT_FIELDS, type ColumnMapping, type ImportFieldKey, type NameFormat } from "@/lib/csv-mapping";
import { importLeads, type ImportResult } from "@/lib/actions/import";
import { createCampaign } from "@/lib/actions/campaigns";
import { formatCurrency, formatDate } from "@/lib/format";

type CampaignOption = { id: string; name: string; city: string | null };
type Step = "upload" | "map" | "done";

const GROUPS = ["Owner", "Property", "Permit", "Enrichment", "Scores"] as const;

export default function ImportWizard({ campaigns: initialCampaigns }: { campaigns: CampaignOption[] }) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [campaignId, setCampaignId] = useState(initialCampaigns[0]?.id ?? "");
  const [newCampaignName, setNewCampaignName] = useState("");
  const [defaultCity, setDefaultCity] = useState("Anaheim");
  const [defaultState, setDefaultState] = useState("CA");
  const [nameFormat, setNameFormat] = useState<NameFormat>("last_first");
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const built = useMemo(
    () => buildLeadRows(rawRows, mapping, { defaultCity, defaultState, nameFormat }),
    [rawRows, mapping, defaultCity, defaultState, nameFormat]
  );

  const onFile = (file: File) => {
    setParseError(null);
    setFileName(file.name);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const fields = (res.meta.fields ?? []).filter(Boolean);
        if (fields.length === 0 || res.data.length === 0) {
          setParseError("That file has no rows. Make sure the first row contains column names.");
          return;
        }
        setHeaders(fields);
        setRawRows(res.data);
        setMapping(autoMap(fields));
        setStep("map");
      },
      error: (err) => setParseError(err.message),
    });
  };

  const setField = (key: ImportFieldKey, column: string) => {
    setMapping((m) => {
      const next = { ...m };
      if (column) next[key] = column;
      else delete next[key];
      return next;
    });
  };

  const runImport = () => {
    startTransition(async () => {
      let targetCampaign: string | null = campaignId || null;
      if (campaignId === "__new") {
        const fd = new FormData();
        fd.set("name", newCampaignName.trim() || `${defaultCity || "New"} ADU campaign`);
        fd.set("city", defaultCity);
        const created = await createCampaign(fd);
        if (created.error || !created.id) {
          setResult({ inserted: 0, updated: 0, skipped: 0, error: created.error ?? "Could not create campaign" });
          setStep("done");
          return;
        }
        targetCampaign = created.id;
        setCampaigns((c) => [{ id: created.id!, name: fd.get("name") as string, city: defaultCity }, ...c]);
        setCampaignId(created.id);
      }
      const res = await importLeads(built.rows, targetCampaign);
      setResult(res);
      setStep("done");
    });
  };

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setResult(null);
    setFileName("");
  };

  const hasIdentifier = !!mapping.apn || !!mapping.permit_number;
  const importable = built.rows.length - built.missingIdentifier;

  // ------------------------------------------------------------- upload
  if (step === "upload") {
    return (
      <div className="card p-6">
        <label
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-cream-300 bg-cream-100/40 px-6 py-14 text-center transition hover:border-forest-200 hover:bg-forest-50/40"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) onFile(f);
          }}
        >
          <span className="font-serif text-lg font-semibold text-forest-900">Drop your CSV here</span>
          <span className="mt-1 text-sm text-charcoal-light">or click to choose a file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
        </label>
        {parseError && <p className="mt-3 text-sm text-red-700">{parseError}</p>}
        <p className="mt-4 text-xs text-charcoal-light">
          Tip: download the example file from the project folder <code className="rounded bg-cream-100 px-1">sample-data/anaheim-adu-leads-example.csv</code> to see the expected columns.
        </p>
      </div>
    );
  }

  // ------------------------------------------------------------- done
  if (step === "done" && result) {
    return (
      <div className="card p-6">
        {result.error ? (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800">
            <div className="font-semibold">Import stopped</div>
            <div className="mt-1">{result.error}</div>
          </div>
        ) : (
          <div className="rounded-lg bg-forest-50 p-4 text-sm text-forest-800">
            <div className="font-semibold">Import complete</div>
          </div>
        )}
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            ["New leads", result.inserted],
            ["Updated", result.updated],
            ["Skipped", result.skipped],
          ].map(([label, n]) => (
            <div key={label as string} className="rounded-lg bg-cream-100/70 py-4">
              <div className="font-serif text-3xl font-semibold text-forest-900">{n}</div>
              <div className="text-xs text-charcoal-light">{label}</div>
            </div>
          ))}
        </div>
        {result.skipped > 0 && (
          <p className="mt-3 text-xs text-charcoal-light">Skipped rows had neither an APN nor a permit number.</p>
        )}
        <div className="mt-5 flex gap-2">
          <Link href={campaignId && campaignId !== "__new" ? `/leads?campaign=${campaignId}` : "/leads"} className="btn-primary">View leads</Link>
          <Link href="/export" className="btn-secondary">Go to QR export</Link>
          <button type="button" onClick={reset} className="btn-ghost">Import another file</button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- map + preview
  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">{fileName}</div>
            <div className="text-xs text-charcoal-light">{rawRows.length} rows · {headers.length} columns</div>
          </div>
          <button type="button" onClick={reset} className="btn-ghost btn-sm">Choose a different file</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Campaign</label>
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="input">
              <option value="">No campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__new">+ New campaign…</option>
            </select>
            {campaignId === "__new" && (
              <input
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
                placeholder="Campaign name"
                className="input mt-2"
              />
            )}
          </div>
          <div>
            <label className="label">City (if not in file)</label>
            <input value={defaultCity} onChange={(e) => setDefaultCity(e.target.value)} className="input" />
            <p className="mt-1 text-[11px] text-charcoal-light">Sets the code prefix: Anaheim → ANA-0001</p>
          </div>
          <div>
            <label className="label">State (if not in file)</label>
            <input value={defaultState} onChange={(e) => setDefaultState(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Owner name format</label>
            <select value={nameFormat} onChange={(e) => setNameFormat(e.target.value as NameFormat)} className="input">
              <option value="last_first">LAST FIRST (GONZALEZ MARIA)</option>
              <option value="first_last">First Last (Maria Gonzalez)</option>
            </select>
            <p className="mt-1 text-[11px] text-charcoal-light">Used to split the Owner column into first/last name</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Match columns</h2>
          <span className="text-xs text-charcoal-light">We guessed what we could. Leave a field blank to skip it.</span>
        </div>
        <div className="grid gap-6 p-5 md:grid-cols-2 xl:grid-cols-3">
          {GROUPS.map((group) => (
            <div key={group}>
              <div className="mb-2 text-xs font-semibold tracking-wide text-gold-dark uppercase">{group}</div>
              <div className="space-y-2">
                {IMPORT_FIELDS.filter((f) => f.group === group).map((f) => (
                  <div key={f.key} className="grid grid-cols-[8.5rem_1fr] items-center gap-2">
                    <span className="text-sm text-charcoal">
                      {f.label}
                      {(f.key === "apn" || f.key === "permit_number") && <span className="text-gold-dark"> *</span>}
                    </span>
                    <select
                      value={mapping[f.key] ?? ""}
                      onChange={(e) => setField(f.key, e.target.value)}
                      className={`input py-1.5 ${mapping[f.key] ? "border-forest-200 bg-forest-50/40" : ""}`}
                    >
                      <option value="">— skip —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="border-t border-cream-200 px-5 py-3 text-xs text-charcoal-light">
          * Each lead needs an APN or a permit number (ideally both) — that pair is how re-imports find existing leads.
          Missing scores are calculated automatically from permit date, job value and last sale date.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="card-title">Preview</h2>
          <span className="text-xs text-charcoal-light">First 10 of {built.rows.length} rows, after cleaning</span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Owner</th>
                <th>First / last</th>
                <th>Property</th>
                <th>Mailing</th>
                <th>APN</th>
                <th>Permit</th>
                <th>Issued</th>
                <th className="text-right">Value</th>
                <th className="text-right">Priority</th>
              </tr>
            </thead>
            <tbody>
              {built.rows.slice(0, 10).map((r, i) => (
                <tr key={i} className={!r.apn && !r.permit_number ? "opacity-50" : ""}>
                  <td className="text-xs">{r.owner_name_raw ?? "—"}</td>
                  <td className="text-xs">{[r.first_name, r.last_name].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="text-xs">{r.property_address ?? "—"}<div className="text-charcoal-light">{r.city}</div></td>
                  <td className="text-xs">{r.mailing_address ?? "—"}</td>
                  <td className="font-mono text-xs">{r.apn ?? "—"}</td>
                  <td className="font-mono text-xs">{r.permit_number ?? "—"}</td>
                  <td className="whitespace-nowrap text-xs">{formatDate(r.permit_issue_date)}</td>
                  <td className="text-right text-xs">{formatCurrency(r.job_valuation)}</td>
                  <td className="text-right text-xs font-semibold">{r.final_priority_score ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="text-sm">
          {!hasIdentifier ? (
            <span className="font-medium text-red-700">Match an APN or Permit number column to continue.</span>
          ) : (
            <>
              <b>{importable}</b> rows ready to import
              {built.missingIdentifier > 0 && (
                <span className="text-charcoal-light"> · {built.missingIdentifier} will be skipped (no APN or permit #)</span>
              )}
            </>
          )}
        </div>
        <button
          type="button"
          disabled={!hasIdentifier || importable === 0 || pending}
          onClick={runImport}
          className="btn-primary"
        >
          {pending ? "Importing…" : `Import ${importable} leads`}
        </button>
      </div>
    </div>
  );
}
