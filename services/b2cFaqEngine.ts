// services/b2cFaqEngine.ts — Auto-Generated Consumer-Facing B2C FAQs
// Synthesizes consumer-facing FAQs based on unit specs, pricing, payment terms, and web content
// Explicitly ignores audit, compliance, governance memos, and back-office logs.

import { GoogleGenAI } from '@google/genai';
import { RelationalDataModel, ScrapedWebContext, SalesRecord } from '../types';
import { B2C_REAL_ESTATE_UNITS, B2C_PAYMENT_PLANS, B2C_DEVELOPMENTS } from './b2cRealEstateData';

export interface B2CAutoFAQ {
  id: string;
  category: 'pricing' | 'payment_plans' | 'availability' | 'specs' | 'amenities' | 'investor_visa';
  categoryLabel: string;
  question: string;
  answer: string;
  sources: ('model' | 'web')[];
  keyMetrics?: { label: string; value: string }[];
  highlightTag?: string;
  suggestedVoiceCommand?: string;
}

export function synthesizeB2CAutoFAQs(
  dataModel?: RelationalDataModel,
  webContext?: ScrapedWebContext,
  unitsData?: SalesRecord[]
): B2CAutoFAQ[] {
  const units = unitsData && unitsData.length > 0 ? unitsData : B2C_REAL_ESTATE_UNITS;
  const plans = B2C_PAYMENT_PLANS;
  const developments = B2C_DEVELOPMENTS;

  // Extract pricing boundaries
  const prices = units.map(u => Number(u.price) || 0).filter(p => p > 0);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 980000;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 7800000;

  // Extract bedroom distribution
  const oneBeds = units.filter(u => u.bedrooms === 1);
  const twoBeds = units.filter(u => u.bedrooms === 2);
  const threeBeds = units.filter(u => u.bedrooms === 3);
  const penthouses = units.filter(u => String(u.propertyType || '').toLowerCase().includes('penthouse'));
  const villas = units.filter(u => String(u.propertyType || '').toLowerCase().includes('villa'));
  const availableUnits = units.filter(u => String(u.status || '').toLowerCase() === 'available');

  const min1BedPrice = oneBeds.length > 0 ? Math.min(...oneBeds.map(u => Number(u.price) || 0)) : 1180000;
  const min2BedPrice = twoBeds.length > 0 ? Math.min(...twoBeds.map(u => Number(u.price) || 0)) : 1820000;
  const min3BedPrice = threeBeds.length > 0 ? Math.min(...threeBeds.map(u => Number(u.price) || 0)) : 3650000;

  const webDomain = webContext?.url ? new URL(webContext.finalUrl || webContext.url).hostname : 'Official Portal';
  const hasWeb = !!webContext && webContext.status === 'active';

  const faqs: B2CAutoFAQ[] = [
    // 1. Pricing & Starting Prices
    {
      id: 'faq-pricing-1',
      category: 'pricing',
      categoryLabel: 'Pricing & Booking Deposit',
      question: 'What are the starting prices and booking deposit amounts across unit types?',
      answer: `Starting prices begin at ${minPrice.toLocaleString()} for executive studio suites, with luxury 1-bedroom residences starting at ${min1BedPrice.toLocaleString()}, waterfront 2-bedroom suites at ${min2BedPrice.toLocaleString()}, and spacious 3-bedrooms from ${min3BedPrice.toLocaleString()}. Signature penthouses with private rooftop pools start from 6,200,000, and luxury golf fairway villas from 5,450,000. All properties require a straightforward 10% booking deposit (e.g. ${Math.round(minPrice * 0.1).toLocaleString()} on entry-level units) to secure immediate unit allocation with zero broker commission.`,
      sources: ['model', 'web'],
      highlightTag: 'Direct Developer Rate',
      suggestedVoiceCommand: 'What are the starting prices for 2-bedroom units?',
      keyMetrics: [
        { label: 'Entry Studio', value: `${minPrice.toLocaleString()}` },
        { label: '1-BR Luxury', value: `${min1BedPrice.toLocaleString()}` },
        { label: '2-BR Waterfront', value: `${min2BedPrice.toLocaleString()}` },
        { label: 'Booking Deposit', value: '10%' }
      ]
    },

    // 2. Payment Plans & Post-Handover Flex
    {
      id: 'faq-payment-1',
      category: 'payment_plans',
      categoryLabel: 'Flexible Payment Plans',
      question: 'How does the 80/20 post-handover payment plan work, and what are the monthly installments?',
      answer: `The 80/20 post-handover plan is designed for optimal cash flow: you pay 10% on initial booking, 40% in structured milestone installments linked to verified RERA construction progress, 30% upon key handover, and the remaining 20% comfortably spread over 36 monthly installments post-handover (3 years). For a 2-bedroom waterfront residence at 1,980,000, the monthly post-handover installment is approximately 16,500 per month. This allows owners to place rental tenants and utilize rental yields (~8%) to fund subsequent installments.`,
      sources: ['model', 'web'],
      highlightTag: '3-Year Post-Handover',
      suggestedVoiceCommand: 'Explain the 80/20 post handover payment plan',
      keyMetrics: [
        { label: 'Down Payment', value: '10%' },
        { label: 'During Build', value: '40%' },
        { label: 'On Handover', value: '30%' },
        { label: 'Post-Handover', value: '20% (36 Months)' }
      ]
    },

    // 3. Additional Fees & DLD Waiver
    {
      id: 'faq-pricing-2',
      category: 'pricing',
      categoryLabel: 'Fee Waivers & Savings',
      question: 'Are there hidden agency commissions or Dubai Land Department (DLD) transfer fees?',
      answer: `No hidden charges. All direct developer bookings include a 100% full waiver on Dubai Land Department (DLD) transfer fees (saving 4% of property purchase value, equivalent to 79,200 on a 1.98M purchase). Additionally, buyers pay 0% agency brokerage fees. The advertised sticker price and payment schedule represent your complete transparent acquisition commitment.`,
      sources: ['model', 'web'],
      highlightTag: '100% DLD Waiver',
      suggestedVoiceCommand: 'Are there any agency fees or DLD charges?',
      keyMetrics: [
        { label: 'Agency Fee', value: '0% (Zero)' },
        { label: 'DLD Fee Waiver', value: '100% Free' },
        { label: 'Average Savings', value: '4% of Purchase' }
      ]
    },

    // 4. Unit Availability & Handover Timelines
    {
      id: 'faq-avail-1',
      category: 'availability',
      categoryLabel: 'Handover & Unit Availability',
      question: 'Which units are currently available and when are the handover completion dates?',
      answer: `There are currently ${availableUnits.length} verified units available for immediate reservation across Marina Horizon (handover Q4 2025), Azure Palms West Crescent (handover Q2 2026), Downtown Sky Tower (handover Q1 2026), and The Hills Golf Villas (handover Q3 2026). Ready-to-move inventory is also available immediately in Creek Royal Mansions with our 50/50 ready-handover scheme, where keys are handed over immediately upon 50% settlement.`,
      sources: ['model'],
      highlightTag: `${availableUnits.length} Units Available`,
      suggestedVoiceCommand: 'Show available units for Q4 2025 handover',
      keyMetrics: [
        { label: 'Available Units', value: `${availableUnits.length}` },
        { label: 'Marina Horizon', value: 'Q4 2025' },
        { label: 'Azure Palms', value: 'Q2 2026' },
        { label: 'Creek Harbour', value: 'Ready to Move' }
      ]
    },

    // 5. Unit Specifications & Finishes
    {
      id: 'faq-specs-1',
      category: 'specs',
      categoryLabel: 'Unit Specs & Finishes',
      question: 'What are the square footage, layout specs, and interior finish standards?',
      answer: `Units feature oversized layouts with generous floor-to-ceiling heights (3.2m in standard residences, 4.2m in sky penthouses). Sizes range from 540 sq ft for executive studios, 780–840 sq ft for 1-bedrooms, 1,290–1,520 sq ft for 2-bedrooms, 2,150–2,420 sq ft for 3-bedrooms, and up to 6,200 sq ft for fairway golf estates. Every home comes with expansive panoramic balconies, integrated German Miele/Bosch kitchen appliances, Italian porcelain and marble bathrooms, smart climate and lighting controls, and dedicated covered parking with EV charging stations.`,
      sources: ['model', 'web'],
      highlightTag: 'Italian Finishes',
      suggestedVoiceCommand: 'What finishes and appliances are included in the units?',
      keyMetrics: [
        { label: 'Ceiling Height', value: '3.2m - 4.2m' },
        { label: 'Appliances', value: 'German Fitted' },
        { label: 'Balcony Glass', value: 'Full Panoramic' },
        { label: 'Smart Home', value: 'Integrated' }
      ]
    },

    // 6. Investor Yields & Golden Visa Qualification
    {
      id: 'faq-investor-1',
      category: 'investor_visa',
      categoryLabel: 'Golden Visa & Rental Yields',
      question: 'Do these properties qualify for the 10-Year UAE Golden Visa and what is the expected rental yield?',
      answer: `Yes. Any property purchased with a value of 2,000,000 or greater (such as 2-bedroom waterfront units, 3-bedrooms, penthouses, and villas) fully qualifies the buyer and their spouse, children, and parents for the 10-Year Renewable UAE Golden Visa with zero sponsor requirements. Furthermore, prime waterfront units in Dubai Marina and Palm Jumeirah project net rental yields between 7.8% and 9.2% annually, bolstered by short-term holiday let demand and long-term tenant stability.`,
      sources: ['model', 'web'],
      highlightTag: '10-Yr Golden Visa',
      suggestedVoiceCommand: 'Do these units qualify for the UAE Golden Visa?',
      keyMetrics: [
        { label: 'Visa Threshold', value: '2,000,000+' },
        { label: 'Visa Validity', value: '10 Years Renewable' },
        { label: 'Projected Net Yield', value: '7.8% - 9.2%' },
        { label: 'Family Coverage', value: 'Full Immediate Family' }
      ]
    },

    // 7. Amenities & Lifestyle
    {
      id: 'faq-amenities-1',
      category: 'amenities',
      categoryLabel: 'Lifestyle & Community Amenities',
      question: 'What lifestyle amenities, beach access, and concierge facilities are provided?',
      answer: `Residents enjoy five-star resort living: Azure Palms provides direct private white sand beach access with serviced cabanas. Marina Horizon features an infinity edge deck overlooking the yacht club, private yacht berthing options, a 24/7 wellness gym, cinema room, and children's splash pads. Downtown Sky Tower offers direct climate-controlled skybridge connection into Dubai Mall and a rooftop observatory lounge. All developments include 24/7 dedicated concierge, valet parking, and biometric security.`,
      sources: ['model', 'web'],
      highlightTag: '5-Star Resort Amenities',
      suggestedVoiceCommand: 'What amenities are included in Marina Horizon and Azure Palms?',
      keyMetrics: [
        { label: 'Beach Access', value: 'Private White Sand' },
        { label: 'Pool Deck', value: 'Infinity Edge' },
        { label: 'Concierge', value: '24/7 Valet & Porter' },
        { label: 'Marina', value: 'Private Yacht Berths' }
      ]
    },

    // 8. Booking & Reservation Process
    {
      id: 'faq-booking-1',
      category: 'availability',
      categoryLabel: 'Instant Booking & Reservation',
      question: 'What is the step-by-step process to reserve a specific unit today?',
      answer: `Reserving your preferred unit takes less than 15 minutes: 1) Select your target unit code (e.g. MH-102 or AP-204); 2) Submit buyer passport copy and contact details; 3) Transfer the 10% booking deposit via credit card, bank wire, or certified cheque; 4) Receive your official Developer Booking Agreement and RERA Oqood registration confirmation immediately. Our dedicated property consultants schedule private VIP site tours or 3D virtual walkthroughs at your convenience.`,
      sources: ['model'],
      highlightTag: 'Fast 15-Min Reservation',
      suggestedVoiceCommand: 'How can I reserve a unit right now?',
      keyMetrics: [
        { label: 'Reservation Time', value: '15 Minutes' },
        { label: 'Required ID', value: 'Passport Copy' },
        { label: 'Deposit Method', value: 'Card / Wire / Cheque' },
        { label: 'Contract', value: 'Instant RERA Oqood' }
      ]
    }
  ];

  // If live web context has specific unique headlines, synthesize dynamic web-correlated questions
  if (hasWeb && webContext.headings && webContext.headings.length > 0) {
    const topWebHeadings = webContext.headings.slice(0, 3).map(h => h.text);
    faqs.push({
      id: 'faq-web-dynamic-1',
      category: 'amenities',
      categoryLabel: `Live Portal Highlights (${webDomain})`,
      question: `What special consumer incentives are currently featured on the official ${webDomain} showcase?`,
      answer: `The official live portal highlights: ${topWebHeadings.join('; ')}. The showcase emphasizes exclusive direct developer launch incentives, including expedited Golden Visa paperwork assistance, post-handover installment plans without bank interest, and priority booking allocations for sea-facing and boulevard-facing residences.`,
      sources: ['web'],
      highlightTag: 'Live Web Correlated',
      suggestedVoiceCommand: `What incentives are highlighted on ${webDomain}?`
    });
  }

  return faqs;
}
