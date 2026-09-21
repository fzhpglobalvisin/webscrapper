// services/aiContextBuilder.ts — Pure Dynamic AI Context Builder
// Translates the user's REAL dataset schema, columns, metrics, and records into rich context for Gemini.
// Strictly enforces zero mock column names.

import { BIEngineOutput, DashboardState, DatasetInfo, SalesRecord, ScrapedWebContext } from '../types';

export function buildAIContext(
  engine: BIEngineOutput, 
  dashboardState: DashboardState, 
  datasetInfo?: DatasetInfo,
  rawData?: SalesRecord[],
  webContextOverride?: ScrapedWebContext
): string {
  const { kpis, trends, rankings, risk, distributors } = engine;
  const filters = dashboardState.filter;
  const webContext = webContextOverride || dashboardState.webContext;
  const sections: string[] = [];

  const data = rawData || [];
  const schema = datasetInfo?.schema;
  const columns = schema?.columns || (data.length > 0 ? Object.keys(data[0]) : []);
  const numericColumns = schema?.numericColumns || [];
  const categoricalColumns = schema?.categoricalColumns || [];
  const dateColumns = schema?.dateColumns || [];

  // ─── Dual Source Master Header ──────────────────────────────────────
  if (webContext && webContext.status === 'active') {
    sections.push(`=======================================================
[DUAL-SOURCE KNOWLEDGE BASE: EXCEL LEDGER + LIVE WEB CONTEXT]
The user has connected BOTH an internal ERP/Excel dataset and a live website target.
You must ground your reasoning, pricing audits, catalog matches, and sales strategies in BOTH sources simultaneously.
=======================================================`);
  }

  // ─── Real Schema Header ───────────────────────────────────────────
  sections.push(`[SOURCE 1: INTERNAL EXCEL / ERP / CRM DATASET]
Dataset Name: ${datasetInfo?.name || 'User Uploaded Dataset'}
Total Records: ${data.length.toLocaleString()}
All Column Names: [${columns.join(', ')}]
Numeric Measure Columns: [${numericColumns.join(', ')}]
Categorical Dimension Columns: [${categoricalColumns.join(', ')}]
Date Columns: [${dateColumns.join(', ')}]`);

  // ─── Relational Data Model & Multi-Sheet Graph ───────────────────
  if (datasetInfo?.dataModel) {
    const model = datasetInfo.dataModel;
    const sheetSummaries = Object.values(model.sheets).map(s => {
      const pkDesc = s.primaryKey ? `[PK: ${s.primaryKey}]` : '[No explicit PK]';
      return `  * Entity/Sheet "${s.name}": ${s.rowCount.toLocaleString()} rows | ${s.columns.length} columns ${pkDesc} | Measures: [${s.numericColumns.join(', ')}] | Dimensions: [${s.categoricalColumns.slice(0, 5).join(', ')}]`;
    });

    const relSummaries = model.relationships.length > 0 
      ? model.relationships.map(r => `  * ${r.fromSheet}.${r.fromColumn} (PK) ──[${r.cardinality}]──> ${r.toSheet}.${r.toColumn} (FK) [Confidence: ${(r.confidence * 100).toFixed(0)}%]`)
      : ['  * Single table / no foreign keys detected across sheets.'];

    sections.push(`[RELATIONAL DATA MODEL & MULTI-SHEET ER GRAPH]
- Worksheets Processed: ${model.sheetOrder.length} (${model.sheetOrder.join(', ')})
- Primary Fact Sheet: "${model.primaryFactSheet || 'Default'}"
- Total Rows Across Model: ${model.totalRowsAcrossSheets.toLocaleString()}
- Currency Stripping: ${model.totalCurrencyFieldsStripped.toLocaleString()} numeric values sanitized to raw floats
- Entities / Tables:
${sheetSummaries.join('\n')}
- Entity Relationships (PK <-> FK Joins):
${relSummaries.join('\n')}
Ground your analytical insights, cross-sheet comparisons, and root-cause explanations across these relational joins.`);
  }

  // ─── Real Column Metrics ──────────────────────────────────────────
  if (numericColumns.length > 0 && data.length > 0) {
    const metricSummaries = numericColumns.slice(0, 8).map(col => {
      const nums = data.map(r => Number(r[col]) || 0);
      const total = nums.reduce((a, b) => a + b, 0);
      const avg = total / nums.length;
      const max = Math.max(...nums);
      const min = Math.min(...nums);
      return `- Column "${col}": Total = ${Math.round(total).toLocaleString()} | Avg = ${Math.round(avg).toLocaleString()} | Min = ${Math.round(min).toLocaleString()} | Max = ${Math.round(max).toLocaleString()}`;
    });
    sections.push(`REAL NUMERIC MEASURES SUMMARY:\n${metricSummaries.join('\n')}`);
  }

  // ─── Real Dimension Breakdowns ────────────────────────────────────
  if (categoricalColumns.length > 0 && data.length > 0) {
    const primaryMetric = numericColumns[0];
    const dimSummaries = categoricalColumns.slice(0, 5).map(col => {
      const map = new Map<string, number>();
      data.forEach(r => {
        const val = String(r[col] || 'Unassigned');
        const metricVal = primaryMetric ? (Number(r[primaryMetric]) || 0) : 1;
        map.set(val, (map.get(val) || 0) + metricVal);
      });
      const topItems = Array.from(map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, v]) => primaryMetric ? `${k} (${primaryMetric}: ${Math.round(v).toLocaleString()})` : `${k} (${v} records)`)
        .join(', ');
      return `- Dimension "${col}" Top Values: ${topItems}`;
    });
    sections.push(`REAL CATEGORICAL DIMENSIONS BREAKDOWN:\n${dimSummaries.join('\n')}`);
  }

  // ─── Active Filters & State ───────────────────────────────────────
  const activeFilters = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k} = "${v}"`);

  if (activeFilters.length > 0) {
    sections.push(`ACTIVE USER FILTERS: ${activeFilters.join(', ')}. All figures reflect this filtered segment.`);
  }

  if (dashboardState.customChart) {
    sections.push(`CURRENT CUSTOM CHART CONFIGURATION:
- X-Axis Dimension: "${dashboardState.customChart.dimension || 'None'}"
- Y-Axis Measure: "${dashboardState.customChart.measure || 'None'}"
- Chart Type: "${dashboardState.customChart.chartType || 'bar'}"
- Last Command: "${dashboardState.customChart.lastCommand || 'Manual'}"`);
  }

  // ─── Engine Aggregations (Only if relevant) ───────────────────────
  if (kpis.totalRevenue > 0) {
    sections.push(`CALCULATED PERFORMANCE TOTALS:
- Total Primary Measure: ${fmt(kpis.totalRevenue)}
- Total Secondary Measure: ${fmt(kpis.totalCost)}
- Net Profit / Margin: ${fmt(kpis.grossProfit)} (${kpis.grossMargin.toFixed(1)}%)
- Total Count / Volume: ${fmt(kpis.totalQuantity)}`);
  }

  if (trends.monthly.length > 1) {
    const recent = trends.monthly.slice(-6);
    const trendStr = recent.map(m => `${m.period}: ${fmt(m.revenue)}`).join(' | ');
    sections.push(`TIME SERIES TRENDS: ${trendStr}`);
  }

  // ─── Live Scraped Web Context (Source 2) ─────────────────────────
  if (webContext && webContext.status === 'active') {
    const webDetails: string[] = [
      `[SOURCE 2: LIVE SCRAPED WEBSITE CONTEXT (${webContext.url})]`,
      `Target URL: ${webContext.finalUrl || webContext.url}`,
      `Page Title: "${webContext.title}"`,
      `Meta Description: "${webContext.metaDescription || 'N/A'}"`,
      `Scraped At: ${webContext.scrapedAt || 'Recent'}`,
      `DOM Overview: ${webContext.domSummary || 'Structured HTML DOM'}`
    ];

    if (webContext.headings && webContext.headings.length > 0) {
      webDetails.push(`Key Headings / Page Structure:\n${webContext.headings.slice(0, 15).map(h => `${'#'.repeat(h.level)} ${h.text}`).join('\n')}`);
    }

    if (webContext.pricingSignals && webContext.pricingSignals.length > 0) {
      webDetails.push(`Extracted Pricing / Terms Signals:\n${webContext.pricingSignals.map(p => `• ${p}`).join('\n')}`);
    }

    if (webContext.keyFacts && webContext.keyFacts.length > 0) {
      webDetails.push(`Extracted Web Highlights & Features:\n${webContext.keyFacts.slice(0, 8).map(f => `• ${f}`).join('\n')}`);
    }

    if (webContext.tables && webContext.tables.length > 0) {
      const tableSummaries = webContext.tables.slice(0, 2).map((tbl, i) => {
        const headerRow = tbl.headers.length > 0 ? `Headers: [${tbl.headers.join(' | ')}]` : '';
        const dataRows = tbl.rows.slice(0, 4).map(r => r.join(' | ')).join('\n');
        return `Web Table ${i + 1}:\n${headerRow}\n${dataRows}`;
      }).join('\n\n');
      webDetails.push(`Extracted Web Tables:\n${tableSummaries}`);
    }

    if (webContext.sanitizedText) {
      webDetails.push(`Sanitized Page Text (RAG Context Sample):\n${webContext.sanitizedText.slice(0, 3000)}`);
    }

    sections.push(webDetails.join('\n\n'));

    // ─── Dual-Source Grounding Directive ─────────────────────────────
    sections.push(`=======================================================
DUAL-SOURCE GROUNDING & B2C REAL ESTATE DIRECTIVE:
1. B2C CONVERSION & SALES INTENT:
   - Primary Focus: Customer conversion, pricing transparency, flexible payment plans, real-time unit availability, and unit specifications.
   - Grounding: Treat the multi-sheet relational data model (Units, Payment Plans, Developments, Inquiries) and target website content as the default grounded Knowledge Base.
   - Dynamic Consumer FAQs: Proactively synthesize consumer-facing answers and FAQs regarding unit specs (sq ft, bedrooms, views), pricing tiers, deposit schedules, post-handover terms, and lifestyle amenities.
2. EXCLUDE BACK-OFFICE AUDIT & NOISE:
   - Explicitly IGNORE and EXCLUDE audit logs, governance memos, accounting journal compliance checks, distributor debt litigation, or regulatory enforcement from customer-facing advisory.
   - Focus 100% on buyer enablement, investment ROI (e.g. 10-Year UAE Golden Visa, projected rental yield), and closing transactions.
3. ATTRIBUTION TAGS:
   - Use clear tags: [Live Web] for official developer portal data and [Property Model] for internal unit inventory and payment plans.
=======================================================`);
  }

  // ─── CRITICAL CONSTRAINT FOR AI ADVISOR ───────────────────────────
  sections.push(`CRITICAL ANTI-HALLUCINATION & B2C CONVERSION INSTRUCTIONS:
1. You MUST reference the actual property and data columns present in this model: [${columns.join(', ')}].
2. Prioritize customer conversion, transparent pricing, flexible payment schedules, and verified unit availability.
3. Exclude internal audit, compliance, and back-office governance logs from consumer advice.
4. Formulate verbal guidance and answers dynamically matching consumer questions.`);

  return sections.join('\n\n');
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}
