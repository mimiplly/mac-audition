/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { sheetSyncApi } from "./sheet-sync";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  SHEET_SYNC_TOKEN: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const legacyParticipants = [
  ["001", "Patimakon Yaemsukhon (Kaopun)","Vocal"], ["002", "Naing Mana (David)","Vocal"], ["003", "Khemmakorn Thongdee (Khem)","Vocal"],
  ["004", "Monpatch Lakesuwankun (Mie)","Vocal"], ["005", "Thiwatsakorn Panyanan (Baitoey)","Vocal"], ["006", "Pongdanal Sompan (Oak)","Vocal"],
  ["007", "Nachachon Chaowakarn (Mana)","Vocal"], ["008", "Punika Chaiadisai (Namhorm)","Vocal"], ["009", "Rachasak Manuspienlerd (Punpun)","Vocal"],
  ["010", "Thanakrit Kasemsiraphop (Namon)","Vocal"], ["011", "Pakorn Limpornchitwilai (Tan)","Vocal"], ["012", "Nuttawiroj Chankaew (Moto)","Vocal"],
  ["013", "Thanyaphat Tussakul (Percy)","Vocal"], ["014", "Kulnicha Khajornphisitsak (Eingko)","Vocal"],
  ["015", "Thaam Wyachai (Dylan)","Guitar"], ["016", "Siwakorn Sirisap (Fame)","Guitar"], ["017", "Poomrapee Neekong (Poom)","Guitar"],
  ["018", "Jittipat Kanjanavikat (August)","Guitar"], ["019", "Saharat Nirnatasukwong (Windows)","Guitar"],
  ["020", "Konchanok Sriyuttakrai (Unseen)","Drums"], ["021", "Teychit Phattharathanasut (HengHeng)","Keyboard"],
].map(([number, name, category]) => ({ number, name, category }));

const categoryNames: Record<string, string> = {
  "นักร้อง (Vocalists)": "Vocal",
  "มือกีต้าร์ (Guitarists)": "Guitar",
  "มือเบส (Bassists)": "Bass",
  "มือกลอง (Drummers)": "Drums",
  "มือคียบอร์ด (Keyboardists)": "Keyboard",
  "Vocal": "Vocal",
  "Guitar": "Guitar",
  "Bass": "Bass",
  "Drums": "Drums",
  "Keyboard": "Keyboard",
};

type Contestant = {
  participantNumber: string;
  studentId: string;
  category: string;
  thaiName: string;
  thaiNickname: string;
  englishName: string;
  englishNickname: string;
  department: string;
  phone: string;
  lineId: string;
  instagram: string;
  availableDates: string;
  reviewFlags: string;
};

type ImportResult = {
  records: Contestant[];
  rejected: Array<{ row: number; reason: string }>;
  merged: number;
};

const judgeNames: Record<number, string> = {
  1: "Mimi",
  2: "Caleb",
  3: "Day",
  4: "Fluke",
  5: "Pun",
  6: "Shin",
  7: "Arpo",
  8: "Mangpor",
  9: "Judge09",
  10: "Judge10",
};

function identity(request: Request) {
  const pin = request.headers.get("x-portal-pin") || "";
  if (pin === "9900") return { role: "admin", name: "Administrator", judgeId: 0 };
  const n = Number(pin) - 4100;
  if (n >= 1 && n <= 10 && Number.isInteger(n)) {
    const judgeName = judgeNames[n];
    return { role: "judge", name: judgeName, judgeId: n };
  }
  return null;
}

async function initializeScoresTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      judge_id INTEGER NOT NULL,
      participant_number TEXT NOT NULL,
      vocal INTEGER NOT NULL,
      diction INTEGER NOT NULL,
      musical INTEGER NOT NULL,
      expression INTEGER NOT NULL,
      stage INTEGER NOT NULL,
      lyrics INTEGER NOT NULL,
      presentation INTEGER NOT NULL,
      extra_a INTEGER NOT NULL DEFAULT 0,
      extra_b INTEGER NOT NULL DEFAULT 0,
      note TEXT DEFAULT '' NOT NULL,
      updated_at TEXT NOT NULL
    );
  `).run();
  await db.prepare(
    "CREATE UNIQUE INDEX IF NOT EXISTS judge_participant_unique ON scores (judge_id, participant_number)",
  ).run();
  try { await db.prepare("ALTER TABLE scores ADD COLUMN extra_a INTEGER NOT NULL DEFAULT 0").run(); } catch {}
  try { await db.prepare("ALTER TABLE scores ADD COLUMN extra_b INTEGER NOT NULL DEFAULT 0").run(); } catch {}
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS score_delete_backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      deleted_at TEXT NOT NULL,
      judge_id INTEGER NOT NULL,
      participant_number TEXT NOT NULL,
      snapshot_json TEXT NOT NULL
    )
  `).run();
}

async function initializeContestantsTable(db: D1Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS contestants (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      participant_number TEXT NOT NULL UNIQUE,
      student_id TEXT NOT NULL,
      category TEXT NOT NULL,
      thai_name TEXT DEFAULT '' NOT NULL,
      thai_nickname TEXT DEFAULT '' NOT NULL,
      english_name TEXT NOT NULL,
      english_nickname TEXT DEFAULT '' NOT NULL,
      department TEXT DEFAULT '' NOT NULL,
      phone TEXT DEFAULT '' NOT NULL,
      line_id TEXT DEFAULT '' NOT NULL,
      instagram TEXT DEFAULT '' NOT NULL,
      available_dates TEXT DEFAULT '' NOT NULL,
      review_flags TEXT DEFAULT '' NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
  await db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS contestants_student_category_unique ON contestants (student_id, category)").run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS contestant_import_backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      created_at TEXT NOT NULL,
      row_count INTEGER NOT NULL,
      snapshot_json TEXT NOT NULL
    )
  `).run();
  const now = new Date().toISOString();
  const seedStatements = legacyParticipants.map(({ number, name, category }) =>
    db.prepare("INSERT OR IGNORE INTO contestants (participant_number, student_id, category, english_name, updated_at) VALUES (?, ?, ?, ?, ?)")
      .bind(number, `legacy-${number}`, category, name, now),
  );
  if (seedStatements.length) await db.batch(seedStatements);
}

async function getContestants(db: D1Database): Promise<Contestant[]> {
  const result = await db.prepare("SELECT participant_number, student_id, category, thai_name, thai_nickname, english_name, english_nickname, department, phone, line_id, instagram, available_dates, review_flags FROM contestants ORDER BY CAST(participant_number AS INTEGER), participant_number").all();
  return result.results.map((row: Record<string, unknown>) => ({
    participantNumber: String(row.participant_number), studentId: String(row.student_id), category: String(row.category),
    thaiName: String(row.thai_name || ""), thaiNickname: String(row.thai_nickname || ""), englishName: String(row.english_name),
    englishNickname: String(row.english_nickname || ""), department: String(row.department || ""), phone: String(row.phone || ""),
    lineId: String(row.line_id || ""), instagram: String(row.instagram || ""), availableDates: String(row.available_dates || ""), reviewFlags: String(row.review_flags || ""),
  }));
}

function parseImport(tsv: string): ImportResult {
  const lines = tsv.replace(/\r/g, "").split("\n").filter((line) => line.trim());
  const expectedHeader = ["Thai name", "Thai nickname", "English name", "English nickname", "Student ID", "Department", "Phone", "Line ID", "Instagram", "Category", "Available dates"];
  if (lines[0]?.split("\t").map((value) => value.trim()).join("\t") === expectedHeader.join("\t")) lines.shift();
  const grouped = new Map<string, Contestant>();
  const rejected: Array<{ row: number; reason: string }> = [];
  let merged = 0;
  for (const [index, line] of lines.entries()) {
    const row = index + 1;
    const fields = line.split("\t").map((value) => value.trim());
    if (fields.length !== expectedHeader.length) { rejected.push({ row, reason: `Expected 11 tab-separated columns, received ${fields.length}` }); continue; }
    const [thaiName, thaiNickname, englishName, englishNickname, studentId, department, phone, lineId, instagram, rawCategory, availableDates] = fields;
    const category = categoryNames[rawCategory];
    if (!studentId || !/^\d{10}$/.test(studentId)) { rejected.push({ row, reason: "Student ID must be exactly 10 digits" }); continue; }
    if (!englishName || !category) { rejected.push({ row, reason: !englishName ? "English name is required" : `Unknown category: ${rawCategory}` }); continue; }
    const dates = availableDates.split(",").map((value) => value.trim()).filter(Boolean);
    if (!dates.length || dates.some((date) => !/^\d{1,2} August 2026$/.test(date))) { rejected.push({ row, reason: "Available dates must use the format D August 2026" }); continue; }
    const reviewFlags = [
      phone && (!/^\+?[0-9][0-9 +-]{7,19}$/.test(phone) || (phone.includes("+") && !phone.startsWith("+"))) ? "phone" : "",
      lineId === "-" ? "line_id_placeholder" : "",
      instagram && /\s/.test(instagram) ? "instagram_spacing" : "",
    ].filter(Boolean).join(",");
    const key = `${studentId}|${category}`;
    const existing = grouped.get(key);
    if (existing) {
      merged += 1;
      const combinedDates = new Set([...existing.availableDates.split(", "), ...dates]);
      Object.assign(existing, {
        thaiName: thaiName || existing.thaiName, thaiNickname: thaiNickname || existing.thaiNickname,
        englishName: englishName || existing.englishName, englishNickname: englishNickname || existing.englishNickname,
        department: department || existing.department, phone: phone || existing.phone, lineId: lineId || existing.lineId,
        instagram: instagram || existing.instagram, availableDates: [...combinedDates].join(", "),
        reviewFlags: [existing.reviewFlags, reviewFlags].filter(Boolean).join(","),
      });
      continue;
    }
    grouped.set(key, { participantNumber: "", studentId, category, thaiName, thaiNickname, englishName, englishNickname, department, phone, lineId, instagram, availableDates: dates.join(", "), reviewFlags });
  }
  return { records: [...grouped.values()], rejected, merged };
}

async function importToken(tsv: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tsv));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function comparableName(value: string) {
  return value.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function importMatches(record: Contestant, existing: Contestant[]) {
  return existing.find((item) => item.studentId === record.studentId && item.category === record.category)
    || existing.find((item) => comparableName(item.englishName) === comparableName(record.englishName) && item.category === record.category);
}

async function prepareImport(db: D1Database, parsed: ImportResult) {
  const existing = await getContestants(db);
  let nextNumber = Math.max(0, ...existing.map((item) => Number(item.participantNumber)).filter(Number.isFinite)) + 1;
  const proposed = parsed.records.map((record) => {
    const match = importMatches(record, existing);
    if (match) return { ...record, participantNumber: match.participantNumber };
    return { ...record, participantNumber: String(nextNumber++).padStart(3, "0") };
  });
  return { parsed, records: proposed, existing, token: "" };
}

async function portalApi(request: Request, env: Env) {
  try {
    const user = identity(request);
    if (!user) return Response.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
    await initializeScoresTable(env.DB);
    await initializeContestantsTable(env.DB);
    const contestantList = await getContestants(env.DB);
    if (request.method === "POST" && user.role === "admin") {
      const body = await request.json() as { action?: string; tsv?: string; previewToken?: string; studentId?: string; category?: string; judgeId?: number; participantNumber?: string };
      if (body.action === "deleteScore") {
        const judgeId = Number(body.judgeId);
        const participantNumber = String(body.participantNumber || "");
        if (!Number.isInteger(judgeId) || judgeId < 1 || judgeId > 10 || !participantNumber) return Response.json({ error: "Invalid score target" }, { status: 400 });
        const existing = await env.DB.prepare("SELECT * FROM scores WHERE judge_id = ? AND participant_number = ?").bind(judgeId, participantNumber).all();
        const score = existing.results[0];
        if (!score) return Response.json({ error: "Score not found" }, { status: 404 });
        await env.DB.prepare("INSERT INTO score_delete_backups (deleted_at, judge_id, participant_number, snapshot_json) VALUES (?, ?, ?, ?)").bind(new Date().toISOString(), judgeId, participantNumber, JSON.stringify(score)).run();
        await env.DB.prepare("DELETE FROM scores WHERE judge_id = ? AND participant_number = ?").bind(judgeId, participantNumber).run();
        return Response.json({ deleted: true, judgeId, participantNumber, name: user.name });
      }
      if (body.action === "remove" && body.studentId && body.category) {
        const target = contestantList.find((item) => item.studentId === body.studentId && item.category === body.category);
        if (!target) return Response.json({ error: "Contestant not found" }, { status: 404 });
        await env.DB.prepare("INSERT INTO contestant_import_backups (created_at, row_count, snapshot_json) VALUES (?, ?, ?)").bind(new Date().toISOString(), contestantList.length, JSON.stringify(contestantList)).run();
        await env.DB.prepare("DELETE FROM contestants WHERE student_id = ? AND category = ?").bind(body.studentId, body.category).run();
        return Response.json({ removed: target, contestants: await getContestants(env.DB), name: user.name });
      }
      if (body.action === "preview" || body.action === "import") {
        const tsv = typeof body.tsv === "string" ? body.tsv : "";
        const parsed = parseImport(tsv);
        const prepared = await prepareImport(env.DB, parsed);
        const token = await importToken(tsv);
        const newCount = prepared.records.filter((record) => !importMatches(record, prepared.existing)).length;
        const updatedCount = prepared.records.length - newCount;
        const preview = {
          token, new: newCount, updated: updatedCount, merged: parsed.merged, rejected: parsed.rejected.length,
          rejectedRows: parsed.rejected, rows: prepared.records,
        };
        if (body.action === "preview") return Response.json({ preview, name: user.name });
        if (body.previewToken !== token) return Response.json({ error: "Preview is required before import" }, { status: 409 });
        const snapshot = JSON.stringify(prepared.existing);
        const backup = await env.DB.prepare("INSERT INTO contestant_import_backups (created_at, row_count, snapshot_json) VALUES (?, ?, ?)").bind(new Date().toISOString(), prepared.existing.length, snapshot).run();
        const statements = prepared.records.map((record) => {
          const match = importMatches(record, prepared.existing);
          if (match) return env.DB.prepare("UPDATE contestants SET student_id=?, category=?, thai_name=?, thai_nickname=?, english_name=?, english_nickname=?, department=?, phone=?, line_id=?, instagram=?, available_dates=?, review_flags=?, updated_at=? WHERE participant_number=?").bind(record.studentId, record.category, record.thaiName, record.thaiNickname, record.englishName, record.englishNickname, record.department, record.phone, record.lineId, record.instagram, record.availableDates, record.reviewFlags, new Date().toISOString(), match.participantNumber);
          return env.DB.prepare("INSERT INTO contestants (participant_number, student_id, category, thai_name, thai_nickname, english_name, english_nickname, department, phone, line_id, instagram, available_dates, review_flags, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(record.participantNumber, record.studentId, record.category, record.thaiName, record.thaiNickname, record.englishName, record.englishNickname, record.department, record.phone, record.lineId, record.instagram, record.availableDates, record.reviewFlags, new Date().toISOString());
        });
        if (statements.length) await env.DB.batch(statements);
        return Response.json({ imported: { new: newCount, updated: updatedCount, merged: parsed.merged, rejected: parsed.rejected.length, rejectedRows: parsed.rejected, backupId: backup.meta?.last_row_id || null }, contestants: await getContestants(env.DB), name: user.name });
      }
    }
    if (request.method === "GET" && user.role === "judge") {
      const result = await env.DB.prepare("SELECT *, vocal+diction+musical+expression+stage+lyrics+presentation+extra_a+extra_b AS total FROM scores WHERE judge_id = ?").bind(user.judgeId).all();
      const scoreRows = result.results.map((row: Record<string, unknown>) => ({ ...row, participantNumber: row.participant_number, judgeId: row.judge_id, updatedAt: row.updated_at, extraA: Number(row.extra_a || 0), extraB: Number(row.extra_b || 0) }));
      return Response.json({ role: user.role, name: user.name, scores: scoreRows, contestants: contestantList });
    }
    if (request.method === "GET" && user.role === "admin") {
      const result = await env.DB.prepare("SELECT participant_number, COUNT(*) AS judges, AVG(vocal+diction+musical+expression+stage+lyrics+presentation+extra_a+extra_b) AS average, GROUP_CONCAT(judge_id) AS judge_ids FROM scores GROUP BY participant_number").all();
      const detailResult = await env.DB.prepare("SELECT *, vocal+diction+musical+expression+stage+lyrics+presentation+extra_a+extra_b AS total FROM scores ORDER BY CAST(participant_number AS INTEGER), participant_number, judge_id").all();
      const scoreDetails = detailResult.results.map((row: Record<string, unknown>) => ({ ...row, participantNumber: String(row.participant_number), judgeId: Number(row.judge_id), updatedAt: String(row.updated_at), extraA: Number(row.extra_a || 0), extraB: Number(row.extra_b || 0), total: Number(row.total || 0), note: String(row.note || "") }));
      const rows = new Map(result.results.map((r: Record<string, unknown>) => [String(r.participant_number), r]));
      const rankings = contestantList.map(p => { const r = rows.get(p.participantNumber); const judges = Number(r?.judges || 0); const judgeIds = String(r?.judge_ids || "").split(",").filter(Boolean).map(Number); return { ...p, number: p.participantNumber, name: p.englishName, judges, judgeIds, average: Number(r?.average || 0), complete: judges === 10 }; }).sort((a,b) => b.average-a.average || a.number.localeCompare(b.number));
      return Response.json({ role: user.role, name: user.name, rankings, scoreDetails, contestants: contestantList, judgeNames });
    }
    if (request.method === "POST" && user.role === "judge") {
      const body = await request.json() as Record<string, unknown>; const participantNumber = String(body.participantNumber || "");
      if (body.action === "preview" || body.action === "import") return Response.json({ error: "Admin access required" }, { status: 403 });
      const participant = contestantList.find(p => p.participantNumber === participantNumber);
      if (!participant) return Response.json({ error: "ไม่พบผู้เข้าแข่งขัน" }, { status: 400 });
      const limits: Record<string, number> = participant.category === "Vocal" ? { vocal:30,diction:20,musical:15,expression:20,stage:15,lyrics:0,presentation:0,extra_a:0,extra_b:0 } : participant.category === "Guitar" ? { vocal:15,diction:15,musical:10,expression:10,stage:10,lyrics:15,presentation:5,extra_a:10,extra_b:10 } : participant.category === "Bass" ? { vocal:35,diction:20,musical:20,expression:25,stage:0,lyrics:0,presentation:0,extra_a:0,extra_b:0 } : participant.category === "Drums" ? { vocal:40,diction:20,musical:20,expression:20,stage:0,lyrics:0,presentation:0,extra_a:0,extra_b:0 } : { vocal:30,diction:25,musical:25,expression:20,stage:0,lyrics:0,presentation:0,extra_a:0,extra_b:0 }; const v: Record<string,number> = {};
      for (const [key,max] of Object.entries(limits)) { const requestKey = key === "extra_a" ? "extraA" : key === "extra_b" ? "extraB" : key; const rawValue = body[requestKey] ?? (max === 0 ? 0 : undefined); const value=Number(rawValue); if(!Number.isFinite(value)||value<0||value>max) return Response.json({error:`${requestKey} ต้องอยู่ระหว่าง 0–${max}`},{status:400}); v[key]=Math.round(value); }
      const note=String(body.note||"").slice(0,500), updatedAt=new Date().toISOString();
      await env.DB.prepare("INSERT INTO scores (judge_id,participant_number,vocal,diction,musical,expression,stage,lyrics,presentation,extra_a,extra_b,note,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(judge_id,participant_number) DO UPDATE SET vocal=excluded.vocal,diction=excluded.diction,musical=excluded.musical,expression=excluded.expression,stage=excluded.stage,lyrics=excluded.lyrics,presentation=excluded.presentation,extra_a=excluded.extra_a,extra_b=excluded.extra_b,note=excluded.note,updated_at=excluded.updated_at").bind(user.judgeId,participantNumber,v.vocal,v.diction,v.musical,v.expression,v.stage,v.lyrics,v.presentation,v.extra_a,v.extra_b,note,updatedAt).run();
      return Response.json({score:{participantNumber,...v,extraA:v.extra_a,extraB:v.extra_b,note,updatedAt,total:Object.values(v).reduce((a,b)=>a+b,0)}, name: user.name});
    }
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/portal") return portalApi(request, env);
    if (url.pathname === "/api/sheet-sync") return sheetSyncApi(request, env);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
