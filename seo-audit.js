/**
 * Axelerant Daily SEO Audit — Detailed Analysis
 * Matches the depth of a manual Semrush audit:
 *   - US & UK domain overview (keywords, traffic, value)
 *   - Top ranking keywords per region
 *   - Quick wins (pos 4–20) with full context
 *   - Competitor gap analysis vs appnovation + specbee
 *   - New keyword opportunities (low KD, high CPC)
 *   - AI-generated strategic recommendations
 *
 * Output: Slack Canvas (full report) + summary card in channel
 * Channel: #wg-digital-bu-new-revenue (C07B43GM812)
 * Schedule: 9:00 AM IST daily via GitHub Actions
 *
 * ENV VARS:
 *   ANTHROPIC_API_KEY  (required)
 *   SLACK_CHANNEL_ID   (default: C07B43GM812)
 *   TARGET_DOMAIN      (default: axelerant.com)
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SLACK_CHANNEL_ID  = process.env.SLACK_CHANNEL_ID || "C07B43GM812";
const DOMAIN            = process.env.TARGET_DOMAIN    || "axelerant.com";
const COMPETITORS       = ["appnovation.com", "specbee.com", "elevatedthird.com"];

if (!ANTHROPIC_API_KEY) { console.error("❌ ANTHROPIC_API_KEY not set."); process.exit(1); }

// ─── Core API caller ──────────────────────────────────────────────────────────
async function callClaude(prompt, mcpServers = [], maxTokens = 6000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "mcp-client-2025-04-04"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
      mcp_servers: mcpServers
    })
  });

  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content.filter(b => b.type === "text").map(b => b.text).join("").replace(/```json|```/g, "").trim();
}

const SEMRUSH = [{ type: "url", url: "https://mcp.semrush.com/v1/mcp", name: "semrush" }];
const SLACK   = [{ type: "url", url: "https://mcp.slack.com/mcp",      name: "slack"   }];

// ─── MODULE 1: Domain Overview (US + UK) ─────────────────────────────────────
async function fetchDomainOverview() {
  console.log("📊 [1/5] Domain overview US + UK...");
  const raw = await callClaude(`
Use the Semrush MCP domain_rank report to get domain overview stats for "${DOMAIN}".
Run it twice: once for database "us" and once for database "uk".
Export columns: Or, Ot, Oc, Ad

Return ONLY raw JSON (no markdown):
{
  "us": { "keywords": 0, "traffic": 0, "traffic_value": 0, "paid_keywords": 0 },
  "uk": { "keywords": 0, "traffic": 0, "traffic_value": 0, "paid_keywords": 0 }
}`, SEMRUSH);
  try { return JSON.parse(raw); } catch { console.warn("⚠️  overview parse fail"); return {}; }
}

// ─── MODULE 2: Top Keywords + Quick Wins (US) ────────────────────────────────
async function fetchUSRankings() {
  console.log("🇺🇸 [2/5] US rankings + quick wins...");
  const raw = await callClaude(`
Use Semrush MCP domain_organic report for domain "${DOMAIN}", database "us".

Run it twice:
1. Top keywords: display_limit 30, display_sort "nq_desc", export_columns Ph,Po,Nq,Cp,Ur,Kd
2. Quick wins (positions 4-20): display_limit 30, display_filter "+|Po|Gt|3|+|Po|Lt|21", display_sort "nq_desc", export_columns Ph,Po,Nq,Cp,Ur,Kd

Return ONLY raw JSON (no markdown):
{
  "top_keywords": [
    { "keyword": "", "position": 0, "volume": 0, "cpc": "0.00", "kd": 0, "url": "" }
  ],
  "quick_wins": [
    { "keyword": "", "position": 0, "volume": 0, "cpc": "0.00", "kd": 0, "url": "" }
  ]
}`, SEMRUSH, 6000);
  try { return JSON.parse(raw); } catch { console.warn("⚠️  US rankings parse fail"); return { top_keywords: [], quick_wins: [] }; }
}

// ─── MODULE 3: Top Keywords + Quick Wins (UK) ────────────────────────────────
async function fetchUKRankings() {
  console.log("🇬🇧 [3/5] UK rankings + quick wins...");
  const raw = await callClaude(`
Use Semrush MCP domain_organic report for domain "${DOMAIN}", database "uk".

Run it twice:
1. Top keywords: display_limit 30, display_sort "nq_desc", export_columns Ph,Po,Nq,Cp,Ur,Kd
2. Quick wins (positions 4-20): display_limit 30, display_filter "+|Po|Gt|3|+|Po|Lt|21", display_sort "nq_desc", export_columns Ph,Po,Nq,Cp,Ur,Kd

Return ONLY raw JSON (no markdown):
{
  "top_keywords": [
    { "keyword": "", "position": 0, "volume": 0, "cpc": "0.00", "kd": 0, "url": "" }
  ],
  "quick_wins": [
    { "keyword": "", "position": 0, "volume": 0, "cpc": "0.00", "kd": 0, "url": "" }
  ]
}`, SEMRUSH, 6000);
  try { return JSON.parse(raw); } catch { console.warn("⚠️  UK rankings parse fail"); return { top_keywords: [], quick_wins: [] }; }
}

// ─── MODULE 4: Competitor Gap Analysis ───────────────────────────────────────
async function fetchCompetitorGaps() {
  console.log("🏁 [4/5] Competitor gap analysis...");
  const raw = await callClaude(`
Use Semrush MCP tools for a competitor gap analysis for "${DOMAIN}" in the US market.

Step 1 — Run domain_organic_organic for "${DOMAIN}", database "us", display_limit 5.
This gives you the top organic competitors.

Step 2 — Run domain_domains with:
  domains: "*|or|${COMPETITORS[0]}|+|or|${COMPETITORS[1]}|-|or|${DOMAIN}"
  database: "us"
  display_limit: 30
  display_sort: "nq_desc"
  export_columns: Ph,P0,P1,P2,Nq,Cp,Kd

These are keywords competitors rank for that ${DOMAIN} does NOT rank for.

Step 3 — Also run domain_domains for UK:
  domains: "*|or|${COMPETITORS[0]}|+|or|${COMPETITORS[2]}|-|or|${DOMAIN}"
  database: "uk"
  display_limit: 20
  display_sort: "nq_desc"
  export_columns: Ph,P0,P1,P2,Nq,Cp,Kd

Return ONLY raw JSON (no markdown):
{
  "top_competitors": [
    { "domain": "", "relevance": 0, "organic_keywords": 0, "organic_traffic": 0 }
  ],
  "us_gaps": [
    { "keyword": "", "volume": 0, "cpc": "0.00", "kd": 0, "competitor1_pos": 0, "competitor2_pos": 0 }
  ],
  "uk_gaps": [
    { "keyword": "", "volume": 0, "cpc": "0.00", "kd": 0, "competitor1_pos": 0, "competitor2_pos": 0 }
  ]
}`, SEMRUSH, 6000);
  try { return JSON.parse(raw); } catch { console.warn("⚠️  competitor gaps parse fail"); return { top_competitors: [], us_gaps: [], uk_gaps: [] }; }
}

// ─── MODULE 5: New Keyword Opportunities ─────────────────────────────────────
async function fetchOpportunities() {
  console.log("🎯 [5/5] New keyword opportunities...");
  const raw = await callClaude(`
Use Semrush MCP phrase_related reports to find new keyword opportunities for "${DOMAIN}" — a Drupal/AWS/HubSpot digital services agency.

Run phrase_related for these seed terms in database "us", display_limit 20, display_sort "nq_desc", export_columns Ph,Nq,Cp,Co,Kd:
1. "drupal development agency"
2. "aws consulting services"
3. "hubspot implementation services"
4. "drupal migration services"

From all results combined, select the top 15 keywords where:
- Volume >= 100
- KD <= 35
- CPC >= $8

Return ONLY raw JSON (no markdown):
{
  "opportunities": [
    { "keyword": "", "volume": 0, "cpc": "0.00", "kd": 0, "seed_cluster": "", "priority": "high|medium|low" }
  ]
}

Set priority to:
- "high" if KD <= 15 AND volume >= 200
- "medium" if KD <= 25 OR volume >= 300
- "low" otherwise`, SEMRUSH, 6000);
  try { return JSON.parse(raw); } catch { console.warn("⚠️  opportunities parse fail"); return { opportunities: [] }; }
}

// ─── MODULE 6: AI Strategic Analysis ─────────────────────────────────────────
async function generateAnalysis(overview, usData, ukData, gaps, opps) {
  console.log("💡 Generating strategic analysis...");
  const raw = await callClaude(`
You are a senior SEO strategist reviewing daily audit data for axelerant.com — a Drupal/AWS/HubSpot digital services agency targeting US and UK enterprise clients.

DATA SNAPSHOT:
- US: ${overview?.us?.keywords} keywords, ~${overview?.us?.traffic} monthly visits, $${overview?.us?.traffic_value} traffic value
- UK: ${overview?.uk?.keywords} keywords, ~${overview?.uk?.traffic} monthly visits
- US Quick wins (pos 4-20): ${JSON.stringify((usData?.quick_wins || []).slice(0,10))}
- UK Quick wins (pos 4-20): ${JSON.stringify((ukData?.quick_wins || []).slice(0,10))}
- Top competitor gaps: ${JSON.stringify((gaps?.us_gaps || []).slice(0,10))}
- Top opportunities: ${JSON.stringify((opps?.opportunities || []).slice(0,8))}

Produce a sharp strategic analysis. Return ONLY raw JSON (no markdown):
{
  "summary": "2-3 sentence overall assessment of axelerant.com's current SEO position",
  "us_analysis": "2-3 sentences on US performance and key patterns",
  "uk_analysis": "2-3 sentences on UK performance — note that UK is significantly underdeveloped",
  "top_priority_actions": [
    { "action": "", "why": "", "expected_impact": "high|medium|low", "effort": "high|medium|low" }
  ],
  "quick_wins_today": [
    { "keyword": "", "current_pos": 0, "target_pos": 0, "volume": 0, "what_to_do": "" }
  ],
  "competitor_threats": [
    { "competitor": "", "threat": "" }
  ],
  "highlights": [
    "one-line insight 1",
    "one-line insight 2",
    "one-line insight 3",
    "one-line insight 4",
    "one-line insight 5"
  ]
}`, [], 3000);
  try { return JSON.parse(raw); } catch { console.warn("⚠️  analysis parse fail"); return {}; }
}

// ─── Format Slack Canvas (full detailed report) ───────────────────────────────
function buildCanvasContent(date, overview, usData, ukData, gaps, opps, analysis) {
  const fmt   = (n) => typeof n === "number" ? n.toLocaleString() : (n || "—");
  const usd   = (v) => v ? `$${v}` : "—";
  const pos   = (p) => p ? `#${p}` : "—";
  const emoji = (p) => p <= 3 ? "🟢" : p <= 10 ? "🟡" : "🔴";

  // Table builder
  const kwTable = (kws = [], limit = 15) => {
    if (!kws.length) return "_No data available_\n";
    const rows = kws.slice(0, limit).map(k =>
      `| ${emoji(k.position)} ${k.keyword} | ${pos(k.position)} | ${fmt(k.volume)} | ${usd(k.cpc)} | ${k.kd ?? "—"} |`
    ).join("\n");
    return `| Keyword | Pos | Volume | CPC | KD |\n|---|---|---|---|---|\n${rows}\n`;
  };

  const gapTable = (gaps = [], limit = 15) => {
    if (!gaps.length) return "_No gaps found_\n";
    const rows = gaps.slice(0, limit).map(g =>
      `| ${g.keyword} | ${fmt(g.volume)} | ${usd(g.cpc)} | ${g.kd ?? "—"} | ${pos(g.competitor1_pos)} / ${pos(g.competitor2_pos)} |`
    ).join("\n");
    return `| Keyword | Volume | CPC | KD | Comp. Positions |\n|---|---|---|---|---|\n${rows}\n`;
  };

  const oppTable = (opps = [], limit = 15) => {
    if (!opps.length) return "_No opportunities found_\n";
    const rows = opps.slice(0, limit).map(o =>
      `| ${o.priority === "high" ? "🔥" : o.priority === "medium" ? "✅" : "➡️"} ${o.keyword} | ${fmt(o.volume)} | ${usd(o.cpc)} | ${o.kd ?? "—"} | ${o.seed_cluster || "—"} |`
    ).join("\n");
    return `| Keyword | Volume | CPC | KD | Cluster |\n|---|---|---|---|---|\n${rows}\n`;
  };

  const priorityTable = (actions = []) => {
    if (!actions.length) return "_No actions generated_\n";
    return actions.map((a, i) =>
      `**${i+1}. ${a.action}**\n_Why:_ ${a.why}\n_Impact:_ ${a.expected_impact} | _Effort:_ ${a.effort}\n`
    ).join("\n");
  };

  const quickWinsList = (qw = []) => {
    if (!qw.length) return "_None identified_\n";
    return qw.map(q =>
      `- **${q.keyword}** — currently pos ${q.current_pos}, target pos ${q.target_pos} (${fmt(q.volume)} vol)\n  → ${q.what_to_do}`
    ).join("\n");
  };

  const us = overview?.us || {};
  const uk = overview?.uk || {};

  return `
# Axelerant SEO Audit — ${date}

${analysis?.summary || ""}

---

## 📊 Overall Performance

| Metric | 🇺🇸 United States | 🇬🇧 United Kingdom |
|---|---|---|
| Keywords Ranking | ${fmt(us.keywords)} | ${fmt(uk.keywords)} |
| Est. Monthly Traffic | ${fmt(us.traffic)} | ${fmt(uk.traffic)} |
| Traffic Value | $${fmt(us.traffic_value)} | $${fmt(uk.traffic_value)} |
| Paid Keywords | ${fmt(us.paid_keywords)} | ${fmt(uk.paid_keywords)} |

---

## 🇺🇸 US Rankings

${analysis?.us_analysis || ""}

### Top Keywords (by volume)

${kwTable(usData?.top_keywords, 15)}

### Quick Wins — Positions 4–20 (US)

These pages are already indexed. A focused on-page refresh + internal links could push them to top 3.

${kwTable(usData?.quick_wins, 15)}

---

## 🇬🇧 UK Rankings

${analysis?.uk_analysis || ""}

### Top Keywords (by volume)

${kwTable(ukData?.top_keywords, 15)}

### Quick Wins — Positions 4–20 (UK)

${kwTable(ukData?.quick_wins, 15)}

---

## 🏁 Competitor Keyword Gaps

Keywords that **${COMPETITORS[0]}** and **${COMPETITORS[1]}** rank for in the US — that axelerant.com does **not** currently rank for.

### US Gaps

${gapTable(gaps?.us_gaps, 15)}

### UK Gaps

${gapTable(gaps?.uk_gaps, 15)}

### Top Competitors by Relevance

${(gaps?.top_competitors || []).map(c =>
  `- **${c.domain}** — ${fmt(c.organic_keywords)} keywords, ~${fmt(c.organic_traffic)} monthly traffic`
).join("\n") || "_No data_"}

---

## 🎯 New Keyword Opportunities

Low KD + high CPC = strong commercial intent with room to rank.

🔥 High priority &nbsp;&nbsp; ✅ Medium priority &nbsp;&nbsp; ➡️ Lower priority

${oppTable(opps?.opportunities, 15)}

---

## 💡 Strategic Recommendations

### Priority Actions

${priorityTable(analysis?.top_priority_actions || [])}

### Act on These Today (Quick Wins)

${quickWinsList(analysis?.quick_wins_today || [])}

### Competitor Threats to Watch

${(analysis?.competitor_threats || []).map(t =>
  `- **${t.competitor}**: ${t.threat}`
).join("\n") || "_None identified_"}

---

## 🔑 Today's Key Highlights

${(analysis?.highlights || []).map(h => `- ${h}`).join("\n")}

---

_Generated by Axelerant SEO Audit Bot · Powered by Semrush + Claude · ${date}_
`.trim();
}

// ─── Format Slack channel summary card ───────────────────────────────────────
function buildSlackSummary(date, overview, usData, ukData, analysis, canvasUrl) {
  const fmt  = (n) => typeof n === "number" ? n.toLocaleString() : (n || "—");
  const us   = overview?.us || {};
  const uk   = overview?.uk || {};

  const topUSWin  = usData?.quick_wins?.[0];
  const topUKWin  = ukData?.quick_wins?.[0];
  const highlights = (analysis?.highlights || []).slice(0, 5).map(h => `  • ${h}`).join("\n");
  const topActions = (analysis?.top_priority_actions || []).slice(0, 3).map((a, i) =>
    `  ${i+1}. *${a.action}* _(${a.expected_impact} impact, ${a.effort} effort)_`
  ).join("\n");

  return `
*📊 Axelerant Daily SEO Audit — ${date}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🇺🇸 *US* — *${fmt(us.keywords)}* keywords · *${fmt(us.traffic)}* visits/mo · *$${fmt(us.traffic_value)}* value
🇬🇧 *UK* — *${fmt(uk.keywords)}* keywords · *${fmt(uk.traffic)}* visits/mo

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${topUSWin ? `\n🎯 *Top US quick win:* _${topUSWin.keyword}_ at pos *${topUSWin.position}* (${fmt(topUSWin.volume)} vol, $${topUSWin.cpc} CPC)\n` : ""}${topUKWin ? `🎯 *Top UK quick win:* _${topUKWin.keyword}_ at pos *${topUKWin.position}* (${fmt(topUKWin.volume)} vol)\n` : ""}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 *Highlights*
${highlights}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔺 *Top Priority Actions*
${topActions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 *Full detailed report →* ${canvasUrl || "_Canvas link unavailable_"}
`.trim();
}

// ─── Post Canvas + Summary to Slack ──────────────────────────────────────────
async function postToSlack(summaryMessage, canvasTitle, canvasContent) {
  console.log("📨 Creating Slack Canvas + posting summary...");

  const prompt = `
You are posting a daily SEO audit report to Slack. Do these two things in order using the Slack MCP tools:

STEP 1 — Create a Slack Canvas with:
  title: "${canvasTitle}"
  content: ${JSON.stringify(canvasContent)}

STEP 2 — Send a message to channel "${SLACK_CHANNEL_ID}" with this exact text (replace CANVAS_LINK with the actual URL from step 1):
${summaryMessage.replace("_Canvas link unavailable_", "CANVAS_LINK")}

Return the canvas URL at the end of your response in this format: CANVAS_URL: <url>
`;

  const result = await callClaude(prompt, SLACK, 2000);

  // Try to extract canvas URL from response
  const match = result.match(/CANVAS_URL:\s*(https?:\/\/\S+)/i);
  return match ? match[1] : null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const date = new Date().toISOString().split("T")[0];
  console.log(`\n🚀 Axelerant Full SEO Audit — ${date}\n`);

  try {
    // Run all modules — overview + rankings in parallel, then gaps + opps
    console.log("⏳ Running all audit modules...\n");

    const [overview, usData, ukData] = await Promise.all([
      fetchDomainOverview(),
      fetchUSRankings(),
      fetchUKRankings()
    ]);

    const [gaps, opps] = await Promise.all([
      fetchCompetitorGaps(),
      fetchOpportunities()
    ]);

    const analysis = await generateAnalysis(overview, usData, ukData, gaps, opps);

    // Build Canvas content (full detailed report)
    const canvasContent = buildCanvasContent(date, overview, usData, ukData, gaps, opps, analysis);
    const canvasTitle   = `Axelerant SEO Audit — ${date}`;

    // Build Slack summary card (links to Canvas)
    const summaryMessage = buildSlackSummary(date, overview, usData, ukData, analysis, null);

    // Post to Slack
    const canvasUrl = await postToSlack(summaryMessage, canvasTitle, canvasContent);
    console.log(`\n✅ Canvas created: ${canvasUrl || "URL not captured"}`);
    console.log(`✅ Summary posted to #wg-digital-bu-new-revenue`);
    console.log(`\n🎉 Full audit complete — ${date}\n`);

  } catch (err) {
    console.error("❌ Audit failed:", err.message);
    process.exit(1);
  }
}

main();
