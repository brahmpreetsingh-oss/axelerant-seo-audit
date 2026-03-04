# Axelerant Daily SEO Audit — Detailed (v3)

Runs every weekday at **9:00 AM IST**, posts to **#wg-digital-bu-new-revenue**.

## What gets posted each morning

### In the channel — Summary card
A compact digest with:
- US + UK keyword count, traffic, and traffic value
- Top quick win keyword for each region (highest-volume pos 4–20)
- 5 AI-generated highlights
- Top 3 priority actions for the day
- Link to the full Canvas report

### As a Slack Canvas — Full detailed report
A rich, scrollable document matching the depth of a manual Semrush audit:

| Section | Detail |
|---|---|
| 📊 Overall Performance | US + UK keywords, traffic, value, paid — side-by-side table |
| 🇺🇸 US Rankings | Top 15 keywords by volume + 15 quick wins (pos 4–20) with KD + CPC |
| 🇬🇧 UK Rankings | Same for UK |
| 🏁 Competitor Gaps | Up to 15 keywords appnovation/specbee rank for that axelerant.com doesn't — US + UK |
| 🎯 New Opportunities | Up to 15 low-KD + high-CPC keywords across Drupal/AWS/HubSpot clusters |
| 💡 Strategic Recommendations | Priority action table + quick-win to-do list + competitor threats |
| 🔑 Key Highlights | 5 sharp, data-backed insights |

---

## Setup — 5 minutes

### Step 1 — Create GitHub repo and push files
```bash
git clone https://github.com/YOUR_ORG/axelerant-seo-audit.git
cd axelerant-seo-audit
cp seo-audit.js .
mkdir -p .github/workflows
cp daily-seo-audit.yml .github/workflows/
git add . && git commit -m "Add detailed SEO audit v3" && git push
```

### Step 2 — Add API key as GitHub Secret
1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. Name: `ANTHROPIC_API_KEY`
4. Value: your key from https://console.anthropic.com
5. Save

### Step 3 — Test it
1. GitHub → **Actions** → **Axelerant Daily SEO Audit (Detailed)**
2. **Run workflow** → **Run workflow**
3. Takes ~5–8 minutes to complete
4. Check **#wg-digital-bu-new-revenue** for the summary + Canvas link

---

## Configuration

| Setting | Where | Default |
|---|---|---|
| Channel | `SLACK_CHANNEL_ID` in workflow | `C07B43GM812` (#wg-digital-bu-new-revenue) |
| Domain | `TARGET_DOMAIN` | `axelerant.com` |
| Schedule | `cron:` in workflow | `30 3 * * 1-5` (9 AM IST, Mon–Fri) |
| Competitors tracked | `COMPETITORS` array in `seo-audit.js` line 18 | appnovation, specbee, elevatedthird |
| Keyword clusters | Seed terms in `fetchOpportunities()` | drupal, aws, hubspot, migration |

### Run every day (including weekends)
Change `cron: "30 3 * * 1-5"` → `cron: "30 3 * * *"`

### Other time zones
```
"30 3  * * *"  →  9:00 AM IST  ✅
"0  8  * * *"  →  8:00 AM GMT
"0  14 * * *"  →  9:00 AM EST
"0  1  * * *"  →  6:30 AM IST
```

---

## What it looks like in Slack

**Channel card:**
```
📊 Axelerant Daily SEO Audit — 2026-03-06
🇺🇸 US — 2,456 keywords · 1,231 visits/mo · $15,111 value
🇬🇧 UK — 190 keywords · 30 visits/mo

🎯 Top US quick win: drupal development agency at pos 12 (590 vol, $72 CPC)
🎯 Top UK quick win: drupal development company at pos 24 (260 vol, $20 CPC)

💡 Highlights
  • /drupal-development-services ranks for 6 high-value terms between pos 10–20 — refresh needed
  • UK traffic critically low — zero geo-targeted landing pages
  • appnovation ranks for "cloud migration services" (6,600 vol) — axelerant.com has zero presence
  • "drupal consulting" (KD 26, $33 CPC) — unranked despite direct expertise match
  • "accessibility testing services" slipped from pos 10 → 12 — internal link opportunity

🔺 Top Priority Actions
  1. Refresh /drupal-development-services (high impact, low effort)
  2. Create UK-specific Drupal agency landing page (high impact, medium effort)
  3. Publish AWS consulting service page (high impact, medium effort)

📄 Full detailed report → https://axelerant.slack.com/canvas/...
```

---

## Estimated cost

~6–8 Claude API calls per run at ~$0.02–0.05 each = **~$0.15–0.30/day**, ~**$3–6/month**.
