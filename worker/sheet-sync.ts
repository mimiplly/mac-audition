interface SheetSyncEnv {
  DB: D1Database;
  SHEET_SYNC_TOKEN: string;
}

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

export async function sheetSyncApi(request: Request, env: SheetSyncEnv) {
  if (request.method !== "GET") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const authorization = request.headers.get("authorization") || "";
  if (!env.SHEET_SYNC_TOKEN || authorization !== `Bearer ${env.SHEET_SYNC_TOKEN}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contestants = await env.DB.prepare(`
    SELECT participant_number, category, thai_name, thai_nickname,
           english_name, english_nickname
    FROM contestants
    ORDER BY CAST(participant_number AS INTEGER), participant_number
  `).all();

  const scores = await env.DB.prepare(`
    SELECT judge_id, participant_number,
           vocal, diction, musical, expression, stage, lyrics,
           presentation, extra_a, extra_b, note, updated_at,
           vocal+diction+musical+expression+stage+lyrics+
           presentation+extra_a+extra_b AS total
    FROM scores
    ORDER BY CAST(participant_number AS INTEGER), participant_number, judge_id
  `).all();

  return Response.json({
    generatedAt: new Date().toISOString(),
    contestants: contestants.results.map((row: Record<string, unknown>) => ({
      participantNumber: String(row.participant_number),
      category: String(row.category),
      thaiName: String(row.thai_name || ""),
      thaiNickname: String(row.thai_nickname || ""),
      englishName: String(row.english_name || ""),
      englishNickname: String(row.english_nickname || ""),
    })),
    scores: scores.results.map((row: Record<string, unknown>) => ({
      participantNumber: String(row.participant_number),
      judgeId: Number(row.judge_id),
      judgeName: judgeNames[Number(row.judge_id)] || `Judge ${row.judge_id}`,
      vocal: Number(row.vocal || 0),
      diction: Number(row.diction || 0),
      musical: Number(row.musical || 0),
      expression: Number(row.expression || 0),
      stage: Number(row.stage || 0),
      lyrics: Number(row.lyrics || 0),
      presentation: Number(row.presentation || 0),
      extraA: Number(row.extra_a || 0),
      extraB: Number(row.extra_b || 0),
      total: Number(row.total || 0),
      note: String(row.note || ""),
      updatedAt: String(row.updated_at || ""),
    })),
  }, {
    headers: { "cache-control": "no-store" },
  });
}
