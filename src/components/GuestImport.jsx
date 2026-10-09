import { FileUp } from "lucide-react";
import Papa from "papaparse";
import { useRef, useState } from "react";
import { friendlyError } from "../lib/errors.js";
import { normalizePhone } from "../lib/format.js";
import { supabase } from "../lib/supabase.js";
import { ButtonSpinner } from "./Brand.jsx";

const NAME_KEYS = ["name", "full name", "fullname", "guest", "guest name"];
const PHONE_KEYS = ["phone", "phone number", "whatsapp", "mobile", "number"];
const ADMITS_KEYS = ["admits", "admit", "people", "party size", "seats"];
const SIDE_KEYS = ["side", "group", "table", "category"];
const PLUS_KEYS = ["plus ones", "plus-ones", "plus_ones", "plusones", "+1"];

function pick(row, keys) {
  for (const [k, v] of Object.entries(row)) {
    if (keys.includes(k.trim().toLowerCase())) return v;
  }
  return undefined;
}

function parseGuestRows(data) {
  const rows = [];
  let skipped = 0;
  for (const raw of data) {
    const name = (pick(raw, NAME_KEYS) ?? "").trim();
    if (!name) {
      skipped++;
      continue;
    }
    const phoneRaw = pick(raw, PHONE_KEYS);
    const admitsRaw = pick(raw, ADMITS_KEYS);
    const plusRaw = pick(raw, PLUS_KEYS);
    let admits = 1;
    if (admitsRaw && /^\d+$/.test(admitsRaw.trim()))
      admits = parseInt(admitsRaw, 10);
    else if (plusRaw && /^\d+$/.test(plusRaw.trim()))
      admits = 1 + parseInt(plusRaw, 10);
    admits = Math.min(10, Math.max(1, admits));
    const side = (pick(raw, SIDE_KEYS) ?? "").trim().slice(0, 40);
    rows.push({
      name: name.slice(0, 120),
      phone: normalizePhone(phoneRaw),
      admits,
      ...(side ? { side } : {}),
    });
  }
  return { rows, skipped };
}

export default function GuestImport({ eventId, onDone }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState(null);

  function handleFile(file) {
    setError(null);
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed = parseGuestRows(result.data);
        if (parsed.rows.length === 0) {
          setError('No guests found. Make sure the file has a "name" column.');
          setPreview(null);
        } else {
          setPreview(parsed);
        }
      },
      error: (err) => setError(err.message),
    });
  }

  async function importRows() {
    if (!preview) return;
    setBusy(true);
    setError(null);
    let inserted = 0;
    try {
      for (let i = 0; i < preview.rows.length; i += 200) {
        const chunk = preview.rows
          .slice(i, i + 200)
          .map((r) => ({ ...r, event_id: eventId }));
        const { error } = await supabase.from("guests").insert(chunk);
        if (error) throw error;
        inserted += chunk.length;
      }
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      onDone(inserted);
    } catch (err) {
      setError(
        `${inserted ? `Imported ${inserted}, then stopped: ` : ""}${friendlyError(err)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  const people = preview?.rows.reduce((sum, r) => sum + r.admits, 0) ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <label
        htmlFor="csv"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className={`flex flex-col items-center justify-center gap-2 rounded-[28px] border-2 border-dashed px-6 py-10 text-center cursor-pointer transition ${
          dragging ? "border-brown bg-cream" : "border-sand bg-tile hover:border-brown-soft"
        }`}
      >
        <span className="w-12 h-12 rounded-full bg-white inline-flex items-center justify-center">
          <FileUp size={22} aria-hidden="true" />
        </span>
        <span className="text-[17px]">{fileName ?? "Drop your CSV here, or tap to choose"}</span>
        <span className="text-sm text-brown-soft">.csv · up to a few thousand rows</span>
      </label>
      <input
        ref={inputRef}
        id="csv"
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="sr-only"
      />

      <div>
        <p className="text-sm text-brown-soft mb-2">Columns we read (first row should be headings):</p>
        <div className="flex flex-wrap gap-1.5">
          {[
            ["name", true],
            ["phone", false],
            ["admits / plus ones", false],
            ["side", false],
          ].map(([c, req]) => (
            <span key={c} className={`h-8 px-3 rounded-full text-xs font-mono inline-flex items-center ${req ? "bg-brown text-cream" : "bg-tile"}`}>
              {c}
              {req && <span className="ml-1 font-sans opacity-70">required</span>}
            </span>
          ))}
        </div>
      </div>

      {preview && (
        <div className="rounded-[24px] bg-tile p-4 flex flex-col gap-3">
          <p className="text-[15px]">
            <strong className="font-medium">{preview.rows.length}</strong> guests · {people} people
            {preview.skipped > 0 && <span className="text-brown-soft"> · {preview.skipped} rows skipped (no name)</span>}
          </p>
          <ul className="flex flex-col divide-y divide-sand bg-white rounded-2xl px-4">
            {preview.rows.slice(0, 4).map((r, i) => (
              <li key={i} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{r.name}</span>
                <span className="shrink-0 text-brown-soft">
                  {r.side ? `${r.side} · ` : ""}
                  {r.admits} {r.admits === 1 ? "person" : "people"}
                </span>
              </li>
            ))}
            {preview.rows.length > 4 && <li className="py-2.5 text-sm text-brown-soft">and {preview.rows.length - 4} more…</li>}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <button type="button" onClick={importRows} disabled={busy || !preview} className="btn-dark">
          {busy && <ButtonSpinner />} {preview ? `Import ${preview.rows.length} guests` : "Choose a file first"}
        </button>
      </div>
    </div>
  );
}
