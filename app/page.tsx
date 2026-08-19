"use client";
import { useMemo, useState } from "react";

type Category = "Vocal" | "Guitar" | "Drums" | "Keyboard";
type Participant = { number: string; name: string; category: Category };
type Scores = { vocal: number; diction: number; musical: number; expression: number; stage: number; lyrics: number; presentation: number };
type SavedScore = Scores & { participantNumber: string; note: string; total: number };
type Ranking = Participant & { average: number; judges: number; complete: boolean };

const participants: Participant[] = [
  ["001", "Patimakon Yaemsukhon (Kaopun)","Vocal"], ["002", "Naing Mana (David)","Vocal"], ["003", "Khemmakorn Thongdee (Khem)","Vocal"],
  ["004", "Monpatch Lakesuwankun (Mie)","Vocal"], ["005", "Thiwatsakorn Panyanan (Baitoey)","Vocal"], ["006", "Pongdanal Sompan (Oak)","Vocal"],
  ["007", "Nachachon Chaowakarn (Mana)","Vocal"], ["008", "Punika Chaiadisai (Namhorm)","Vocal"], ["009", "Rachasak Manuspienlerd (Punpun)","Vocal"],
  ["010", "Thanakrit Kasemsiraphop (Namon)","Vocal"], ["011", "Pakorn Limpornchitwilai (Tan)","Vocal"], ["012", "Nuttawiroj Chankaew (Moto)","Vocal"],
  ["013", "Thanyaphat Tussakul (Percy)","Vocal"], ["014", "Kulnicha Khajornphisitsak (Eingko)","Vocal"],
  ["015", "Thaam Wyachai (Dylan)","Guitar"], ["016", "Siwakorn Sirisap (Fame)","Guitar"], ["017", "Poomrapee Neekong (Poom)","Guitar"],
  ["018", "Jittipat Kanjanavikat (August)","Guitar"], ["019", "Saharat Nirnatasukwong (Windows)","Guitar"],
  ["020", "Konchanok Sriyuttakrai (Unseen)","Drums"], ["021", "Teychit Phattharathanasut (HengHeng)","Keyboard"],
].map(([number, name, category]) => ({ number, name, category: category as Category }));
const vocalCriteria: { key: keyof Scores; label: string; max: number }[] = [
  { key: "vocal", label: "Vocal Technique", max: 30 },
  { key: "diction", label: "Tone / Voice Quality", max: 20 },
  { key: "musical", label: "Rhythm & Timing", max: 15 },
  { key: "expression", label: "Expression / Emotion", max: 20 },
  { key: "stage", label: "Stage Presence / Performance", max: 15 },
];
const instrumentCriteria: { key: keyof Scores; label: string; max: number }[] = [
  { key:"vocal",label:"Technical Skill",max:30 }, { key:"diction",label:"Rhythm & Timing",max:20 },
  { key:"musical",label:"Accuracy & Control",max:15 }, { key:"expression",label:"Musical Expression",max:15 },
  { key:"stage",label:"Performance & Stage Presence",max:10 }, { key:"lyrics",label:"Preparedness",max:5 },
  { key:"presentation",label:"Overall Impact",max:5 },
];
const drumCriteria = instrumentCriteria.map(c => c.key === "musical" ? {...c,label:"Groove & Dynamic Control"} : c);
const categories: Category[] = ["Vocal","Guitar","Drums","Keyboard"];
const criteriaFor = (category: Category) => category === "Vocal" ? vocalCriteria : category === "Drums" ? drumCriteria : instrumentCriteria;
const emptyScores: Scores = { vocal: 0, diction: 0, musical: 0, expression: 0, stage: 0, lyrics: 0, presentation: 0 };

export default function Home() {
  const [pin, setPin] = useState(""); const [role, setRole] = useState<"judge" | "admin" | null>(null);
  const [judgeName, setJudgeName] = useState(""); const [saved, setSaved] = useState<Record<string, SavedScore>>({});
  const [selected, setSelected] = useState("001"); const [scores, setScores] = useState<Scores>(emptyScores);
  const [note, setNote] = useState(""); const [rankings, setRankings] = useState<Ranking[]>([]);
  const [status, setStatus] = useState(""); const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<Category>("Vocal"); const [adminCategory, setAdminCategory] = useState<Category>("Vocal");
  const total = useMemo(() => Object.values(scores).reduce((a, b) => a + b, 0), [scores]);
  const current = participants.find((p) => p.number === selected)!;
  const criteria = criteriaFor(current.category);
  const visibleParticipants = participants.filter(p => p.category === category);
  const visibleRankings = rankings.filter(r => r.category === adminCategory);
  async function readJson(res: Response) { const text = await res.text(); return text ? JSON.parse(text) : { error: "ระบบคะแนนยังไม่พร้อม กรุณาลองใหม่" }; }

  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setStatus("");
    const res = await fetch("/api/portal", { headers: { "x-portal-pin": pin } }); const data = await readJson(res); setBusy(false);
    if (!res.ok) return setStatus(data.error || "PIN ไม่ถูกต้อง");
    setRole(data.role); setJudgeName(data.name || "Administrator");
    if (data.role === "judge") setSaved(Object.fromEntries(data.scores.map((s: SavedScore) => [s.participantNumber, s]))); else setRankings(data.rankings);
  }
  function choose(number: string) {
    setSelected(number); const existing = saved[number];
    const nextCriteria = criteriaFor(participants.find(p => p.number === number)!.category);
    setScores(existing ? nextCriteria.reduce((a, c) => ({ ...a, [c.key]: existing[c.key] }), { ...emptyScores }) : emptyScores);
    setNote(existing?.note || ""); setStatus(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function switchCategory(next: Category) { setCategory(next); const first = participants.find(p => p.category === next)!; choose(first.number); }
  async function saveScore() {
    setBusy(true); setStatus("");
    const res = await fetch("/api/portal", { method: "POST", headers: { "content-type": "application/json", "x-portal-pin": pin }, body: JSON.stringify({ participantNumber: selected, ...scores, note }) });
    const data = await readJson(res); setBusy(false); if (!res.ok) return setStatus(data.error || "บันทึกไม่สำเร็จ");
    const updated = { ...saved, [selected]: data.score }; setSaved(updated); setStatus("บันทึกคะแนนเรียบร้อย");
    const next = visibleParticipants.find((p) => !updated[p.number]); if (next) setTimeout(() => choose(next.number), 600);
  }
  async function refreshAdmin() { setBusy(true); const res = await fetch("/api/portal", { headers: { "x-portal-pin": pin } }); const data = await readJson(res); setBusy(false); if (res.ok) setRankings(data.rankings); }
  function signOut() { setRole(null); setPin(""); setSaved({}); setRankings([]); }

  if (!role) return <main className="login-shell"><section className="login-card">
    <div className="brand-mark">MC</div><p className="eyebrow">MUSIC COMPETITION 2026</p><h1>Judging Portal</h1>
    <p className="muted">Private scoring for appointed judges</p><form onSubmit={login}><label htmlFor="pin">Judge or admin PIN</label>
    <input id="pin" inputMode="numeric" autoComplete="one-time-code" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" maxLength={4} autoFocus />
    <button disabled={busy || pin.length !== 4}>{busy ? "Checking…" : "Enter portal"}</button></form>
    {status && <p className="error" role="alert">{status}</p>}<p className="privacy">Scores are private and visible only to the organizer.</p>
  </section></main>;

  if (role === "admin") return <main className="admin-shell"><header className="topbar"><div><p className="eyebrow">MUSIC COMPETITION 2026</p><h1>Results control</h1></div><div className="header-actions"><button className="ghost" onClick={refreshAdmin} disabled={busy}>Refresh</button><button className="ghost" onClick={signOut}>Sign out</button></div></header>
    <nav className="category-tabs admin-tabs" aria-label="Result categories">{categories.map(c => <button key={c} className={adminCategory===c?"active":""} onClick={()=>setAdminCategory(c)}>{c}<span>{participants.filter(p=>p.category===c).length}</span></button>)}</nav>
    <section className="summary"><div><span>Participants</span><strong>21</strong></div><div><span>Judges expected</span><strong>10</strong></div><div><span>{adminCategory} completed</span><strong>{visibleRankings.filter(r => r.complete).length}/{visibleRankings.length}</strong></div></section>
    <section className="ranking-card"><div className="ranking-head"><div><h2>{adminCategory} ranking</h2>{visibleRankings.length===1&&<small>Single-entry category · evaluate against the standard</small>}</div><span>Private admin view</span></div><div className="table-wrap"><table><thead><tr><th>Rank</th><th>Participant</th><th>Judges</th><th>Average</th><th>Status</th></tr></thead><tbody>{visibleRankings.map((r, i) => <tr key={r.number}><td><b className={i < 3 ? "rank top" : "rank"}>{i + 1}</b></td><td><strong>{r.name}</strong><small>#{r.number}</small></td><td>{r.judges}/10</td><td className="score-cell">{r.average.toFixed(2)}</td><td><span className={r.complete ? "pill done" : "pill pending"}>{r.complete ? "Complete" : "In progress"}</span></td></tr>)}</tbody></table></div></section>
  </main>;

  return <main className="judge-shell"><header className="topbar"><div><p className="eyebrow">MUSIC COMPETITION 2026</p><h1>{judgeName}</h1></div><div className="progress-copy"><strong>{Object.keys(saved).length}/21</strong><span>scored</span></div></header>
    <nav className="category-tabs" aria-label="Competition categories">{categories.map(c => <button key={c} className={category===c?"active":""} onClick={()=>switchCategory(c)}>{c}<span>{participants.filter(p=>p.category===c).length}</span></button>)}</nav>
    <div className="judge-grid"><aside><div className="aside-title"><span>{category} participants</span><b>{visibleParticipants.filter(p=>saved[p.number]).length}/{visibleParticipants.length} complete</b></div><div className="participant-list">{visibleParticipants.map(p => <button key={p.number} className={`${selected === p.number ? "active" : ""} ${saved[p.number] ? "scored" : ""}`} onClick={() => choose(p.number)}><span className="number">{p.number}</span><span>{p.name}</span><i>{saved[p.number] ? "✓" : ""}</i></button>)}</div></aside>
      <section className="score-panel"><div className="participant-head"><div><span>{current.category.toUpperCase()} · PARTICIPANT {current.number}</span><h2>{current.name}</h2></div><div className="total"><strong>{total}</strong><span>/ 100</span></div></div>
      <div className="criteria">{criteria.map(c => <div className="criterion" key={c.key}><label htmlFor={c.key}><span>{c.label}</span><small>0–{c.max} points</small></label><div className="score-input"><input id={c.key} type="number" min="0" max={c.max} inputMode="decimal" value={scores[c.key]} onChange={e => setScores(s => ({ ...s, [c.key]: Math.max(0, Math.min(c.max, Number(e.target.value))) }))}/><span>/ {c.max}</span></div></div>)}</div>
      <label className="note-label" htmlFor="note">Private note <small>Optional</small></label><textarea id="note" value={note} onChange={e => setNote(e.target.value)} placeholder="Add a short comment for the organizer…" />
      <div className="save-row"><div aria-live="polite" className={status.includes("เรียบร้อย") ? "success" : "error"}>{status}</div><div><button className="ghost" onClick={signOut}>Sign out</button><button onClick={saveScore} disabled={busy}>{busy ? "Saving…" : saved[selected] ? "Update score" : "Save & continue"}</button></div></div>
      </section></div></main>;
}
