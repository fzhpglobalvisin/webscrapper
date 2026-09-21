// services/biEngine.ts — Streamlined KPI Engine for Web Navigator RAG
import { SalesRecord, BIEngineOutput, BIKpis } from '../types';

export function computeBI(data: SalesRecord[]): BIEngineOutput {
  const kpis: BIKpis = {
    totalRevenue: 0,
    totalCost: 0,
    grossProfit: 0,
    grossMargin: 0,
    totalDiscount: 0,
    discountRate: 0,
    totalOutstanding: 0,
    avgOrderValue: 0,
    totalQuantity: 0,
    uniqueCustomers: 0,
    uniqueProducts: 0,
  };

  if (!Array.isArray(data) || data.length === 0) {
    return {
      kpis,
      trends: { monthly: [], daily: [] },
      rankings: { topProducts: [], topCustomers: [], topDistributors: [], regionBreakdown: [] },
      risk: { highRiskAccounts: [], overDiscounted: [], concentrationRisk: { topCustomerShare: 0, topProductShare: 0 } },
      distributors: { performance: [] },
    };
  }

  // Detect metric, cost, outstanding columns dynamically
  const first = data[0] || {};
  const keys = Object.keys(first);
  const revKey = keys.find(k => /revenue|amount|price|total|val/i.test(k)) || keys.find(k => typeof first[k] === 'number');
  const costKey = keys.find(k => /cost|cogs|expense/i.test(k));
  const outKey = keys.find(k => /outstanding|due|balance/i.test(k));

  let totalRev = 0;
  let totalCost = 0;
  let totalOut = 0;

  for (const r of data) {
    if (revKey) totalRev += Number(r[revKey]) || 0;
    if (costKey) totalCost += Number(r[costKey]) || 0;
    if (outKey) totalOut += Number(r[outKey]) || 0;
  }

  totalRev = Math.abs(totalRev);
  totalCost = Math.abs(totalCost);
  totalOut = Math.abs(totalOut);

  const grossProfit = totalCost > 0 ? Math.max(0, totalRev - totalCost) : totalRev;
  const grossMargin = totalRev > 0 ? (grossProfit / totalRev) * 100 : 0;

  kpis.totalRevenue = totalRev;
  kpis.totalCost = totalCost;
  kpis.grossProfit = grossProfit;
  kpis.grossMargin = grossMargin;
  kpis.totalOutstanding = totalOut;
  kpis.avgOrderValue = data.length > 0 ? totalRev / data.length : 0;
  kpis.totalQuantity = data.length;

  return {
    kpis,
    trends: { monthly: [], daily: [] },
    rankings: { topProducts: [], topCustomers: [], topDistributors: [], regionBreakdown: [] },
    risk: { highRiskAccounts: [], overDiscounted: [], concentrationRisk: { topCustomerShare: 0, topProductShare: 0 } },
    distributors: { performance: [] },
  };
}
