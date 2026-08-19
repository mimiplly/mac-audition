"use client";
import { useMemo, useState } from "react";

type Category = "Vocal" | "Guitar" | "Drums" | "Keyboard";
type Language = "th" | "en";
type Participant = { number: string; name: string; nickname?: string; thaiName?: string; thaiNickname?: string; category: Category };
type Scores = { vocal: number; diction: number; musical: number; expression: number; stage: number; lyrics: number; presentation: number; extraA: number; extraB: number };
type SavedScore = Scores & { participantNumber: string; note: string; total: number };
type Ranking = Participant & { average: number; judges: number; complete: boolean; judgeIds: number[] };
type ImportPreview = { token: string; new: number; updated: number; merged: number; rejected: number; rejectedRows: Array<{ row: number; reason: string }> };

const translations = {
  th: {
    portal: "พอร์ทัลการตัดสิน", privateJudge: "ระบบให้คะแนนส่วนตัวสำหรับกรรมการที่ได้รับแต่งตั้ง", pin: "PIN กรรมการหรือผู้ดูแล", enter: "เข้าสู่ระบบ", checking: "กำลังตรวจสอบ…", privacy: "คะแนนเป็นข้อมูลส่วนตัวและแสดงเฉพาะผู้จัดงานเท่านั้น",
    results: "ควบคุมผลคะแนน", refresh: "รีเฟรช", signOut: "ออกจากระบบ", participants: "ผู้เข้าแข่งขัน", judgesExpected: "กรรมการที่คาดหวัง", completed: "ทำเสร็จแล้ว", ranking: "อันดับ", privateAdmin: "มุมมองผู้ดูแลส่วนตัว", rank: "อันดับ", contestant: "ผู้เข้าแข่งขัน", judges: "กรรมการ", average: "ค่าเฉลี่ย", status: "สถานะ", complete: "เสร็จสิ้น", progress: "กำลังดำเนินการ", scored: "ให้คะแนนแล้ว",
    importTitle: "นำเข้ารายชื่อผู้เข้าแข่งขัน", importHint: "สำหรับผู้ดูแลเท่านั้น วางข้อมูล TSV เพื่อดูตัวอย่าง สำรองข้อมูล และนำเข้า", paste: "วางข้อมูล TSV 11 คอลัมน์ที่นี่", preview: "ดูตัวอย่าง", backupImport: "สำรองข้อมูลและนำเข้า", previewText: "ตัวอย่าง: ใหม่ {new} รายการ, อัปเดต {updated}, รวมซ้ำ {merged}, ปฏิเสธ {rejected}",
    privateNote: "หมายเหตุส่วนตัว", optional: "ไม่บังคับ", notePlaceholder: "เพิ่มความคิดเห็นสั้น ๆ สำหรับผู้จัดงาน…", updateScore: "แก้ไขคะแนน", saveContinue: "บันทึกและไปต่อ", saving: "กำลังบันทึก…", saved: "บันทึกคะแนนเรียบร้อย", points: "คะแนน", participantLabel: "ผู้เข้าแข่งขัน", language: "ภาษาไทย",
    categories: { Vocal: "ร้องเพลง", Guitar: "กีตาร์", Drums: "กลอง", Keyboard: "คีย์บอร์ด" },
    criteria: { vocal: "เทคนิคการร้อง", diction: "โทนเสียง / คุณภาพเสียง", musical: "จังหวะและการตรงเวลา", expression: "การแสดงอารมณ์", stage: "การแสดงบนเวที", technical: "ทักษะทางเทคนิค", accuracy: "ความแม่นยำและการควบคุม", musicalExpression: "การถ่ายทอดดนตรี", performance: "การแสดงและการอยู่บนเวที", preparedness: "การเตรียมพร้อม", impact: "ภาพรวมการนำเสนอ", groove: "การควบคุมกรูฟและไดนามิก", chordScale: "ทักษะคอร์ดและสเกล", playByEar: "ฟังเล่น", improvMusicality: "อิมโพรไวส์และการแสดงดนตรี", keyTranspose: "เปลี่ยนคีย์", grooveRhythm: "กรูฟและจังหวะ", basicTechnique: "ทักษะพื้นฐาน", grooveAdaptation: "ปรับเปลี่ยนกรูฟ", dynamics: "ควบคุมน้ำหนักเสียง", musicality: "การแสดงดนตรี", chordProgression: "ลำดับคอร์ด", timeGroove: "เวลาและกรูฟ", rhythmTiming: "จังหวะและการตรงเวลา", strumInTime: "การเล่นให้ตรงจังหวะ", scale: "รู้สเกลพื้นฐาน", improvise: "สามารถอิมโพรไวส์ได้พื้นฐาน ไม่จำเป็นต้อง Advanced", timeGrooveFull: "รักษาจังหวะได้คงที่ตลอดทั้งเพลง", grooveAdaptationFull: "เล่นตาม Groove ได้", dynamicsFull: "การควบคุมน้ำหนักเสียง Dynamic" },
  },
  en: {
    portal: "Judging Portal", privateJudge: "Private scoring for appointed judges", pin: "Judge or admin PIN", enter: "Enter portal", checking: "Checking…", privacy: "Scores are private and visible only to the organizer.",
    results: "Results control", refresh: "Refresh", signOut: "Sign out", participants: "Participants", judgesExpected: "Judges expected", completed: "completed", ranking: "ranking", privateAdmin: "Private admin view", rank: "Rank", contestant: "Participant", judges: "Judges", average: "Average", status: "Status", complete: "Complete", progress: "In progress", scored: "scored",
    importTitle: "Contestant import", importHint: "Admin-only. Paste TSV data to preview, backup, and import.", paste: "Paste the 11-column TSV here", preview: "Preview", backupImport: "Backup & import", previewText: "Preview: {new} new, {updated} updated, {merged} merged, {rejected} rejected",
    privateNote: "Private note", optional: "Optional", notePlaceholder: "Add a short comment for the organizer…", updateScore: "Update score", saveContinue: "Save & continue", saving: "Saving…", saved: "Score saved", points: "points", participantLabel: "Participant", language: "English",
    categories: { Vocal: "Vocal", Guitar: "Guitar", Drums: "Drums", Keyboard: "Keyboard" },
    criteria: { vocal: "Vocal Technique", diction: "Tone / Voice Quality", musical: "Rhythm & Timing", expression: "Expression / Emotion", stage: "Stage Presence / Performance", technical: "Technical Skill", accuracy: "Accuracy & Control", musicalExpression: "Musical Expression", performance: "Performance & Stage Presence", preparedness: "Preparedness", impact: "Overall Impact", groove: "Groove & Dynamic Control", chordScale: "Chord & Scale Technique", playByEar: "Play by Ear", improvMusicality: "Improvisation & Musicality", keyTranspose: "Key Transposition", grooveRhythm: "Groove & Rhythm", basicTechnique: "Basic Technique", grooveAdaptation: "Groove Adaptation", dynamics: "Dynamics", musicality: "Musicality", chordProgression: "Chord progression", timeGroove: "Time & Groove", rhythmTiming: "Rhythm & Timing", strumInTime: "Strum in time", scale: "Scale", improvise: "Improvise", timeGrooveFull: "Time & Groove", grooveAdaptationFull: "Groove Adaptation", dynamicsFull: "Dynamics" },
  },
} as const;

function participantFromApi(value: any): Participant {
  return { number: value.participantNumber, name: value.englishName, nickname: value.englishNickname, thaiName: value.thaiName, thaiNickname: value.thaiNickname, category: value.category as Category };
}

function participantLabel(participant: Participant, language: Language) {
  const name = language === "th" ? participant.thaiName || participant.name : participant.name;
  const nickname = language === "th" ? participant.thaiNickname : participant.nickname;
  return nickname ? `${name} (${nickname})` : name;
}

function LanguageToggle({ language, onChange, label }: { language: Language; onChange: (language: Language) => void; label: string }) {
  return <div className="language-toggle" aria-label={label}><button className={language === "th" ? "active" : ""} onClick={() => onChange("th")} type="button">ไทย</button><button className={language === "en" ? "active" : ""} onClick={() => onChange("en")} type="button">English</button></div>;
}

const participants: Participant[] = [];
const vocalCriteria: { key: keyof Scores; label: string; max: number }[] = [
  { key: "vocal", label: "Vocal Technique", max: 30 },
  { key: "diction", label: "Tone / Voice Quality", max: 20 },
  { key: "musical", label: "Rhythm & Timing", max: 15 },
  { key: "expression", label: "Expression / Emotion", max: 20 },
  { key: "stage", label: "Stage Presence / Performance", max: 15 },
];
const guitarCriteria: { key: keyof Scores; label: string; max: number }[] = [
  { key: "vocal", label: "Chord progression", max: 15 },
  { key: "diction", label: "Strum in time", max: 15 },
  { key: "musical", label: "Play by ear", max: 10 },
  { key: "expression", label: "Key transpose", max: 10 },
  { key: "stage", label: "Scale", max: 10 },
  { key: "lyrics", label: "Improvise", max: 15 },
  { key: "presentation", label: "Key transpose", max: 5 },
  { key: "extraA", label: "Strum in time", max: 10 },
  { key: "extraB", label: "Play by ear", max: 10 },
];
const bassCriteria: { key: keyof Scores; label: string; max: number }[] = [
  { key: "vocal", label: "Groove & Rhythm", max: 35 },
  { key: "diction", label: "Scale", max: 20 },
  { key: "musical", label: "Key transpose", max: 20 },
  { key: "expression", label: "Play by ear", max: 25 },
];
const drumCriteria: { key: keyof Scores; label: string; max: number }[] = [
  { key: "vocal", label: "Time & Groove", max: 40 },
  { key: "diction", label: "Basic Technique", max: 20 },
  { key: "musical", label: "Dynamics", max: 20 },
  { key: "expression", label: "Groove Adaptation", max: 20 },
];
const keyboardCriteria: { key: keyof Scores; label: string; max: number }[] = [
  { key: "vocal", label: "Chord progression", max: 30 },
  { key: "diction", label: "Strum in time", max: 25 },
  { key: "musical", label: "Play by ear", max: 25 },
  { key: "expression", label: "Key transpose", max: 20 },
];
const categories: Category[] = ["Vocal","Guitar","Drums","Keyboard"];
const criteriaFor = (category: Category) => {
  if (category === "Vocal") return vocalCriteria;
  if (category === "Guitar") return guitarCriteria;
  if (category === "Drums") return drumCriteria;
  return keyboardCriteria;
};
const emptyScores: Scores = { vocal: 0, diction: 0, musical: 0, expression: 0, stage: 0, lyrics: 0, presentation: 0, extraA: 0, extraB: 0 };

export default function Home() {
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    const stored = localStorage.getItem("portal-language");
    if (stored === "th" || stored === "en") return stored;
    return navigator.language.toLowerCase().startsWith("th") ? "th" : "en";
  });
  const [pin, setPin] = useState(""); const [role, setRole] = useState<"judge" | "admin" | null>(null);
  const [judgeName, setJudgeName] = useState(""); const [saved, setSaved] = useState<Record<string, SavedScore>>({});
  const [judgeNames, setJudgeNames] = useState<Record<number, string>>({});
  const [participantList, setParticipantList] = useState<Participant[]>(participants);
  const [selected, setSelected] = useState("001"); const [scores, setScores] = useState<Scores>(emptyScores);
  const [note, setNote] = useState(""); const [rankings, setRankings] = useState<Ranking[]>([]);
  const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  const [importTsv, setImportTsv] = useState(""); const [importPreview, setImportPreview] = useState<ImportPreview | null>(null); const [importStatus, setImportStatus] = useState("");
  const [category, setCategory] = useState<Category>("Vocal"); const [adminCategory, setAdminCategory] = useState<Category>("Vocal");
  const text = translations[language];
  const total = useMemo(() => Object.values(scores).reduce((a, b) => a + b, 0), [scores]);
  const current = participantList.length ? (participantList.find((p) => p.number === selected) || participantList[0]) : undefined;
  const criteria = current ? criteriaFor(current.category) : [];
  const visibleParticipants = participantList.filter(p => p.category === category);
  const visibleRankings = rankings.filter(r => r.category === adminCategory);
  function changeLanguage(next: Language) { setLanguage(next); localStorage.setItem("portal-language", next); }
  function categoryLabel(value: Category) { return text.categories[value]; }
  function criterionLabel(key: string, categoryValue: Category) {
    if (categoryValue === "Vocal") {
      if (key === "vocal") return text.criteria.vocal;
      if (key === "diction") return text.criteria.diction;
      if (key === "musical") return text.criteria.musical;
      if (key === "expression") return text.criteria.expression;
      if (key === "stage") return text.criteria.stage;
    }
    if (categoryValue === "Guitar") {
      if (key === "vocal") return text.criteria.chordProgression;
      if (key === "diction") return text.criteria.strumInTime;
      if (key === "musical") return text.criteria.playByEar;
      if (key === "expression") return text.criteria.keyTranspose;
      if (key === "stage") return text.criteria.scale;
      if (key === "lyrics") return text.criteria.improvise;
      if (key === "presentation") return text.criteria.keyTranspose;
      if (key === "extraA") return text.criteria.strumInTime;
      if (key === "extraB") return text.criteria.playByEar;
    }
    if (categoryValue === "Drums") {
      if (key === "vocal") return text.criteria.timeGrooveFull;
      if (key === "diction") return text.criteria.basicTechnique;
      if (key === "musical") return text.criteria.dynamicsFull;
      if (key === "expression") return text.criteria.grooveAdaptationFull;
    }
    if (categoryValue === "Keyboard") {
      if (key === "vocal") return text.criteria.chordProgression;
      if (key === "diction") return text.criteria.strumInTime;
      if (key === "musical") return text.criteria.playByEar;
      if (key === "expression") return text.criteria.keyTranspose;
    }
    return key;
  }
  async function readJson(res: Response) {
    const text = await res.text();
    if (!text) return { error: "ระบบคะแนนยังไม่พร้อม กรุณาลองใหม่" };
    try { return JSON.parse(text); } catch { return { error: "เซิร์ฟเวอร์ส่งข้อมูลไม่ถูกต้อง กรุณาลองใหม่" }; }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setStatus("");
    const res = await fetch("/api/portal", { headers: { "x-portal-pin": pin } }); const data = await readJson(res); setBusy(false);
    if (!res.ok) return setStatus(data.error || "PIN ไม่ถูกต้อง");
    setRole(data.role); setJudgeName(data.name || "Administrator"); setJudgeNames(data.judgeNames || {});
    setParticipantList(data.contestants.map(participantFromApi));
    if (data.role === "judge") setSaved(Object.fromEntries(data.scores.map((s: SavedScore) => [s.participantNumber, s]))); else setRankings(data.rankings);
  }
  function choose(number: string) {
    setSelected(number); const existing = saved[number];
    const nextCriteria = criteriaFor(participantList.find(p => p.number === number)!.category);
    setScores(existing ? nextCriteria.reduce((a, c) => ({ ...a, [c.key]: existing[c.key] }), { ...emptyScores }) : emptyScores);
    setNote(existing?.note || ""); setStatus(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function switchCategory(next: Category) { setCategory(next); const first = participantList.find(p => p.category === next)!; choose(first.number); }
  async function saveScore() {
    setBusy(true); setStatus("");
    const res = await fetch("/api/portal", { method: "POST", headers: { "content-type": "application/json", "x-portal-pin": pin }, body: JSON.stringify({ participantNumber: selected, ...scores, note }) });
    const data = await readJson(res); setBusy(false); if (!res.ok) return setStatus(data.error || "บันทึกไม่สำเร็จ");
    const updated = { ...saved, [selected]: data.score }; setSaved(updated); setStatus("บันทึกคะแนนเรียบร้อย");
    const next = visibleParticipants.find((p) => !updated[p.number]); if (next) setTimeout(() => choose(next.number), 600);
  }
  async function refreshAdmin() { setBusy(true); const res = await fetch("/api/portal", { headers: { "x-portal-pin": pin } }); const data = await readJson(res); setBusy(false); if (res.ok) { setRankings(data.rankings.map((item: any) => ({ ...item, name: item.englishName, nickname: item.englishNickname, thaiName: item.thaiName, thaiNickname: item.thaiNickname, judgeIds: item.judgeIds || [] }))); setParticipantList(data.contestants.map(participantFromApi)); setJudgeNames(data.judgeNames || {}); } }
  async function previewImport() {
    setImportStatus(""); setImportPreview(null); setBusy(true);
    const res = await fetch("/api/portal", { method: "POST", headers: { "content-type": "application/json", "x-portal-pin": pin }, body: JSON.stringify({ action: "preview", tsv: importTsv }) });
    const data = await readJson(res); setBusy(false); if (!res.ok) return setImportStatus(data.error || "Preview failed"); setImportPreview(data.preview);
  }
  async function importContestants() {
    if (!importPreview) return; setImportStatus(""); setBusy(true);
    const res = await fetch("/api/portal", { method: "POST", headers: { "content-type": "application/json", "x-portal-pin": pin }, body: JSON.stringify({ action: "import", tsv: importTsv, previewToken: importPreview.token }) });
    const data = await readJson(res); setBusy(false); if (!res.ok) return setImportStatus(data.error || "Import failed");
    setParticipantList(data.contestants.map(participantFromApi)); setImportStatus(`${data.imported.new} new, ${data.imported.updated} updated, ${data.imported.merged} merged, ${data.imported.rejected} rejected`); setImportPreview(null); setImportTsv("");
  }
  function signOut() { setRole(null); setPin(""); setJudgeName(""); setJudgeNames({}); setSaved({}); setRankings([]); }

  if (!role) return <main className="login-shell"><section className="login-card">
    <LanguageToggle language={language} onChange={changeLanguage} label={text.language} /><div className="brand-mark">MC</div><p className="eyebrow">MAC SIIT AUDITION 2026</p><h1>{text.portal}</h1>
    <p className="muted">{text.privateJudge}</p><form onSubmit={login}><label htmlFor="pin">{text.pin}</label>
    <input id="pin" inputMode="numeric" autoComplete="one-time-code" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" maxLength={4} autoFocus />
    <button disabled={busy || pin.length !== 4}>{busy ? text.checking : text.enter}</button></form>
    {status && <p className="error" role="alert">{status}</p>}<p className="privacy">{text.privacy}</p>
  </section></main>;

  if (role === "admin") return <main className="admin-shell"><header className="topbar"><div><p className="eyebrow">MAC SIIT AUDITION 2026</p><h1>{judgeName || text.results}</h1></div><div className="header-actions"><LanguageToggle language={language} onChange={changeLanguage} label={text.language} /><button className="ghost" onClick={refreshAdmin} disabled={busy}>{text.refresh}</button><button className="ghost" onClick={signOut}>{text.signOut}</button></div></header>
    <nav className="category-tabs admin-tabs" aria-label={text.categories.Vocal}>{categories.map(c => <button key={c} className={adminCategory===c?"active":""} onClick={()=>setAdminCategory(c)}>{categoryLabel(c)}<span>{participantList.filter(p=>p.category===c).length}</span></button>)}</nav>
    <section className="summary"><div><span>{text.participants}</span><strong>{participantList.length}</strong></div><div><span>{text.judgesExpected}</span><strong>10</strong></div><div><span>{categoryLabel(adminCategory)} {text.completed}</span><strong>{visibleRankings.filter(r => r.complete).length}/{visibleRankings.length}</strong></div></section>
    <section className="import-card"><h2>{text.importTitle}</h2><p>{text.importHint}</p><textarea value={importTsv} onChange={e => setImportTsv(e.target.value)} placeholder={text.paste} /><div className="save-row"><span>{importStatus}</span><div><button className="ghost" onClick={previewImport} disabled={busy || !importTsv.trim()}>{text.preview}</button><button onClick={importContestants} disabled={busy || !importPreview}>{text.backupImport}</button></div></div>{importPreview && <p className="import-preview">{text.previewText.replace("{new}", String(importPreview.new)).replace("{updated}", String(importPreview.updated)).replace("{merged}", String(importPreview.merged)).replace("{rejected}", String(importPreview.rejected))}{importPreview.rejectedRows.length ? ` (${importPreview.rejectedRows.map(r => `row ${r.row}: ${r.reason}`).join("; ")})` : ""}</p>}</section>
    <section className="ranking-card"><div className="ranking-head"><div><h2>{categoryLabel(adminCategory)} {text.ranking}</h2></div><span>{text.privateAdmin}</span></div><div className="table-wrap"><table><thead><tr><th>{text.rank}</th><th>{text.contestant}</th><th>{text.judges}</th><th>{text.average}</th><th>{text.status}</th></tr></thead><tbody>{visibleRankings.map((r, i) => <tr key={r.number}><td><b className={i < 3 ? "rank top" : "rank"}>{i + 1}</b></td><td><strong>{participantLabel(r, language)}</strong><small>#{r.number}</small></td><td>{r.judgeIds.map((id: number) => judgeNames[id] || `Judge ${id}`).join(", ")}</td><td className="score-cell">{r.average.toFixed(2)}</td><td><span className={r.complete ? "pill done" : "pill pending"}>{r.complete ? text.complete : text.progress}</span></td></tr>)}</tbody></table></div></section>
  </main>;

  return <main className="judge-shell"><header className="topbar"><div><p className="eyebrow">MAC SIIT AUDITION 2026</p><h1>{judgeName}</h1></div><div className="progress-copy"><LanguageToggle language={language} onChange={changeLanguage} label={text.language} /><strong>{Object.keys(saved).length}/{participantList.length}</strong><span>{text.scored}</span></div></header>
    <nav className="category-tabs" aria-label={text.participants}>{categories.map(c => <button key={c} className={category===c?"active":""} onClick={()=>switchCategory(c)}>{categoryLabel(c)}<span>{participantList.filter(p=>p.category===c).length}</span></button>)}</nav>
    <div className="judge-grid"><aside><div className="aside-title"><span>{categoryLabel(category)} {text.participants}</span><b>{visibleParticipants.filter(p=>saved[p.number]).length}/{visibleParticipants.length} {text.complete}</b></div><div className="participant-list">{visibleParticipants.map(p => <button key={p.number} className={`${selected === p.number ? "active" : ""} ${saved[p.number] ? "scored" : ""}`} onClick={() => choose(p.number)}><span className="number">{p.number}</span><span>{participantLabel(p, language)}</span><i>{saved[p.number] ? "✓" : ""}</i></button>)}</div></aside>
      <section className="score-panel"><div className="participant-head"><div><span>{current ? categoryLabel(current.category).toUpperCase() : ""} · {text.participantLabel.toUpperCase()} {current?.number}</span><h2>{current ? participantLabel(current, language) : ""}</h2></div><div className="total"><strong>{total}</strong><span>/ 100</span></div></div>
      <div className="criteria">{criteria.map(c => <div className="criterion" key={c.key}><label htmlFor={c.key}><span>{current ? criterionLabel(c.key, current.category) : ""}</span><small>0–{c.max} {text.points}</small></label><div className="score-input"><input id={c.key} type="number" min="0" max={c.max} inputMode="decimal" value={scores[c.key]} onChange={e => setScores(s => ({ ...s, [c.key]: Math.max(0, Math.min(c.max, Number(e.target.value))) }))}/><span>/ {c.max}</span></div></div>)}</div>
      <label className="note-label" htmlFor="note">{text.privateNote} <small>{text.optional}</small></label><textarea id="note" value={note} onChange={e => setNote(e.target.value)} placeholder={text.notePlaceholder} />
      <div className="save-row"><div aria-live="polite" className={status.includes("เรียบร้อย") || status === text.saved ? "success" : "error"}>{status}</div><div><button className="ghost" onClick={signOut}>{text.signOut}</button><button onClick={saveScore} disabled={busy}>{busy ? text.saving : saved[selected] ? text.updateScore : text.saveContinue}</button></div></div>
      </section></div></main>;
}
