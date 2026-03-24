/**
 * generate-airports.mjs
 *
 * Downloads the OurAirports public-domain CSV (https://ourairports.com/data/)
 * and regenerates apps/web/src/lib/airports.ts with every large + medium
 * commercial airport that has a valid IATA code.
 *
 * Usage:
 *   node scripts/generate-airports.mjs
 *
 * Requires Node 18+ (built-in fetch). No npm dependencies needed.
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "../apps/web/src/lib/airports.ts");

const CSV_URL      = "https://davidmegginson.github.io/ourairports-data/airports.csv";
const COUNTRY_URL  = "https://davidmegginson.github.io/ourairports-data/countries.csv";

// ── Download ──────────────────────────────────────────────────────────────────
console.log("⬇  Downloading OurAirports airports CSV…");
const res = await fetch(CSV_URL);
if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${CSV_URL}`);
const raw = await res.text();
console.log(`   ${(raw.length / 1024).toFixed(0)} KB received`);

console.log("⬇  Downloading OurAirports countries CSV…");
const resC = await fetch(COUNTRY_URL);
if (!resC.ok) throw new Error(`HTTP ${resC.status} fetching ${COUNTRY_URL}`);
const rawC = await resC.text();
console.log(`   ${(rawC.length / 1024).toFixed(0)} KB received`);

// ── Parse CSV ─────────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const cols = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      cols.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

const lines = raw.split("\n").filter(Boolean);
const header = parseCSVLine(lines[0]);

const idx = (name) => {
  const i = header.indexOf(name);
  if (i === -1) throw new Error(`Column "${name}" not found in CSV header`);
  return i;
};

const I_TYPE       = idx("type");
const I_NAME       = idx("name");
const I_LAT        = idx("latitude_deg");
const I_LNG        = idx("longitude_deg");
const I_IATA       = idx("iata_code");
const I_SCHEDULED  = idx("scheduled_service");
const I_COUNTRY    = idx("iso_country");
const I_REGION     = idx("iso_region");
const I_MUNICIPALITY = idx("municipality");

const KEEP_TYPES = new Set(["large_airport", "medium_airport"]);

const airports = [];

for (let i = 1; i < lines.length; i++) {
  const row = parseCSVLine(lines[i]);
  if (!row[I_IATA]?.trim()) continue;
  if (!KEEP_TYPES.has(row[I_TYPE])) continue;

  const iata = row[I_IATA].trim().toUpperCase();
  if (iata.length !== 3) continue;

  const lat = parseFloat(row[I_LAT]);
  const lng = parseFloat(row[I_LNG]);
  if (isNaN(lat) || isNaN(lng)) continue;

  airports.push({
    iata,
    name: row[I_NAME].trim(),
    lat: Math.round(lat * 1000) / 1000,
    lng: Math.round(lng * 1000) / 1000,
    type: row[I_TYPE],
    country: row[I_COUNTRY].trim(),
    region: row[I_REGION].trim(),
    municipality: row[I_MUNICIPALITY]?.trim() ?? "",
    scheduled: row[I_SCHEDULED]?.trim() === "yes",
  });
}

// ── Parse countries CSV ───────────────────────────────────────────────────────
// columns: code, name, continent, wikipedia_link, keywords
const countryLines = rawC.split("\n").filter(Boolean);
const countryHeader = parseCSVLine(countryLines[0]);
const C_CODE = countryHeader.indexOf("code");
const C_NAME = countryHeader.indexOf("name");

/** ISO code → country name */
const countryNames = new Map();
for (let i = 1; i < countryLines.length; i++) {
  const row = parseCSVLine(countryLines[i]);
  const code = row[C_CODE]?.trim();
  const name = row[C_NAME]?.trim();
  if (code && name) countryNames.set(code, name);
}
console.log(`   ${countryNames.size} country names loaded`);

// Sort by country then IATA code for readable diffs
airports.sort((a, b) => a.country.localeCompare(b.country) || a.iata.localeCompare(b.iata));

console.log(`   ${airports.length} airports after filtering (large + medium, valid IATA)`);

// ── Group by country for the output comment ───────────────────────────────────
const byCountry = new Map();
for (const ap of airports) {
  if (!byCountry.has(ap.country)) byCountry.set(ap.country, []);
  byCountry.get(ap.country).push(ap);
}

// ── Build TypeScript source ───────────────────────────────────────────────────
const lines_out = [];

lines_out.push(`/**`);
lines_out.push(` * AUTO-GENERATED — do not edit by hand.`);
lines_out.push(` * Re-generate with:  node scripts/generate-airports.mjs`);
lines_out.push(` *`);
lines_out.push(` * Source: OurAirports (https://ourairports.com/data/) — public domain`);
lines_out.push(` * Includes every large + medium airport with a valid IATA code.`);
lines_out.push(` * ${airports.length} airports across ${byCountry.size} countries.`);
lines_out.push(` *`);
lines_out.push(` * Coordinates: [longitude, latitude]`);
lines_out.push(` */`);
lines_out.push(`export const AIRPORT_COORDS: Record<string, [number, number]> = {`);

for (const [country, list] of byCountry) {
  lines_out.push(``);
  lines_out.push(`  // ${country} (${list.length})`);
  for (const ap of list) {
    const lngStr = ap.lng.toFixed(3).padStart(8);
    const latStr = ap.lat.toFixed(3).padStart(7);
    const label  = [ap.municipality, ap.name].filter(Boolean).join(" — ");
    lines_out.push(`  ${ap.iata}: [${lngStr}, ${latStr}], // ${label}`);
  }
}

lines_out.push(`};`);
lines_out.push(``);

// City names map
lines_out.push(`/** Maps IATA code → municipality (city) name. */`);
lines_out.push(`export const AIRPORT_CITIES: Record<string, string> = {`);
for (const [country, list] of byCountry) {
  for (const ap of list) {
    if (ap.municipality) {
      const escaped = ap.municipality.replace(/'/g, "\\'");
      lines_out.push(`  ${ap.iata}: '${escaped}',`);
    }
  }
}
lines_out.push(`};`);
lines_out.push(``);

// Country codes map  (IATA → ISO-2 country code)
lines_out.push(`/** Maps IATA code → ISO 3166-1 alpha-2 country code. */`);
lines_out.push(`export const AIRPORT_COUNTRIES: Record<string, string> = {`);
for (const [country, list] of byCountry) {
  for (const ap of list) {
    lines_out.push(`  ${ap.iata}: '${ap.country}',`);
  }
}
lines_out.push(`};`);
lines_out.push(``);

// Country names map (ISO-2 → full name)
lines_out.push(`/** Maps ISO 3166-1 alpha-2 country code → country name. */`);
lines_out.push(`export const COUNTRY_NAMES: Record<string, string> = {`);
for (const [code, name] of [...countryNames.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const escaped = name.replace(/'/g, "\\'");
  lines_out.push(`  '${code}': '${escaped}',`);
}
lines_out.push(`};`);
lines_out.push(``);

lines_out.push(`/**`);
lines_out.push(` * Look up airport coordinates by IATA code.`);
lines_out.push(` * Returns null if the airport is not in the dataset.`);
lines_out.push(` */`);
lines_out.push(`export function getAirportCoords(iataCode: string): [number, number] | null {`);
lines_out.push(`  return AIRPORT_COORDS[iataCode.toUpperCase()] ?? null;`);
lines_out.push(`}`);
lines_out.push(``);

writeFileSync(OUT_PATH, lines_out.join("\n"), "utf8");
console.log(`✅ Written to ${OUT_PATH}`);
console.log(`   ${byCountry.size} countries, ${airports.length} airports`);

