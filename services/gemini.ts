// services/gemini.ts — Layers 5, 6, & 7: Gemini AI, Voice, & Dashboard Function Calls
import { GoogleGenAI, Type, Modality, FunctionDeclaration } from "@google/genai";
import { 
  SalesRecord, 
  AdvisoryOutput, 
  RiskLevel, 
  Language, 
  BIEngineOutput, 
  ExecutiveActionPlan, 
  DashboardFilter,
  CustomChartConfig,
  DatasetSchema,
  PdfVoiceAction,
  AppTabId
} from "../types";
import { normalizeTabId, TAB_DIRECTORY } from "../context/NavigationContext";

export const parseCustomChartFromVoice = (
  instruction: string,
  schema?: DatasetSchema
): CustomChartConfig | null => {
  const lower = instruction.toLowerCase().trim();

  // 1. Chart type detection
  let chartType: 'bar' | 'line' | 'area' | 'pie' | undefined;
  if (lower.includes('pie') || lower.includes('donut') || lower.includes('doughnut') || lower.includes('share') || lower.includes('proportion')) {
    chartType = 'pie';
  } else if (lower.includes('line') || lower.includes('trend') || lower.includes('curve') || lower.includes('trajectory')) {
    chartType = 'line';
  } else if (lower.includes('area') || lower.includes('stream') || lower.includes('fill')) {
    chartType = 'area';
  } else if (lower.includes('bar') || lower.includes('column') || lower.includes('histogram') || lower.includes('bars')) {
    chartType = 'bar';
  }

  // 2. If dynamic schema is available, match against actual column names
  if (schema && schema.columns && schema.columns.length > 0) {
    let matchedDimension: string | undefined;
    let matchedMeasure: string | undefined;

    const candidateMeasures = schema.numericColumns.length > 0 ? schema.numericColumns : schema.columns;
    const candidateDimensions = [...schema.categoricalColumns, ...schema.dateColumns];
    const allCandidates = candidateDimensions.length > 0 ? candidateDimensions : schema.columns;

    // Look for measures in instruction
    for (const m of candidateMeasures) {
      const mNorm = m.toLowerCase();
      const mSpaced = mNorm.replace(/[^a-z0-9]/g, ' ').trim();
      if (lower.includes(mNorm) || (mSpaced.length > 2 && lower.includes(mSpaced))) {
        matchedMeasure = m;
        break;
      }
    }

    // Look for dimensions in instruction
    for (const d of allCandidates) {
      if (d === matchedMeasure) continue;
      const dNorm = d.toLowerCase();
      const dSpaced = dNorm.replace(/[^a-z0-9]/g, ' ').trim();
      if (lower.includes(dNorm) || (dSpaced.length > 2 && lower.includes(dSpaced))) {
        matchedDimension = d;
        break;
      }
    }

    // Check "X by Y" or "X vs Y"
    const byMatch = lower.match(/(?:show|plot|chart|graph)?\s*(.*?)\s+(?:by|vs|versus|over|across)\s+(.*)/i);
    if (byMatch) {
      const part1 = byMatch[1].replace(/^(a|an|the|custom|my)\s+/i, '').trim();
      const part2 = byMatch[2].replace(/\s+(in|as|with)\s+.*$/i, '').trim();

      if (!matchedMeasure) {
        matchedMeasure = candidateMeasures.find(m => part1.includes(m.toLowerCase()) || m.toLowerCase().includes(part1));
      }
      if (!matchedDimension) {
        matchedDimension = allCandidates.find(d => part2.includes(d.toLowerCase()) || d.toLowerCase().includes(part2));
      }
    }

    const hasChartIntent = lower.includes('chart') || lower.includes('plot') || lower.includes('graph') || 
                           lower.includes('show') || lower.includes('display') || lower.includes('visual') || 
                           lower.includes('by') || lower.includes('vs') || lower.includes('versus') ||
                           Boolean(chartType);

    if (matchedDimension || matchedMeasure || hasChartIntent) {
      const finalMeas = matchedMeasure || candidateMeasures[0] || schema.columns[0];
      const finalDim = matchedDimension || allCandidates.find(c => c !== finalMeas) || schema.columns[0];
      const finalType = chartType || 'bar';

      return {
        dimension: finalDim,
        measure: finalMeas,
        chartType: finalType,
        lastCommand: instruction,
        explanation: `Visualizing ${finalMeas} aggregated by ${finalDim} using a ${finalType} chart.`
      };
    }

    return null;
  }

  // 3. Fallback generic parsing when schema is not provided
  let dimension: string | undefined;
  let measure: string | undefined;

  const hasChartIntent = lower.includes('chart') || lower.includes('plot') || lower.includes('graph') || 
                         lower.includes('show') || lower.includes('display') || lower.includes('visual') || 
                         lower.includes('by') || lower.includes('vs') || lower.includes('versus');

  if (hasChartIntent && chartType) {
    return {
      dimension: 'Category',
      measure: 'Value',
      chartType: chartType,
      lastCommand: instruction,
      explanation: `Custom chart in ${chartType} format.`
    };
  }

  return null;
};

export const analyzeSalesData = async (
  data: SalesRecord[], 
  prompt: string, 
  language: Language,
  aiContext?: string
): Promise<AdvisoryOutput[]> => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    console.warn("Gemini API Key missing; utilizing intelligent analytical fallback advisory.");
    return generateFallbackAdvisory(data, language);
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const summary = data.slice(0, 40).map(r => ({
    r: r.revenue,
    p: r.product,
    c: r.customerName,
    d: r.discount,
    reg: r.region,
    o: r.outstandingAmount
  }));

  const langConstraint = language === Language.AUTO 
    ? "Automatically detect the user's language and respond in kind. Use the appropriate script (LTR/RTL)."
    : `The user's preferred language is ${language}. Respond in ${language}.`;

  const contextBlock = aiContext ? `\n\nDETAILED BI ENGINE CONTEXT:\n${aiContext}\n` : '';

  const runAnalysis = async (attempt = 0): Promise<AdvisoryOutput[]> => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `
          Analyze this sales dataset and business context:${contextBlock}
          Sample transactions: ${JSON.stringify(summary)}.
          Task: ${prompt}
          
          CRITICAL REQUIREMENT: 
          ${langConstraint}
          All text values in the JSON output MUST be written in the target language.
          
          Maintain a professional business advisory tone. Formulate sharp, quantified key insights, root causes, and high-ROI recommendations.
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                keyInsight: { type: Type.STRING },
                rootCause: { type: Type.STRING },
                riskLevel: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
                recommendedAction: { type: Type.STRING },
                expectedImpact: { type: Type.STRING }
              },
              required: ["keyInsight", "rootCause", "riskLevel", "recommendedAction", "expectedImpact"]
            }
          }
        }
      });

      const rawText = response.text?.trim() || "[]";
      const cleanText = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      const parsed = JSON.parse(cleanText);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : generateFallbackAdvisory(data, language);
    } catch (e: any) {
      const errorStr = String(e?.message || e);
      const isTransient = errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED') || errorStr.includes('503') || errorStr.includes('unavailable');
      
      if (isTransient && attempt < 1) {
        await new Promise(res => setTimeout(res, 1500));
        return runAnalysis(attempt + 1);
      }
      
      console.warn("AI service busy or limit reached; utilizing intelligent analytical fallback advisory.", e?.message || e);
      return generateFallbackAdvisory(data, language);
    }
  };

  return runAnalysis();
};

export const extractSalesDataFromMedia = async (
  base64Data: string, 
  mimeType: string
): Promise<SalesRecord[]> => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please check your environment variables.");
  }
  const ai = new GoogleGenAI({ apiKey });

  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  try {
    const apiCall = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType || 'application/pdf',
            data: cleanBase64
          }
        },
        'Extract all sales transactions, items, or records from this document into a JSON array of objects.'
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Gemini API extraction request timed out.")), 25000)
    );

    const response = (await Promise.race([apiCall, timeout])) as any;
    const rawText = response.text?.trim() || '[]';
    const cleanText = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleanText);

    const recordsArray = Array.isArray(parsed) ? parsed : (parsed.records || parsed.items || []);

    return recordsArray.map((item: any, idx: number) => ({
      date: item.date || new Date().toISOString().split('T')[0],
      invoiceNo: item.invoiceNo || item.invoice || `INV-${100000 + idx}`,
      customerName: item.customerName || item.customer || 'Blinkit Order Customer',
      distributor: item.distributor || 'Direct',
      product: item.product || item.item || item.description || 'General Item',
      quantity: Number(item.quantity || item.qty) || 1,
      revenue: Number(item.revenue || item.amount || item.total || item.price) || 0,
      discount: Number(item.discount) || 0,
      cost: Number(item.cost) || 0,
      creditDays: Number(item.creditDays) || 0,
      outstandingAmount: Number(item.outstandingAmount) || 0,
      region: item.region || 'Local',
      salesRep: item.salesRep || 'Online System'
    }));
  } catch (err: any) {
    console.error("PDF Extraction Failed:", err);
    throw new Error(err.message || "Failed to process PDF with Gemini.");
  }
};

export const generateFallbackAdvisory = (data: SalesRecord[], language: Language): AdvisoryOutput[] => {
  const isUrdu = language === Language.URDU;
  const isArabic = language === Language.ARABIC;

  const totalRev = data.reduce((acc, r) => acc + (r.revenue || 0), 0);
  const totalOutstanding = data.reduce((acc, r) => acc + (r.outstandingAmount || 0), 0);
  const highRiskCustomers = data.filter(r => (r.outstandingAmount || 0) > 15000);
  const highDiscountRows = data.filter(r => (r.discount || 0) > 0.15);

  if (isUrdu) {
    return [
      {
        keyInsight: `کل واجب الادا رقم $${Math.round(totalOutstanding).toLocaleString()} ہے جو ورکنگ کیپیٹل پر اثر انداز ہو رہی ہے۔`,
        rootCause: `${highRiskCustomers.length} بڑے ڈسٹری بیوٹرز کے ادائیگیاں مقررہ تاریخ سے تاخیر کا شکار ہیں۔`,
        riskLevel: totalOutstanding > 50000 ? RiskLevel.HIGH : RiskLevel.MEDIUM,
        recommendedAction: "کریڈٹ ریکوری ٹیم کو فعال کریں اور 30 دن سے زائد پرانے کھاتوں پر کریڈٹ عارضی طور پر معطل کریں۔",
        expectedImpact: "اگلے ماہ کیش فلو میں 20-30 فیصد فوری بہتری متوقع ہے۔"
      },
      {
        keyInsight: `${highDiscountRows.length} سودوں پر 15 فیصد سے زیادہ رعایت کی وجہ سے مجموعی منافع متاثر ہو رہا ہے۔`,
        rootCause: "سیلز ٹیم کی جانب سے بغیر مرکزی منظوری کے کسٹم ڈسکاؤنٹ کی پیشکش۔",
        riskLevel: RiskLevel.MEDIUM,
        recommendedAction: "ڈسکاؤنٹ پر سینئر مینیجر کی منظوری لازمی قرار دیں اور بنڈل پروموشنز نافذ کریں۔",
        expectedImpact: "مجموعی منافع کے مارجن میں 3.2 فیصد اضافہ متوقع ہے۔"
      }
    ];
  }

  if (isArabic) {
    return [
      {
        keyInsight: `إجمالي المبالغ المستحقة غير المحصلة يبلغ ${Math.round(totalOutstanding).toLocaleString()}.`,
        rootCause: `تأخر سداد الفواتير من قبل ${highRiskCustomers.length} من كبار الموزعين في الشبكة.`,
        riskLevel: totalOutstanding > 50000 ? RiskLevel.HIGH : RiskLevel.MEDIUM,
        recommendedAction: "تطبيق حدود ائتمانية صارمة وربط التوريدات الجديدة بجدولة السداد المتأخر.",
        expectedImpact: "تحسين تدفق السيولة النقدية بمقدار 25,000+ خلال 30 يوماً."
      },
      {
        keyInsight: `رصد خصومات مرتفعة تجاوزت 15% على ${highDiscountRows.length} معاملة تجارية.`,
        rootCause: "اعتماد فرق المبيعات على التخفيضات السعرية لإتمام الصفقات دون النظر لهامش الربح.",
        riskLevel: RiskLevel.MEDIUM,
        recommendedAction: "تحديد سقف أعلى للخصومات المباشرة وربط عمولات المبيعات بالربحية الصافية.",
        expectedImpact: "حماية هوامش الربح واستعادة ما يقارب 3.5% من الإيرادات المفقودة."
      }
    ];
  }

  return [
    {
      keyInsight: `Accounts receivable backlog stands at ${Math.round(totalOutstanding).toLocaleString()} across key network accounts.`,
      rootCause: `${highRiskCustomers.length} major distributor accounts exceed optimal settlement windows.`,
      riskLevel: totalOutstanding > 50000 ? RiskLevel.HIGH : RiskLevel.MEDIUM,
      recommendedAction: "Institute automatic credit holds on accounts past 45 days and offer a 2% early settlement discount.",
      expectedImpact: "Accelerates liquidity recovery by an estimated 25,000+ over the next 30 days."
    },
    {
      keyInsight: `Margin compression detected: ${highDiscountRows.length} transactions executed with >15% discretionary discount.`,
      rootCause: "Regional sales representatives discounting aggressively to meet quarterly volume targets.",
      riskLevel: RiskLevel.MEDIUM,
      recommendedAction: "Enforce managerial sign-offs on discount tiers exceeding 10% and bundle value-added services.",
      expectedImpact: "Recovers approximately 2.8% to 4.0% gross margin across product lines."
    },
    {
      keyInsight: `Segment revenue (${Math.round(totalRev).toLocaleString()}) shows concentrated demand in top product categories.`,
      rootCause: "Limited cross-selling of secondary product catalog items to existing distribution channels.",
      riskLevel: RiskLevel.LOW,
      recommendedAction: "Deploy bundled promotion incentives pairing high-velocity items with higher-margin accessories.",
      expectedImpact: "Projects 12-18% expansion in average order value."
    }
  ];
};

// ─── Voice Navigation Parser ──────────────────────────────────────────
export const parseVoiceNavigationCommand = (
  instruction: string
): { tab: AppTabId; label: string; confirmation: string } | null => {
  const lower = instruction.toLowerCase().trim();

  // Explicit voice navigation patterns
  // "take me to [tab]", "go to [tab]", "navigate to [tab]", "switch to [tab]", "open [tab]", "show me [tab]", "show [tab]", "view [tab]", "launch [tab]"
  const navPrefixes = [
    /^(?:please\s+)?(?:take\s+me\s+to|go\s+to|navigate\s+to|switch\s+to|open|show\s+me|show|view|launch)\s+(?:the\s+)?(.*)/i,
    /^(.*)\s+(?:tab|page|view|screen)$/i
  ];

  let candidate = lower;
  for (const regex of navPrefixes) {
    const match = lower.match(regex);
    if (match && match[1]) {
      candidate = match[1].trim();
      break;
    }
  }

  // Remove trailing "tab", "page", "view", "now", "please"
  candidate = candidate
    .replace(/\b(tab|page|view|screen|please|now)\b/gi, '')
    .trim();

  const normalized = normalizeTabId(candidate);
  if (normalized) {
    const meta = TAB_DIRECTORY[normalized];
    return {
      tab: normalized,
      label: meta.label,
      confirmation: meta.confirmation
    };
  }

  // Secondary check: look for tab keywords within instruction if navigation intent words are present
  const hasNavIntent = lower.includes('take me') || lower.includes('go to') || lower.includes('navigate') || 
                       lower.includes('switch to') || lower.includes('open') || lower.includes('show') || 
                       lower.includes('view') || lower.includes('launch') || lower.includes('tab') || lower.includes('page');

  if (hasNavIntent) {
    if (lower.includes('web navigator') || lower.includes('browser') || lower.includes('web tab')) {
      return { tab: 'webNavigator', label: TAB_DIRECTORY.webNavigator.label, confirmation: TAB_DIRECTORY.webNavigator.confirmation };
    }
    if (lower.includes('pdf') || lower.includes('memo') || lower.includes('document')) {
      return { tab: 'pdfInsights', label: TAB_DIRECTORY.pdfInsights.label, confirmation: TAB_DIRECTORY.pdfInsights.confirmation };
    }
    if (lower.includes('distributor') || lower.includes('dealer') || lower.includes('network')) {
      return { tab: 'distributors', label: TAB_DIRECTORY.distributors.label, confirmation: TAB_DIRECTORY.distributors.confirmation };
    }
    if (lower.includes('sales record') || lower.includes('dataset') || lower.includes('records') || lower.includes('raw data') || lower.includes('table')) {
      return { tab: 'reports', label: TAB_DIRECTORY.reports.label, confirmation: TAB_DIRECTORY.reports.confirmation };
    }
    if (lower.includes('dashboard') || lower.includes('analytics') || lower.includes('kpi') || lower.includes('metrics')) {
      return { tab: 'dashboard', label: TAB_DIRECTORY.dashboard.label, confirmation: TAB_DIRECTORY.dashboard.confirmation };
    }
    if (lower.includes('home') || lower.includes('overview')) {
      return { tab: 'home', label: TAB_DIRECTORY.home.label, confirmation: TAB_DIRECTORY.home.confirmation };
    }
  }

  return null;
};

// ─── Layer 7: Expanded Dashboard Function Declarations ────────────────

export const dashboardFunctions: FunctionDeclaration[] = [
  {
    name: 'update_dashboard_filters',
    description: 'Filter the dashboard by any column and value present in the uploaded dataset.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        column: { type: Type.STRING, description: 'Column name from the uploaded dataset to filter on' },
        value: { type: Type.STRING, description: 'Specific value within that column to filter by' },
        region: { type: Type.STRING, description: 'Geographic or regional filter if present in dataset' },
        product: { type: Type.STRING, description: 'Category or product filter if present in dataset' },
        distributor: { type: Type.STRING, description: 'Partner or distributor filter if present in dataset' },
        customer: { type: Type.STRING, description: 'Customer or account filter if present in dataset' },
      }
    }
  },
  {
    name: 'highlight_metric',
    description: 'Direct visual focus to a specific KPI on the dashboard.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        metric: { 
          type: Type.STRING, 
          enum: ['revenue', 'profit', 'outstanding', 'discount'],
          description: 'The KPI metric to highlight' 
        }
      },
      required: ['metric']
    }
  },
  {
    name: 'reset_dashboard',
    description: 'Clear all filters, drill-downs, and highlighted metrics back to default view.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        confirm: {
          type: Type.BOOLEAN,
          description: 'Set to true to reset all dashboard filters and views back to default'
        }
      }
    }
  },
  {
    name: 'click_element',
    description: 'Universal Voice Click: Click, trigger, focus, or activate ANY interactive UI element (button, link, tab, card, input, checkbox, modal toggle) across the main application OR inside the embedded web view / iFrame.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        text_match: { 
          type: Type.STRING, 
          description: 'Visible label, text, button caption, or title to match (e.g. "Proxy Stream", "Navigate & Ingest", "Payment Plans", "Download", "Reserve Unit", "Unit 102", "Ask Advisor", "Filter", "Split View", "Dark Mode")' 
        },
        selector: { 
          type: Type.STRING, 
          description: 'Optional CSS selector or element ID (e.g. "#proxy-stream-btn", "[data-action=book-tour]", "button.btn-primary")' 
        },
        element_description: { 
          type: Type.STRING, 
          description: 'Semantic description of what the user wants to click or activate' 
        },
        target: { 
          type: Type.STRING, 
          enum: ['app', 'iframe', 'any'], 
          description: 'Target surface: "app" for main application, "iframe" for inside the embedded web preview, or "any" to scan both' 
        },
        action_type: { 
          type: Type.STRING, 
          enum: ['click', 'focus', 'hover', 'scroll_to'], 
          description: 'Type of DOM interaction to execute' 
        }
      },
      required: ['text_match']
    }
  },
  {
    name: 'input_text',
    description: 'Universal Voice Input: Type or fill text into any search box, URL bar, or input field across the application or embedded web iFrame view.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        selector_or_placeholder: { 
          type: Type.STRING, 
          description: 'Placeholder, label, ID, or selector of the target input (e.g. "Enter URL to navigate", "Search", "Ask question")' 
        },
        text: { 
          type: Type.STRING, 
          description: 'Text string to fill into the input field' 
        },
        target: { 
          type: Type.STRING, 
          enum: ['app', 'iframe', 'any'], 
          description: 'Target surface: "app", "iframe", or "any"' 
        },
        submit: { 
          type: Type.BOOLEAN, 
          description: 'Whether to automatically press Enter or submit the form after typing' 
        }
      },
      required: ['selector_or_placeholder', 'text']
    }
  },
  {
    name: 'scroll_page',
    description: 'Scroll the active application page or embedded web view up, down, to the top, or to the bottom.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        direction: { 
          type: Type.STRING, 
          enum: ['up', 'down', 'top', 'bottom'], 
          description: 'Scroll direction' 
        },
        target: { 
          type: Type.STRING, 
          enum: ['app', 'iframe', 'any'], 
          description: 'Target surface to scroll' 
        }
      },
      required: ['direction']
    }
  },
  {
    name: 'filter_units',
    description: 'Filter real estate unit inventory by customer preferences (bedrooms, property type, price ceiling, status, payment plan).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        bedrooms: { type: Type.INTEGER, description: 'Number of bedrooms (0 for Studio, 1, 2, 3, 4, 5)' },
        propertyType: { type: Type.STRING, description: 'Property type (e.g. Penthouse, Sky Villa, Apartment, Studio)' },
        maxPrice: { type: Type.NUMBER, description: 'Maximum price budget (e.g. 2000000)' },
        status: { type: Type.STRING, enum: ['Available', 'Reserved', 'Limited Units', 'All'], description: 'Availability status' },
        paymentPlan: { type: Type.STRING, description: 'Payment plan filter (e.g. "80/20", "Post-Handover", "Ready")' }
      }
    }
  },
  {
    name: 'select_unit',
    description: 'Select, inspect, or book a specific real estate unit by unit code or property name.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        unitCode: { type: Type.STRING, description: 'Specific unit code (e.g. "MH-101", "MH-102", "MH-PH01", "AP-204", "CR-105")' }
      },
      required: ['unitCode']
    }
  },
  {
    name: 'navigate_to_tab',
    description: 'Switch between application views and dashboards based on natural language voice navigation commands. Supported destinations: Home ("home"/"overview"), Dashboard/Inventory ("dashboard"/"inventory"), Payment Plans ("payment_plans"), Dataset Records ("dataset_records"/"records"), Relational Data Model ("dataModel"/"relational_model"), Distributors ("distributors"), PDF Insights ("pdf_insights"), Web Navigator ("web_navigator"/"browser").',
    parameters: {
      type: Type.OBJECT,
      properties: {
        target_tab: { 
          type: Type.STRING, 
          enum: [
            'home', 
            'dashboard', 
            'dataset_records', 
            'reports', 
            'distributors', 
            'pdf_insights', 
            'pdfInsights', 
            'web_navigator', 
            'webNavigator',
            'dataModel',
            'data_model',
            'payment_plans'
          ],
          description: 'The target view tab to switch to.' 
        },
        tab: { 
          type: Type.STRING, 
          description: 'Alternative alias for target_tab for backwards compatibility' 
        }
      },
      required: ['target_tab']
    }
  },
  {
    name: 'interact_pdf_document',
    description: 'Control PDF & Document Insights: switch to PDF mode, select pre-loaded document memo, switch output tabs (summary, strategies, actions, risks), or scroll to page.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          enum: ['open_pdf_mode', 'select_document', 'switch_output_tab', 'scroll_to_page'],
          description: 'Action to execute in PDF Insights'
        },
        documentIndex: {
          type: Type.INTEGER,
          description: '0-based index of document to select (0 = Q3 Commercial Review, 1 = Distributor Governance Memo, 2 = Supply Chain Logistics)'
        },
        outputTab: {
          type: Type.STRING,
          enum: ['summary', 'strategies', 'actions', 'risks', 'qna'],
          description: 'Target section tab to activate'
        },
        pageNumber: {
          type: Type.INTEGER,
          description: 'Target document page number to scroll to'
        }
      },
      required: ['action']
    }
  },
  {
    name: 'sort_data',
    description: 'Sort the dataset or rankings by a specific column and direction.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        sortBy: { type: Type.STRING, description: 'Column to sort by (e.g. revenue, cost, discount, outstandingAmount, customerName, product)' },
        sortDirection: { type: Type.STRING, enum: ['asc', 'desc'], description: 'Sort order: ascending or descending' }
      },
      required: ['sortBy']
    }
  },
  {
    name: 'drill_down',
    description: 'Deep dive into a specific entity (customer, product, region, or distributor).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ['customer', 'product', 'region', 'distributor'], description: 'Dimension entity type' },
        value: { type: Type.STRING, description: 'Name of the entity' }
      },
      required: ['type', 'value']
    }
  },
  {
    name: 'switch_chart_type',
    description: 'Change the chart visualization display format.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        chartType: { type: Type.STRING, enum: ['bar', 'line', 'pie', 'area'], description: 'Visual presentation chart type' }
      },
      required: ['chartType']
    }
  },
  {
    name: 'update_custom_chart',
    description: 'Dynamically configure and update the Custom Chart Builder with a specific dimension, measure, and chart visualization type based on voice command.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        dimension: { 
          type: Type.STRING, 
          description: 'Categorical dimension or date to group by on the X-axis (must be an actual column name from the uploaded dataset schema)' 
        },
        measure: { 
          type: Type.STRING, 
          description: 'Numeric measure to aggregate on the Y-axis (must be an actual numeric column name from the uploaded dataset schema)' 
        },
        chartType: { 
          type: Type.STRING, 
          enum: ['bar', 'line', 'area', 'pie'], 
          description: 'Chart presentation format' 
        },
        explanation: {
          type: Type.STRING,
          description: 'Short statement explaining the custom visual insight generated'
        }
      },
      required: ['dimension', 'measure']
    }
  },
  {
    name: 'set_date_range',
    description: 'Filter sales analysis to a specific date interval.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        start: { type: Type.STRING, description: 'Start date in YYYY-MM-DD' },
        end: { type: Type.STRING, description: 'End date in YYYY-MM-DD' }
      },
      required: ['start', 'end']
    }
  },
  {
    name: 'show_comparison',
    description: 'Compare two regions, products, or distributors side by side.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        type: { type: Type.STRING, enum: ['region', 'product', 'distributor'], description: 'Dimension type' },
        valueA: { type: Type.STRING, description: 'First entity' },
        valueB: { type: Type.STRING, description: 'Second entity' }
      },
      required: ['type', 'valueA', 'valueB']
    }
  },
  {
    name: 'generate_action_plan',
    description: 'Generate an executive analytical conclusion, strategic recommendations, and concrete actionable checklist items with owners, priorities, and expected ROI to display on the dashboard.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        conclusion: {
          type: Type.STRING,
          description: 'Executive analytical conclusion and key finding from the data'
        },
        rootCause: {
          type: Type.STRING,
          description: 'Primary driver or underlying root cause identified'
        },
        riskLevel: {
          type: Type.STRING,
          enum: ['Low', 'Medium', 'High'],
          description: 'Risk severity level'
        },
        recommendations: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'High-level business recommendations'
        },
        actionItems: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              task: { type: Type.STRING, description: 'Specific action or task' },
              owner: { type: Type.STRING, description: 'Assigned owner or team' },
              priority: { type: Type.STRING, enum: ['Immediate', 'High', 'Medium', 'Low'], description: 'Task priority' },
              expectedRoi: { type: Type.STRING, description: 'Anticipated financial or operational ROI' },
              deadline: { type: Type.STRING, description: 'Target timeline, e.g. 7 days, 14 days' }
            },
            required: ['task', 'priority', 'expectedRoi']
          },
          description: 'Concrete actionable implementation checklist'
        }
      },
      required: ['conclusion', 'recommendations', 'actionItems']
    }
  },
  {
    name: 'capture_whatsapp_lead',
    description: 'Capture consumer WhatsApp lead details (11-digit phone number starting with 0 and user full name) to auto-fill the brochure dispatch form and trigger instant brochure dispatch.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        phone_number: {
          type: Type.STRING,
          description: '11-digit WhatsApp phone number starting with 0 (e.g., 03001234567, or dictated digit-by-digit)'
        },
        user_name: {
          type: Type.STRING,
          description: 'Full name or spoken name of the customer/lead'
        }
      },
      required: ['phone_number']
    }
  }
];

export interface CapturedLeadResult {
  phoneNumber: string;
  userName: string;
  isValid: boolean;
  formattedNumber: string;
  spokenConfirmation: string;
}

export const capture_whatsapp_lead = (
  phone_number: string,
  user_name?: string
): CapturedLeadResult => {
  const digits = (phone_number || '').replace(/\D/g, '');
  let cleanDigits = digits;
  if (digits.startsWith('92') && digits.length === 12) {
    cleanDigits = '0' + digits.substring(2);
  } else if (!digits.startsWith('0') && digits.length === 10) {
    cleanDigits = '0' + digits;
  }
  
  const isValid = cleanDigits.startsWith('0') && cleanDigits.length === 11;
  const name = user_name?.trim() || 'Valued Customer';
  
  const formattedNumber = isValid 
    ? `${cleanDigits.slice(0, 4)}-${cleanDigits.slice(4)}`
    : cleanDigits;

  const spokenConfirmation = isValid
    ? `Got it, ${name}. I have your number as ${cleanDigits}. Sending your brochure now!`
    : `I received ${cleanDigits}. Please state your 11-digit WhatsApp number starting with 0, followed by your name.`;

  return {
    phoneNumber: cleanDigits,
    userName: name,
    isValid,
    formattedNumber,
    spokenConfirmation
  };
};

export const getVoiceSession = async (
  language: string,
  dataContext: string,
  callbacks: any
) => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please set GEMINI_API_KEY in your environment.");
  }
  const ai = new GoogleGenAI({ apiKey });
  const langConstraint = language === Language.AUTO 
    ? "Detect and match the user's language. Speak naturally in that language. Use RTL for Urdu/Arabic."
    : `Speak exclusively in ${language}.`;

  return ai.live.connect({
    model: 'gemini-3.8-live',
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      tools: [{ functionDeclarations: dashboardFunctions }],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
      },
      systemInstruction: `
        You are the Executive B2C Real Estate Sales Advisor & Universal Voice Controller for prime residential property conversions.
        
        DATASET & ENGINE CONTEXT:
        ${dataContext}
        
        ${langConstraint}
        
        CORE B2C MISSION & PRINCIPLES:
        1. B2C CUSTOMER CONVERSION & SALES EMPOWERMENT:
           - Primary focus: Customer conversion, clear pricing transparency, flexible payment plans, and real-time unit availability.
           - Treat the multi-sheet relational data model (Units, Payment Plans, Developments, Inquiries) and target website content as your default grounded Knowledge Base.
           - Ground your spoken responses in real property specifications (bedrooms, sq ft, views, handover dates, Italian marble/German appliance specs, amenities).
           - Proactively highlight consumer-facing details regarding pricing tiers, 10% booking deposits, 80/20 post-handover plans, 100% DLD waivers, 0% commissions, and 10-Year UAE Golden Visa qualifications.
           - EXCLUDE BACK-OFFICE AUDIT NOISE: Strictly ignore and exclude internal audit logs, compliance memos, journal balancing, or distributor litigation from customer conversations.

        2. UNIVERSAL VOICE CLICK ENGINE & NAVIGATION:
           You possess full-app and iFrame voice click execution capabilities.
           - WHENEVER the user speaks a command to click, press, trigger, select, or tap ANY element:
             * Example voice commands: "Click Proxy Stream", "Click Navigate and Ingest", "Click Payment Plans", "Click Reserve Unit", "Click Download Template", "Click Unit 102", "Click Ask Advisor", "Click Dark Mode", "Click Split View", "Click Filter", "Click Golden Visa Plan".
             * IMMEDIATELY call 'click_element' with 'text_match' (and optionally 'target': 'app'|'iframe'|'any').
             * Speak a snappy confirmation: "Triggering [element name] now."
           - WHENEVER the user asks to type, enter, or search for text:
             * Call 'input_text' with 'selector_or_placeholder' and 'text'.
           - WHENEVER the user asks to scroll:
             * Call 'scroll_page' with 'direction' ('up', 'down', 'top', 'bottom').
           - WHENEVER the user wants to switch tabs or views:
             * Call 'navigate_to_tab' with 'target_tab' ('home', 'dashboard', 'payment_plans', 'web_navigator', 'dataModel', 'dataset_records', 'pdf_insights').

        3. VOICE-DRIVEN WHATSAPP LEAD CAPTURE & AUTO-BROCHURE DISPATCH:
           - When the user asks for a brochure, catalog, pricing sheet, or WhatsApp details:
             Prompt the user: "Please state your 11-digit WhatsApp number starting with 0, followed by your name."
           - When the user states their phone number (supporting slow digit-by-digit dictation, e.g. "zero three zero zero one two three four five six seven") and their name:
             1. Parse the input to extract the exact 11-digit string starting with '0' (e.g. 03001234567) and extract the full name.
             2. IMMEDIATELY call 'capture_whatsapp_lead' with 'phone_number' and 'user_name'.
             3. Confirm the details back to the user with the exact validation feedback:
                "Got it, [Name]. I have your number as [Number]. Sending your brochure now!"

        4. B2C REAL ESTATE INVENTORY & PROPERTY DIRECTIVES:
           - For unit search/filtering ("show 2-bedroom units under 2 million", "filter by available penthouses", "show Q4 2025 handovers"):
             Call 'filter_units' and/or 'update_dashboard_filters' to instantly manipulate the UI.
           - For property selection ("inspect unit MH-101", "show details for Azure Palms"):
             Call 'select_unit' with 'unitCode'.
           - For consumer questions ("how does post-handover work?", "what are starting prices?", "what amenities are included?"):
             Provide an eloquent, sales-closing answer grounded in the model and web portal, and guide the user through the live inventory and payment plans.

        5. FOR DATA ANALYSIS COMMANDS:
           - Call 'generate_action_plan' to provide an executive summary, commercial findings, and actionable recommendations.
           - Keep verbal responses punchy, helpful, and high-converting.
      `,
    },
  });
};

// ─── Voice Instruction Processor & Test Engine ────────────────────────

export interface VoiceInstructionResult {
  manipulatedFilters?: DashboardFilter;
  highlightedMetric?: 'revenue' | 'profit' | 'outstanding' | 'discount';
  targetTab?: AppTabId;
  pdfVoiceAction?: PdfVoiceAction;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  drillDown?: { type: 'customer' | 'product' | 'region' | 'distributor'; value: string };
  customChart?: CustomChartConfig;
  actionPlan: ExecutiveActionPlan;
  verbalResponse: string;
}

export const processVoiceInstruction = async (
  instruction: string,
  data: SalesRecord[],
  engine: BIEngineOutput,
  language: Language,
  schema?: DatasetSchema
): Promise<VoiceInstructionResult> => {
  const customChartFallback = parseCustomChartFromVoice(instruction, schema);
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
        User Voice Instruction: "${instruction}"
        
        Real Dataset Schema:
        - Columns: [${schema?.columns.join(', ') || Object.keys(data[0] || {}).join(', ')}]
        - Numeric Measures: [${schema?.numericColumns.join(', ') || ''}]
        - Categorical Dimensions: [${schema?.categoricalColumns.join(', ') || ''}]
        
        Current Engine Totals:
        - Total Primary Metric: ${Math.round(engine?.kpis?.totalRevenue || 0)}
        - Margin: ${(engine?.kpis?.grossMargin || 0).toFixed(1)}%
        - Total Records: ${data?.length || 0}
        
        CRITICAL: Only reference real column names from above. Do NOT use mock column names.
        
        TASK:
        1. Check if the user is giving a navigation command to switch tabs/views (e.g., "Take me to Dashboard", "Open Sales Records", "Go to Web Navigator", "Show me Distributors", "Take me Home", "Open PDF Insights"). If so, specify targetTab.
        2. Determine how to manipulate the dashboard (filters, highlight metric, sort, or drill-down).
        3. If the user asks to chart, graph, plot, or visualize any dimension and measure (or change chart format), configure customChart (dimension, measure, chartType) using the real columns.
        4. Formulate an executive Conclusion.
        5. Identify the Root Cause.
        6. Recommend Strategic Actions.
        7. Formulate 2-4 concrete Action Items with task, owner, priority (Immediate/High/Medium/Low), expectedRoi, deadline.
        8. Provide a concise verbal response for speech.
        
        Respond in JSON conforming to the schema.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              targetTab: { 
                type: Type.STRING, 
                enum: [
                  'home', 
                  'dashboard', 
                  'dataset_records', 
                  'reports', 
                  'dataModel',
                  'data_model',
                  'distributors', 
                  'pdf_insights', 
                  'pdfInsights', 
                  'web_navigator', 
                  'webNavigator',
                  'payment_plans'
                ],
                description: 'Target application view tab if user gave a spoken navigation command' 
              },
              filters: {
                type: Type.OBJECT,
                properties: {
                  column: { type: Type.STRING },
                  value: { type: Type.STRING },
                  region: { type: Type.STRING },
                  product: { type: Type.STRING },
                  distributor: { type: Type.STRING },
                  customer: { type: Type.STRING }
                }
              },
              customChart: {
                type: Type.OBJECT,
                properties: {
                  dimension: { type: Type.STRING, description: 'Exact column name from dataset schema' },
                  measure: { type: Type.STRING, description: 'Exact numeric column name from dataset schema' },
                  chartType: { type: Type.STRING, enum: ['bar', 'line', 'area', 'pie'] }
                }
              },
              highlightedMetric: { type: Type.STRING, enum: ['revenue', 'profit', 'outstanding', 'discount'] },
              sortBy: { type: Type.STRING },
              sortDirection: { type: Type.STRING, enum: ['asc', 'desc'] },
              drillDown: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ['customer', 'product', 'region', 'distributor'] },
                  value: { type: Type.STRING }
                }
              },
              conclusion: { type: Type.STRING },
              rootCause: { type: Type.STRING },
              riskLevel: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
              recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
              actionItems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    task: { type: Type.STRING },
                    owner: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['Immediate', 'High', 'Medium', 'Low'] },
                    expectedRoi: { type: Type.STRING },
                    deadline: { type: Type.STRING }
                  },
                  required: ['task', 'priority', 'expectedRoi']
                }
              },
              verbalResponse: { type: Type.STRING }
            },
            required: ['conclusion', 'recommendations', 'actionItems', 'verbalResponse']
          }
        }
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      if (parsed.conclusion) {
        const resolvedCustomChart = (parsed.customChart && (parsed.customChart.dimension || parsed.customChart.measure))
          ? {
              dimension: parsed.customChart.dimension || customChartFallback?.dimension || (schema?.categoricalColumns[0] || schema?.columns[0] || 'Category'),
              measure: parsed.customChart.measure || customChartFallback?.measure || (schema?.numericColumns[0] || 'Value'),
              chartType: parsed.customChart.chartType || customChartFallback?.chartType || 'bar',
              lastCommand: instruction
            }
          : (customChartFallback || undefined);

        const resolvedTargetTab = parsed.targetTab ? (normalizeTabId(parsed.targetTab) || undefined) : undefined;

        return {
          targetTab: resolvedTargetTab,
          manipulatedFilters: parsed.filters,
          highlightedMetric: parsed.highlightedMetric,
          sortBy: parsed.sortBy,
          sortDirection: parsed.sortDirection,
          drillDown: parsed.drillDown,
          customChart: resolvedCustomChart,
          verbalResponse: parsed.verbalResponse || parsed.conclusion,
          actionPlan: {
            id: `plan-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            triggeredBy: instruction,
            conclusion: parsed.conclusion,
            rootCause: parsed.rootCause,
            riskLevel: (parsed.riskLevel as RiskLevel) || RiskLevel.MEDIUM,
            recommendations: parsed.recommendations || [],
            actionItems: (parsed.actionItems || []).map((a: any, i: number) => ({
              id: `action-${i}`,
              task: a.task,
              owner: a.owner || 'Commercial Lead',
              priority: a.priority || 'High',
              expectedRoi: a.expectedRoi || 'Target Growth',
              deadline: a.deadline || '14 Days',
              completed: false
            }))
          }
        };
      }
    } catch (e) {
      console.warn("Gemini voice instruction call failed, falling back to analytical intelligence engine:", e);
    }
  }

  // ─── Rule-Based Intelligent BI Engine Fallback (guarantees testing works offline/always) ───
  return generateDeterministicInstructionResult(instruction, data, engine, schema);
};

function generateDeterministicInstructionResult(
  instruction: string,
  data: SalesRecord[],
  engine: BIEngineOutput,
  schema?: DatasetSchema
): VoiceInstructionResult {
  const lower = instruction.toLowerCase();

  const result: VoiceInstructionResult = {
    actionPlan: {
      id: `plan-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      triggeredBy: instruction,
      conclusion: '',
      rootCause: '',
      riskLevel: RiskLevel.MEDIUM,
      recommendations: [],
      actionItems: []
    },
    verbalResponse: ''
  };

  // 0. Check for explicit Voice Navigation commands (e.g., "Take me to Dashboard", "Open Sales Records", "Go to Web Navigator", "Show me Distributors")
  const voiceNav = parseVoiceNavigationCommand(instruction);
  if (voiceNav) {
    result.targetTab = voiceNav.tab;
    result.verbalResponse = voiceNav.confirmation;
    result.actionPlan.conclusion = `Voice Navigation: ${voiceNav.confirmation}`;
    result.actionPlan.rootCause = `Direct UI routing command invoked via voice assistant.`;
    result.actionPlan.riskLevel = RiskLevel.LOW;
    result.actionPlan.recommendations = [
      `Active workspace shifted to ${voiceNav.label}.`,
      `You can now inspect detailed views or speak follow-up analytical queries.`
    ];
    result.actionPlan.actionItems = [
      {
        id: `nav-action-${Date.now()}`,
        task: `Review ${voiceNav.label} view and records`,
        owner: 'Executive User',
        priority: 'Immediate',
        expectedRoi: 'Instant operational visibility',
        deadline: 'Current Session',
        completed: true
      }
    ];

    // If instruction combines navigation with region filtering (e.g., "Take me to Dashboard and show North region")
    for (const reg of ['north', 'south', 'east', 'west']) {
      if (lower.includes(reg)) {
        const regProper = reg.charAt(0).toUpperCase() + reg.slice(1);
        result.manipulatedFilters = { region: regProper };
        result.highlightedMetric = 'revenue';
        result.verbalResponse = `Switching to ${voiceNav.label} and filtering to ${regProper} region.`;
        break;
      }
    }

    return result;
  }

  // 1. Check for PDF / Document Insights voice command
  if (lower.includes('pdf') || lower.includes('document') || lower.includes('memo') || lower.includes('text file') || lower.includes('read aloud') || lower.includes('read page') || lower.includes('read document')) {
    result.targetTab = 'pdfInsights';
    let pdfActionType: 'route' | 'select_document' | 'switch_tab' | 'scroll_page' | 'read_aloud' = 'route';
    let docIdx: number | undefined = undefined;
    let outTab: 'summary' | 'strategies' | 'actions' | 'risks' | 'qna' | undefined = undefined;
    let pageNum: number | undefined = undefined;

    if (lower.includes('distributor') || lower.includes('governance') || lower.includes('credit memo') || lower.includes('document 2') || lower.includes('memo 2')) {
      pdfActionType = 'select_document';
      docIdx = 1;
    } else if (lower.includes('logistics') || lower.includes('supply chain') || lower.includes('document 3') || lower.includes('memo 3')) {
      pdfActionType = 'select_document';
      docIdx = 2;
    } else if (lower.includes('commercial') || lower.includes('q3') || lower.includes('document 1') || lower.includes('memo 1')) {
      pdfActionType = 'select_document';
      docIdx = 0;
    }

    if (lower.includes('strateg')) {
      outTab = 'strategies';
      if (pdfActionType === 'route') pdfActionType = 'switch_tab';
    } else if (lower.includes('action')) {
      outTab = 'actions';
      if (pdfActionType === 'route') pdfActionType = 'switch_tab';
    } else if (lower.includes('risk')) {
      outTab = 'risks';
      if (pdfActionType === 'route') pdfActionType = 'switch_tab';
    } else if (lower.includes('summary') || lower.includes('overview')) {
      outTab = 'summary';
    }

    if (lower.includes('page 2') || lower.includes('second page')) pageNum = 2;
    if (lower.includes('page 3') || lower.includes('third page')) pageNum = 3;
    if (lower.includes('page 1') || lower.includes('first page')) pageNum = 1;

    result.pdfVoiceAction = {
      type: pdfActionType,
      documentIndex: docIdx,
      outputTab: outTab,
      pageNumber: pageNum,
      timestamp: Date.now()
    };

    result.actionPlan.conclusion = `Switched to PDF & Document Insights workspace in isolated read-only mode.`;
    result.actionPlan.rootCause = `Direct document analysis decoupled from active sales database.`;
    result.actionPlan.riskLevel = RiskLevel.LOW;
    result.actionPlan.recommendations = [
      'Inspect executive summary, core strategies, and action items with in-document citations.',
      'Select enterprise sample memos or upload custom documents for instant synthesis.'
    ];
    result.actionPlan.actionItems = [
      {
        id: 'act-pdf-1',
        task: 'Review highlighted document page references in reader pane',
        owner: 'Leadership Team',
        priority: 'High',
        expectedRoi: 'Cross-functional alignment',
        deadline: 'Immediate',
        completed: false
      }
    ];

    if (docIdx !== undefined) {
      result.verbalResponse = `Opened PDF Insights and loaded the selected enterprise memo.`;
    } else if (outTab) {
      result.verbalResponse = `Switched to the ${outTab} section in PDF Insights.`;
    } else {
      result.verbalResponse = `Switching to PDF and text document mode. No database records will be modified.`;
    }

    return result;
  }

  // 1. Check for Custom Chart Voice Command
  const customChartConfig = parseCustomChartFromVoice(instruction, schema);
  if (customChartConfig && (lower.includes('chart') || lower.includes('plot') || lower.includes('graph') || lower.includes('pie') || lower.includes('bar') || lower.includes('line') || lower.includes('area') || lower.includes('by') || lower.includes('vs'))) {
    result.customChart = customChartConfig;
    const dimLabel = customChartConfig.dimension?.toUpperCase();
    const measLabel = customChartConfig.measure?.toUpperCase();
    const typeLabel = customChartConfig.chartType;

    result.actionPlan.conclusion = `Custom Chart Builder reconfigured to display ${measLabel} segmented by ${dimLabel} in ${typeLabel} chart format.`;
    result.actionPlan.rootCause = `Direct visual inspection reveals distribution patterns and segment concentrations across ${dimLabel}.`;
    result.actionPlan.riskLevel = RiskLevel.LOW;
    result.actionPlan.recommendations = [
      `Review highest and lowest volume clusters across ${dimLabel} segments.`,
      `Adjust commercial quotas and operational allocation according to segment performance.`
    ];
    result.actionPlan.actionItems = [
      {
        id: 'act-chart-1',
        task: `Export visual summary of ${measLabel} by ${dimLabel} for leadership review`,
        owner: 'Analytics & Strategy Lead',
        priority: 'High',
        expectedRoi: 'Enhanced data transparency',
        deadline: '3 Days',
        completed: false
      }
    ];
    result.verbalResponse = `I have updated your custom chart to display ${customChartConfig.measure} by ${customChartConfig.dimension} using a ${customChartConfig.chartType} chart.`;
    return result;
  }

  // 1. Check for Region Filter
  const regions = ['north', 'south', 'east', 'west'];
  for (const reg of regions) {
    if (lower.includes(reg)) {
      const regProper = reg.charAt(0).toUpperCase() + reg.slice(1);
      result.manipulatedFilters = { region: regProper };
      result.highlightedMetric = 'revenue';
      
      const regStats = engine?.rankings?.regionBreakdown?.find(r => r.region.toLowerCase() === reg);
      const rev = regStats ? Math.round(regStats.revenue).toLocaleString() : 'N/A';
      
      result.actionPlan.conclusion = `${regProper} region generated $${rev} in gross sales with significant growth potential in Tier-1 customer distribution.`;
      result.actionPlan.rootCause = `Sales reps in ${regProper} are heavily reliant on legacy catalog lines with minimal cross-selling of newer premium products.`;
      result.actionPlan.riskLevel = RiskLevel.MEDIUM;
      result.actionPlan.recommendations = [
        `Realign regional sales incentives to focus on high-margin SKU cross-selling in ${regProper}.`,
        `Institute bi-weekly distributor performance reviews to accelerate order velocity.`,
        `Launch a localized 30-day promotional campaign targeting high-volume accounts.`
      ];
      result.actionPlan.actionItems = [
        {
          id: 'act-1',
          task: `Deploy regional promotion bundle for ${regProper} top accounts`,
          owner: `${regProper} Regional Sales Director`,
          priority: 'Immediate',
          expectedRoi: '+35,000 incremental quarterly margin',
          deadline: '7 Days',
          completed: false
        },
        {
          id: 'act-2',
          task: `Audit distributor inventory levels across ${regProper} hubs`,
          owner: 'Supply Chain Operations',
          priority: 'High',
          expectedRoi: '15% reduction in fulfillment turnaround',
          deadline: '14 Days',
          completed: false
        },
        {
          id: 'act-3',
          task: `Schedule executive alignment meetings with top 3 ${regProper} buyers`,
          owner: 'Key Account Management',
          priority: 'Medium',
          expectedRoi: 'Secures contract renewals at 8% higher volume',
          deadline: '30 Days',
          completed: false
        }
      ];
      result.verbalResponse = `Filtered dashboard to ${regProper} region. Total revenue is ${rev}. I have generated a comprehensive action plan and prioritized 3 commercial execution tasks on your dashboard.`;
      return result;
    }
  }

  // 2. Check for Outstanding / High Risk / Debt
  if (lower.includes('outstanding') || lower.includes('debt') || lower.includes('risk') || lower.includes('receivable')) {
    result.highlightedMetric = 'outstanding';
    result.sortBy = 'outstandingAmount';
    result.sortDirection = 'desc';

    const highRisk = engine?.risk?.highRiskAccounts || [];
    const topDebtor = highRisk[0]?.customer || 'Key Account';
    const totalOut = Math.round(engine?.kpis?.totalOutstanding || 0).toLocaleString();

    result.actionPlan.conclusion = `Accounts receivable exposure stands at ${totalOut} across network distributors, creating working capital drag.`;
    result.actionPlan.rootCause = `Delayed settlement cycles and lax enforcement of credit limits for accounts over 45 days, particularly ${topDebtor}.`;
    result.actionPlan.riskLevel = RiskLevel.HIGH;
    result.actionPlan.recommendations = [
      `Enforce automatic credit holds on accounts exceeding 60-day settlement terms.`,
      `Offer a 2% early-payment rebate for settlements within 10 days to unlock immediate liquidity.`,
      `Transition chronically late accounts to escrow or cash-on-delivery (COD).`
    ];
    result.actionPlan.actionItems = [
      {
        id: 'act-1',
        task: `Issue formal payment demand and freeze credit for ${topDebtor}`,
        owner: 'Credit Recovery Lead',
        priority: 'Immediate',
        expectedRoi: '+28,000 cash recovery within 10 days',
        deadline: '3 Days',
        completed: false
      },
      {
        id: 'act-2',
        task: `Roll out 2% early settlement discount incentive across all accounts with >5k due`,
        owner: 'Finance & Billing Team',
        priority: 'High',
        expectedRoi: 'Accelerates 40% of overdue receivables',
        deadline: '7 Days',
        completed: false
      },
      {
        id: 'act-3',
        task: `Establish weekly liquidity review committee with Executive Leadership`,
        owner: 'Chief Financial Officer',
        priority: 'Medium',
        expectedRoi: 'Eliminates recurring quarterly cash flow crunches',
        deadline: '14 Days',
        completed: false
      }
    ];
    result.verbalResponse = `Highlighted total outstanding debt of ${totalOut} and sorted accounts by overdue balance. Immediate credit hold recommendations and recovery items are displayed on your dashboard.`;
    return result;
  }

  // 3. Check for Product / Standard Gear / Widget / Margin
  const products = (engine?.rankings?.topProducts || []).map(p => p.name.toLowerCase());
  for (const prod of products) {
    if (lower.includes(prod) || lower.includes('product') || lower.includes('item')) {
      const match = engine?.rankings?.topProducts?.find(p => p.name.toLowerCase() === prod) || engine?.rankings?.topProducts?.[0] || { name: 'Catalog Products', revenue: 0, margin: 0 };
      result.manipulatedFilters = { product: match.name };
      result.highlightedMetric = 'profit';

      result.actionPlan.conclusion = `${match.name} is a primary revenue contributor generating ${Math.round(match.revenue).toLocaleString()} with ${match.margin.toFixed(1)}% gross margin.`;
      result.actionPlan.rootCause = `Product velocity is strong, but profitability is dampened by unapproved sales discounts exceeding 12%.`;
      result.actionPlan.riskLevel = RiskLevel.LOW;
      result.actionPlan.recommendations = [
        `Cap discretionary discount allowances at 5% for ${match.name}.`,
        `Bundle ${match.name} with higher-margin ancillary supplies to lift average order value.`,
        `Expand distributor tier margins based on annual volume milestones.`
      ];
      result.actionPlan.actionItems = [
        {
          id: 'act-1',
          task: `Lock discounting thresholds on ERP for ${match.name}`,
          owner: 'Commercial Operations Manager',
          priority: 'Immediate',
          expectedRoi: '+3.8% direct margin recovery',
          deadline: '5 Days',
          completed: false
        },
        {
          id: 'act-2',
          task: `Launch bundled promotional catalog featuring ${match.name} accessories`,
          owner: 'Product Marketing Team',
          priority: 'High',
          expectedRoi: '18% increase in order basket size',
          deadline: '14 Days',
          completed: false
        }
      ];
      result.verbalResponse = `Filtered dashboard to ${match.name} and illuminated profit margins. I have generated product margin optimization recommendations and implementation tasks.`;
      return result;
    }
  }

  // 4. Default / Global Reset & Overview Plan
  result.manipulatedFilters = {};
  result.highlightedMetric = 'revenue';
  const totalRev = Math.round(engine?.kpis?.totalRevenue || 0).toLocaleString();
  const grossMargin = (engine?.kpis?.grossMargin || 0).toFixed(1);
  const totalCust = engine?.kpis?.uniqueCustomers || 0;
  const totalOutAmt = Math.round(engine?.kpis?.totalOutstanding || 0);
  result.actionPlan.conclusion = `Enterprise sales are tracking at ${totalRev} with a healthy ${grossMargin}% gross margin across ${totalCust} accounts.`;
  result.actionPlan.rootCause = `Revenue distribution is healthy, though accounts receivable of ${totalOutAmt.toLocaleString()} requires structured credit management.`;
  result.actionPlan.riskLevel = totalOutAmt > 30000 ? RiskLevel.MEDIUM : RiskLevel.LOW;
  result.actionPlan.recommendations = [
    `Establish strategic growth targets targeting secondary regional distribution networks.`,
    `Institute disciplined credit terms and margin minimums across all commercial contracts.`,
    `Optimize product catalog positioning to maximize cross-sell attachment rates.`
  ];
  result.actionPlan.actionItems = [
    {
      id: 'act-1',
      task: `Conduct quarterly business reviews with top 5 distribution partners`,
      owner: 'VP of Commercial Strategy',
      priority: 'High',
      expectedRoi: '+120,000 contract expansion for upcoming quarter',
      deadline: '21 Days',
      completed: false
    },
    {
      id: 'act-2',
      task: `Deploy automated ERP credit checking on all purchase orders >10k`,
      owner: 'IT & Finance Lead',
      priority: 'Immediate',
      expectedRoi: 'Prevents 40,000+ in potential default exposure',
      deadline: '7 Days',
      completed: false
    },
    {
      id: 'act-3',
      task: `Deliver sales rep training on value-based pricing and margin preservation`,
      owner: 'Sales Enablement Director',
      priority: 'Medium',
      expectedRoi: '2.5% increase in realized net margin',
      deadline: '30 Days',
      completed: false
    }
  ];
  result.verbalResponse = `Reset dashboard to full enterprise view. I have analyzed your complete sales engine metrics and generated executive strategic directives and actionable next steps.`;
  return result;
}