/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
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

const participants = [
  ["001", "Patimakon Yaemsukhon (Kaopun)","Vocal"], ["002", "Naing Mana (David)","Vocal"], ["003", "Khemmakorn Thongdee (Khem)","Vocal"],
  ["004", "Monpatch Lakesuwankun (Mie)","Vocal"], ["005", "Thiwatsakorn Panyanan (Baitoey)","Vocal"], ["006", "Pongdanal Sompan (Oak)","Vocal"],
  ["007", "Nachachon Chaowakarn (Mana)","Vocal"], ["008", "Punika Chaiadisai (Namhorm)","Vocal"], ["009", "Rachasak Manuspienlerd (Punpun)","Vocal"],
  ["010", "Thanakrit Kasemsiraphop (Namon)","Vocal"], ["011", "Pakorn Limpornchitwilai (Tan)","Vocal"], ["012", "Nuttawiroj Chankaew (Moto)","Vocal"],
  ["013", "Thanyaphat Tussakul (Percy)","Vocal"], ["014", "Kulnicha Khajornphisitsak (Eingko)","Vocal"],
  ["015", "Thaam Wyachai (Dylan)","Guitar"], ["016", "Siwakorn Sirisap (Fame)","Guitar"], ["017", "Poomrapee Neekong (Poom)","Guitar"],
  ["018", "Jittipat Kanjanavikat (August)","Guitar"], ["019", "Saharat Nirnatasukwong (Windows)","Guitar"],
  ["020", "Konchanok Sriyuttakrai (Unseen)","Drums"], ["021", "Teychit Phattharathanasut (HengHeng)","Keyboard"],
].map(([number, name, category]) => ({ number, name, category }));

function identity(request: Request) {
  const pin = request.headers.get("x-portal-pin") || "";
  if (pin === "9900") return { role: "admin", name: "Administrator", judgeId: 0 };
  const n = Number(pin) - 4100;
  return n >= 1 && n <= 10 && Number.isInteger(n) ? { role: "judge", name: `Judge ${String(n).padStart(2, "0")}`, judgeId: n } : null;
}

async function portalApi(request: Request, env: Env) {
  const user = identity(request);
  if (!user) return Response.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
  if (request.method === "GET" && user.role === "judge") {
    const result = await env.DB.prepare("SELECT *, vocal+diction+musical+expression+stage + CASE WHEN CAST(participant_number AS INTEGER) > 14 THEN lyrics+presentation ELSE 0 END AS total FROM scores WHERE judge_id = ?").bind(user.judgeId).all();
    const scoreRows = result.results.map((row: Record<string, unknown>) => ({ ...row, participantNumber: row.participant_number, judgeId: row.judge_id, updatedAt: row.updated_at }));
    return Response.json({ role: user.role, name: user.name, scores: scoreRows });
  }
  if (request.method === "GET" && user.role === "admin") {
    const result = await env.DB.prepare("SELECT participant_number, COUNT(*) AS judges, AVG(vocal+diction+musical+expression+stage + CASE WHEN CAST(participant_number AS INTEGER) > 14 THEN lyrics+presentation ELSE 0 END) AS average FROM scores GROUP BY participant_number").all();
    const rows = new Map(result.results.map((r: Record<string, unknown>) => [String(r.participant_number), r]));
    const rankings = participants.map(p => { const r = rows.get(p.number); const judges = Number(r?.judges || 0); return { ...p, judges, average: Number(r?.average || 0), complete: judges === 10 }; }).sort((a,b) => b.average-a.average || a.number.localeCompare(b.number));
    return Response.json({ role: user.role, rankings });
  }
  if (request.method === "POST" && user.role === "judge") {
    const body = await request.json() as Record<string, unknown>; const participantNumber = String(body.participantNumber || "");
    const participant = participants.find(p => p.number === participantNumber);
    if (!participant) return Response.json({ error: "ไม่พบผู้เข้าแข่งขัน" }, { status: 400 });
    const limits: Record<string, number> = participant.category === "Vocal" ? { vocal:30,diction:20,musical:15,expression:20,stage:15,lyrics:0,presentation:0 } : { vocal:30,diction:20,musical:15,expression:15,stage:10,lyrics:5,presentation:5 }; const v: Record<string,number> = {};
    for (const [key,max] of Object.entries(limits)) { const value=Number(body[key]); if(!Number.isFinite(value)||value<0||value>max) return Response.json({error:`${key} ต้องอยู่ระหว่าง 0–${max}`},{status:400}); v[key]=Math.round(value); }
    const note=String(body.note||"").slice(0,500), updatedAt=new Date().toISOString();
    await env.DB.prepare("INSERT INTO scores (judge_id,participant_number,vocal,diction,musical,expression,stage,lyrics,presentation,note,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(judge_id,participant_number) DO UPDATE SET vocal=excluded.vocal,diction=excluded.diction,musical=excluded.musical,expression=excluded.expression,stage=excluded.stage,lyrics=excluded.lyrics,presentation=excluded.presentation,note=excluded.note,updated_at=excluded.updated_at").bind(user.judgeId,participantNumber,v.vocal,v.diction,v.musical,v.expression,v.stage,v.lyrics,v.presentation,note,updatedAt).run();
    return Response.json({score:{participantNumber,...v,note,updatedAt,total:Object.values(v).reduce((a,b)=>a+b,0)}});
  }
  return Response.json({ error: "Method not allowed" }, { status: 405 });
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
