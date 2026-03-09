/**
 * Axelerant Daily SEO Audit — v4 (Direct API Edition)
 * Uses Semrush REST API + Slack API directly — no MCP dependency.
 *
 * Posts to: #wg-digital-bu-new-revenue (C07B43GM812)
 * Schedule: 9:00 AM IST daily (Mon–Fri) via GitHub Actions
 *
 * REQUIRED ENV VARS (add all 3 as GitHub Secrets):
 *   ANTHROPIC_API_KEY   — https://console.anthropic.com/settings/keys
 *   SEMRUSH_API_KEY     — https://www.semrush.com/api-analytics/
 *   SLACK_BOT_TOKEN     — https://api.slack.com/apps → your app → OAuth tokens
 *
 * OPTIONAL:
 *   SLACK_CHANNEL_ID    — default: C07B43GM812 (#wg-digital-bu-new-revenue)
 *   TARGET_DOMAIN       — default: axelerant.com
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SEMRUSH_API_KEY   = process.env.SEMRUSH_API_KEY;
const SLACK_BOT_TOKEN   = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL_ID  = process.env.SLACK_CHANNEL_ID  || "C07B43GM812";
const DOMAIN            = process.env.TARGET_DOMAIN     || "axelerant.com";
const COMPETITORS       = ["appnovation.com", "specbee.com", "elevatedthird.com"];

// Validate all required keys upfront
const missing = ["ANTHROPIC_API_KEY","SEMRUSH_API_KEY","SLACK_BOT_TOKEN"].filter(k => !process.env[k]);
if (missing.length) { console.error(`❌ Missing env vars: ${missing.join(", ")}`); process.exit(1); }

// ─── Semrush API caller ───────────────────────────────────────────────────────
async function semrush(params) {
  const qs = new URLSearchParams({ ...params, key: SEMRUSH_API_KEY }).toString();
  const url = `https://api.semrush.com/?${qs}`;
  const res = await fetch(url);
  const text = await res.text();
  if (text.startsWith("ERROR")) throw new Error(`Semrush error: ${text}`);

  // Parse CSV response into array of objects
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(";");
  return lines.slice(1).map(line => {
    const vals = line.split(";");
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]]));
  });
}

// ─── Anthropic API caller ─────────────────────────────────────────────────────
async function callClaude(prompt, maxTokens = 3000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content.filter(b => b.type === "text").map(b => b.text).join("").replace(/```json|```/g, "").trim();
}

// ─── Slack API caller ─────────────────────────────────────────────────────────
async function slackPost(method, body) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SLACK_BOT_TOKEN}`
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack ${method} error: ${data.error}`);
  return data;
}

// ─── MODULE 1: Domain Overview ────────────────────────────────────────────────
async function fetchOverview() {
  console.log("📊 [1/5] Domain overview...");
  const [us, uk] = await Promise.all([
    semrush({ type: "domain_rank", domain: DOMAIN, database: "us", export_columns: "Or,Ot,Oc,Ad" }),
    semrush({ type: "domain_rank", domain: DOMAIN, database: "uk", export_columns: "Or,Ot,Oc,Ad" })
  ]);
  const parse = (rows) => rows[0] ? {
    keywords: parseInt(rows[0]["Organic Keywords"] || 0),
    traffic:  parseInt(rows[0]["Organic Traffic"]  || 0),
    value:    parseInt(rows[0]["Organic Cost"]      || 0),
    paid:     parseInt(rows[0]["Adwords Keywords"]  || 0)
  } : {};
  return { us: parse(us), uk: parse(uk) };
}

// ─── MODULE 2: US Rankings ────────────────────────────────────────────────────
async function fetchUSRankings() {
  console.log("🇺🇸 [2/5] US rankings + quick wins...");
  const cols = "Ph,Po,Nq,Cp,Ur,Kd";
  const [top, wins] = await Promise.all([
    semrush({ type: "domain_organic", domain: DOMAIN, database: "us", display_limit: 25, display_sort: "nq_desc", export_columns: cols }),
    semrush({ type: "domain_organic", domain: DOMAIN, database: "us", display_limit: 25, display_sort: "nq_desc", display_filter: "+|Po|Gt|3|+|Po|Lt|21", export_columns: cols })
  ]);
  const map = rows => rows.map(r => ({
    keyword:  r["Keyword"] || r["Ph"] || "",
    position: parseInt(r["Position"] || r["Po"] || 0),
    volume:   parseInt(r["Search Volume"] || r["Nq"] || 0),
    cpc:      parseFloat(r["CPC"] || r["Cp"] || 0).toFixed(2),
    kd:       parseInt(r["Keyword Difficulty"] || r["Kd"] || 0),
    url:      r["URL"] || r["Ur"] || ""
  }));
  return { top_keywords: map(top), quick_wins: map(wins) };
}

// ─── MODULE 3: UK Rankings ────────────────────────────────────────────────────
async function fetchUKRankings() {
  console.log("🇬🇧 [3/5] UK rankings + quick wins...");
  const cols = "Ph,Po,Nq,Cp,Ur,Kd";
  const [top, wins] = await Promise.all([
    semrush({ type: "domain_organic", domain: DOMAIN, database: "uk", display_limit: 25, display_sort: "nq_desc", export_columns: cols }),
    semrush({ type: "domain_organic", domain: DOMAIN, database: "uk", display_limit: 25, display_sort: "nq_desc", display_filter: "+|Po|Gt|3|+|Po|Lt|21", export_columns: cols })
  ]);
  const map = rows => rows.map(r => ({
    keyword:  r["Keyword"] || r["Ph"] || "",
    position: parseInt(r["Position"] || r["Po"] || 0),
    volume:   parseInt(r["Search Volume"] || r["Nq"] || 0),
    cpc:      parseFloat(r["CPC"] || r["Cp"] || 0).toFixed(2),
    kd:       parseInt(r["Keyword Difficulty"] || r["Kd"] || 0),
    url:      r["URL"] || r["Ur"] || ""
  }));
  return { top_keywords: map(top), quick_wins: map(wins) };
}

// ─── MODULE 4: Competitor Gap Analysis ───────────────────────────────────────
async function fetchCompetitorGaps() {
  console.log("🏁 [4/5] Competitor gaps...");
  const cols = "Ph,P0,P1,P2,Nq,Cp,Kd";
  const domainsUS = `*|or|${COMPETITORS[0]}|+|or|${COMPETITORS[1]}|-|or|${DOMAIN}`;
  const domainsUK = `*|or|${COMPETITORS[0]}|+|or|${COMPETITORS[2]}|-|or|${DOMAIN}`;
  const [usGaps, ukGaps, topComps] = await Promise.all([
    semrush({ type: "domain_domains", domains: domainsUS, database: "us", display_limit: 25, display_sort: "nq_desc", export_columns: cols }),
    semrush({ type: "domain_domains", domains: domainsUK, database: "uk", display_limit: 20, display_sort: "nq_desc", export_columns: cols }),
    semrush({ type: "domain_organic_organic", domain: DOMAIN, database: "us", display_limit: 5, export_columns: "Dn,Cr,Or,Ot" })
  ]);
  const mapGap = rows => rows.map(r => ({
    keyword: r["Keyword"] || r["Ph"] || "",
    volume:  parseInt(r["Search Volume"] || r["Nq"] || 0),
    cpc:     parseFloat(r["CPC"] || r["Cp"] || 0).toFixed(2),
    kd:      parseInt(r["Keyword Difficulty"] || r["Kd"] || 0),
    comp1_pos: r["P0"] || r[`${COMPETITORS[0]}`] || "—",
    comp2_pos: r["P1"] || r[`${COMPETITORS[1]}`] || "—"
  }));
  const mapComp = rows => rows.map(r => ({
    domain:   r["Domain"] || r["Dn"] || "",
    keywords: parseInt(r["Organic Keywords"] || r["Or"] || 0),
    traffic:  parseInt(r["Organic Traffic"]  || r["Ot"] || 0)
  }));
  return { us_gaps: mapGap(usGaps), uk_gaps: mapGap(ukGaps), top_competitors: mapComp(topComps) };
}

// ─── MODULE 5: Keyword Opportunities ─────────────────────────────────────────
async function fetchOpportunities() {
  console.log("🎯 [5/5] Keyword opportunities...");
  const cols = "Ph,Nq,Cp,Co,Kd";
  const seeds = ["drupal development agency", "aws consulting services", "hubspot implementation services", "drupal migration services"];
  const results = await Promise.all(
    seeds.map(phrase => semrush({ type: "phrase_related", phrase, database: "us", display_limit: 20, display_sort: "nq_desc", export_columns: cols }))
  );
  // Flatten, dedupe, filter for commercial intent
  const seen = new Set();
  const opps = results.flat()
    .map(r => ({
      keyword: r["Keyword"] || r["Ph"] || "",
      volume:  parseInt(r["Search Volume"] || r["Nq"] || 0),
      cpc:     parseFloat(r["CPC"] || r["Cp"] || 0).toFixed(2),
      kd:      parseInt(r["Keyword Difficulty"] || r["Kd"] || 0)
    }))
    .filter(r => r.volume >= 100 && r.kd <= 35 && parseFloat(r.cpc) >= 8 && r.keyword)
    .filter(r => {
      if (seen.has(r.keyword)) return false;
      seen.add(r.keyword);
      return true;
    })
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 15)
    .map(r => ({
      ...r,
      priority: r.kd <= 15 && r.volume >= 200 ? "high" : r.kd <= 25 || r.volume >= 300 ? "medium" : "low"
    }));
  return { opportunities: opps };
}

// ─── AI Analysis via Claude ───────────────────────────────────────────────────
async function generateAnalysis(overview, usData, ukData, gaps, opps) {
  console.log("💡 Generating AI analysis...");
  const prompt = `
You are a senior SEO strategist reviewing daily audit data for axelerant.com — a Drupal/AWS/HubSpot digital services agency targeting US and UK enterprise clients.

DATA:
- US: ${overview?.us?.keywords} keywords, ~${overview?.us?.traffic} visits/mo, $${overview?.us?.value} traffic value
- UK: ${overview?.uk?.keywords} keywords, ~${overview?.uk?.traffic} visits/mo
- US quick wins (pos 4-20): ${JSON.stringify((usData?.quick_wins||[]).slice(0,10))}
- UK quick wins (pos 4-20): ${JSON.stringify((ukData?.quick_wins||[]).slice(0,10))}
- Competitor gaps: ${JSON.stringify((gaps?.us_gaps||[]).slice(0,8))}
- Opportunities: ${JSON.stringify((opps?.opportunities||[]).slice(0,8))}

Return ONLY valid raw JSON with no markdown fences:
{
  "summary": "2-3 sentence overall assessment",
  "us_analysis": "2-3 sentences on US performance",
  "uk_analysis": "2-3 sentences on UK — note it is critically underdeveloped",
  "priority_actions": [
    { "action": "", "why": "", "impact": "high|medium|low", "effort": "low|medium|high" }
  ],
  "quick_wins_today": [
    { "keyword": "", "current_pos": 0, "target_pos": 0, "volume": 0, "what_to_do": "" }
  ],
  "highlights": ["insight 1","insight 2","insight 3","insight 4","insight 5"]
}`;
  const raw = await callClaude(prompt, 2000);
  try { return JSON.parse(raw); } catch { return { highlights: ["AI analysis unavailable — check logs"] }; }
}

// ─── Build Slack Canvas content ───────────────────────────────────────────────
function buildCanvas(date, overview, usData, ukData, gaps, opps, analysis) {
  const fmt = n => typeof n === "number" ? n.toLocaleString() : (n || "—");
  const usd = v => v && v !== "0.00" ? `$${v}` : "—";
  const pos = p => p ? `#${p}` : "—";
  const dot = p => parseInt(p) <= 3 ? "🟢" : parseInt(p) <= 10 ? "🟡" : "🔴";

  const kwTable = (kws = [], limit = 15) => {
    if (!kws.length) return "_No data_\n";
    return `| Keyword | Pos | Volume | CPC | KD |\n|---|---|---|---|---|\n` +
      kws.slice(0, limit).map(k =>
        `| ${dot(k.position)} ${k.keyword} \\| ${pos(k.position)} \\| ${fmt(k.volume)} \\| ${usd(k.cpc)} \\| ${k.kd ?? "—"} |`
      ).join("\n") + "\n";
  };

  const gapTable = (gaps = [], limit = 15) => {
    if (!gaps.length) return "_No gaps found_\n";
    return `| Keyword | Volume | CPC | KD | Competitor Pos |\n|---|---|---|---|---|\n` +
      gaps.slice(0, limit).map(g =>
        `| ${g.keyword} \\| ${fmt(g.volume)} \\| ${usd(g.cpc)} \\| ${g.kd ?? "—"} \\| ${g.comp1_pos} / ${g.comp2_pos} |`
      ).join("\n") + "\n";
  };

  const oppTable = (opps = [], limit = 15) => {
    if (!opps.length) return "_No opportunities found_\n";
    const icon = p => p === "high" ? "🔥" : p === "medium" ? "✅" : "➡️";
    return `| Priority | Keyword | Volume | CPC | KD |\n|---|---|---|---|---|\n` +
      opps.slice(0, limit).map(o =>
        `| ${icon(o.priority)} ${o.priority} \\| ${o.keyword} \\| ${fmt(o.volume)} \\| ${usd(o.cpc)} \\| ${o.kd ?? "—"} |`
      ).join("\n") + "\n";
  };

  const us = overview?.us || {};
  const uk = overview?.uk || {};
  const actions = (analysis?.priority_actions || []);
  const qwToday = (analysis?.quick_wins_today || []);
  const highlights = (analysis?.highlights || []);

  return `# Axelerant SEO Audit — ${date}

${analysis?.summary || ""}

---

## Overall Performance

| Metric | 🇺🇸 United States | 🇬🇧 United Kingdom |
|---|---|---|
| Keywords Ranking | ${fmt(us.keywords)} | ${fmt(uk.keywords)} |
| Est. Monthly Traffic | ${fmt(us.traffic)} | ${fmt(uk.traffic)} |
| Traffic Value | $${fmt(us.value)} | $${fmt(uk.value)} |
| Paid Keywords | ${fmt(us.paid)} | ${fmt(uk.paid)} |

---

## 🇺🇸 US Rankings

${analysis?.us_analysis || ""}

### Top Keywords (by volume)

${kwTable(usData?.top_keywords, 15)}

### Quick Wins — Positions 4–20

These pages are already indexed — a focused on-page refresh and internal link push could move them to top 3.

${kwTable(usData?.quick_wins, 15)}

---

## 🇬🇧 UK Rankings

${analysis?.uk_analysis || ""}

### Top Keywords (by volume)

${kwTable(ukData?.top_keywords, 15)}

### Quick Wins — Positions 4–20

${kwTable(ukData?.quick_wins, 15)}

---

## 🏁 Competitor Keyword Gaps

Keywords that ${COMPETITORS[0]} and ${COMPETITORS[1]} rank for — that axelerant.com does NOT.

### US Gaps

${gapTable(gaps?.us_gaps, 15)}

### UK Gaps

${gapTable(gaps?.uk_gaps, 15)}

### Top Competitors

${(gaps?.top_competitors||[]).map(c => `- **${c.domain}** — ${fmt(c.keywords)} keywords, ~${fmt(c.traffic)} monthly traffic`).join("\n") || "_No data_"}

---

## 🎯 New Keyword Opportunities

Low KD + high CPC across Drupal / AWS / HubSpot clusters.

${oppTable(opps?.opportunities, 15)}

---

## 💡 Strategic Recommendations

### Priority Actions

${actions.map((a, i) => `**${i+1}. ${a.action}**\n_Why:_ ${a.why}\n_Impact:_ ${a.impact} | _Effort:_ ${a.effort}`).join("\n\n") || "_None generated_"}

### Act on These Today

${qwToday.map(q => `- **${q.keyword}** — currently pos ${q.current_pos}, push to pos ${q.target_pos} (${fmt(q.volume)} vol)\n  → ${q.what_to_do}`).join("\n") || "_None identified_"}

---

## 🔑 Today's Key Highlights

${highlights.map(h => `- ${h}`).join("\n")}

---

_Axelerant SEO Audit Bot · Semrush + Claude · ${date}_`;
}

// ─── Build Slack summary card ─────────────────────────────────────────────────
function buildSummary(date, overview, usData, ukData, analysis) {
  const fmt = n => typeof n === "number" ? n.toLocaleString() : (n || "—");
  const usd = v => v && v !== "0.00" ? `$${v}` : "—";
  const us  = overview?.us || {};
  const uk  = overview?.uk || {};
  const topUSWin = usData?.quick_wins?.[0];
  const topUKWin = ukData?.quick_wins?.[0];
  const highlights = (analysis?.highlights || []).slice(0, 5).map(h => `  • ${h}`).join("\n");
  const actions = (analysis?.priority_actions || []).slice(0, 3)
    .map((a, i) => `  ${i+1}. *${a.action}* _(${a.impact} impact · ${a.effort} effort)_`).join("\n");

  return `*📊 Axelerant Daily SEO Audit — ${date}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🇺🇸 *US* — *${fmt(us.keywords)}* keywords · *${fmt(us.traffic)}* visits/mo · *$${fmt(us.value)}* value
🇬🇧 *UK* — *${fmt(uk.keywords)}* keywords · *${fmt(uk.traffic)}* visits/mo
${topUSWin ? `\n🎯 *Top US quick win:* _${topUSWin.keyword}_ — pos *${topUSWin.position}* · ${fmt(topUSWin.volume)} vol · ${usd(topUSWin.cpc)} CPC · KD ${topUSWin.kd}` : ""}
${topUKWin ? `🎯 *Top UK quick win:* _${topUKWin.keyword}_ — pos *${topUKWin.position}* · ${fmt(topUKWin.volume)} vol · KD ${topUKWin.kd}` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 *Key Highlights*
${highlights}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔺 *Priority Actions*
${actions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Full details in thread below ↓_`;
}

// ─── Build thread sections ────────────────────────────────────────────────────
function buildThreadSections(date, overview, usData, ukData, gaps, opps, analysis) {
  const fmt = n => typeof n === "number" ? n.toLocaleString() : (n || "—");
  const usd = v => v && v !== "0.00" ? `$${v}` : "—";
  const pos = p => p ? `#${p}` : "—";
  const dot = p => parseInt(p) <= 3 ? "🟢" : parseInt(p) <= 10 ? "🟡" : "🔴";

  const kwLines = (kws = [], limit = 10) =>
    kws.slice(0, limit).map(k =>
      `${dot(k.position)} *${k.keyword}* — pos ${pos(k.position)} · ${fmt(k.volume)} vol · ${usd(k.cpc)} CPC · KD ${k.kd ?? "—"}`
    ).join("\n") || "_No data_";

  const gapLines = (gs = [], limit = 8) =>
    gs.slice(0, limit).map(g =>
      `• *${g.keyword}* — ${fmt(g.volume)} vol · ${usd(g.cpc)} CPC · KD ${g.kd ?? "—"}`
    ).join("\n") || "_No gaps found_";

  const oppLines = (os = [], limit = 8) => {
    const icon = p => p === "high" ? "🔥" : p === "medium" ? "✅" : "➡️";
    return os.slice(0, limit).map(o =>
      `${icon(o.priority)} *${o.keyword}* — ${fmt(o.volume)} vol · ${usd(o.cpc)} CPC · KD ${o.kd ?? "—"}`
    ).join("\n") || "_No opportunities_";
  };

  const qwToday = (analysis?.quick_wins_today || []);
  const allActions = (analysis?.priority_actions || []);

  return [
    // Section 1: US Rankings
    `*🇺🇸 US Rankings — Top Keywords*\n\n${kwLines(usData?.top_keywords, 10)}`,

    // Section 2: US Quick Wins
    `*🇺🇸 US Quick Wins (pos 4–20) — Push these to top 3*\n\n${kwLines(usData?.quick_wins, 10)}`,

    // Section 3: UK Rankings + Quick Wins
    `*🇬🇧 UK Rankings — Top Keywords*\n\n${kwLines(ukData?.top_keywords, 8)}\n\n*🇬🇧 UK Quick Wins (pos 4–20)*\n\n${kwLines(ukData?.quick_wins, 8)}`,

    // Section 4: Competitor gaps
    `*🏁 Competitor Keyword Gaps (US)*\nKeywords appnovation.com / specbee.com rank for — axelerant.com does NOT:\n\n${gapLines(gaps?.us_gaps, 10)}\n\n*🏁 Competitor Keyword Gaps (UK)*\n\n${gapLines(gaps?.uk_gaps, 6)}`,

    // Section 5: Opportunities + Actions
    `*🎯 New Keyword Opportunities*\nLow KD + high CPC across Drupal / AWS / HubSpot:\n\n${oppLines(opps?.opportunities, 10)}\n\n*📋 Act on These Today*\n\n${qwToday.map(q => `• *${q.keyword}* (pos ${q.current_pos} → ${q.target_pos}, ${fmt(q.volume)} vol)\n  → ${q.what_to_do}`).join("\n") || "_None identified_"}\n\n*🔺 All Priority Actions*\n\n${allActions.map((a, i) => `${i+1}. *${a.action}*\n   _Why:_ ${a.why}\n   _Impact:_ ${a.impact} · _Effort:_ ${a.effort}`).join("\n\n") || "_None_"}`
  ];
}

// ─── Post to Slack (summary + thread) ────────────────────────────────────────
async function postToSlack(summary, threadSections) {
  console.log("📨 Posting summary to Slack...");

  // Post main summary message
  const mainRes = await slackPost("chat.postMessage", {
    channel: SLACK_CHANNEL_ID,
    text: summary,
    mrkdwn: true
  });
  const thread_ts = mainRes.ts;
  console.log("✅ Summary posted");

  // Post each section as a thread reply
  for (let i = 0; i < threadSections.length; i++) {
    await slackPost("chat.postMessage", {
      channel: SLACK_CHANNEL_ID,
      text: threadSections[i],
      thread_ts,
      mrkdwn: true
    });
    console.log(`✅ Thread section ${i + 1}/${threadSections.length} posted`);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const date = new Date().toISOString().split("T")[0];
  console.log(`\n🚀 Axelerant Full SEO Audit — ${date}\n`);

  try {
    // Run all data modules — parallel where safe
    const [overview, usData, ukData] = await Promise.all([
      fetchOverview(),
      fetchUSRankings(),
      fetchUKRankings()
    ]);

    const [gaps, opps] = await Promise.all([
      fetchCompetitorGaps(),
      fetchOpportunities()
    ]);

    const analysis = await generateAnalysis(overview, usData, ukData, gaps, opps);

    // Build outputs
    const summary        = buildSummary(date, overview, usData, ukData, analysis);
    const threadSections = buildThreadSections(date, overview, usData, ukData, gaps, opps, analysis);

    // Post to Slack
    await postToSlack(summary, threadSections);

    console.log(`\n🎉 Audit complete — ${date}\n`);
  } catch (err) {
    console.error("❌ Audit failed:", err.message);
    process.exit(1);
  }
}

main();
