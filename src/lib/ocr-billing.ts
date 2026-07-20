import type { BillingSettings } from "./types";

export type OcrAddonPlan = {
  id: string;
  label: string;
  addedLimit: number;
  price: number;
};

export const ocrAddonPlans: OcrAddonPlan[] = [
  { id: "ocr-10", label: "10枚追加", addedLimit: 10, price: 150 },
  { id: "ocr-30", label: "30枚追加", addedLimit: 30, price: 350 },
  { id: "ocr-50", label: "50枚追加", addedLimit: 50, price: 550 },
  { id: "ocr-120", label: "120枚追加", addedLimit: 120, price: 1000 },
];

function formatLocalDate(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
}

function endOfMonthDay(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function billingPeriodKey(anchorDate?: string | null, at = new Date()) {
  if (!anchorDate) return at.toISOString().slice(0, 7);
  const anchor = new Date(anchorDate);
  if (Number.isNaN(anchor.getTime())) return at.toISOString().slice(0, 7);
  const anchorDay = anchor.getDate();
  const year = at.getFullYear();
  const month = at.getMonth();
  const day = Math.min(anchorDay, endOfMonthDay(year, month));
  let periodStart = new Date(year, month, day);
  if (at < periodStart) {
    const previousMonth = month - 1;
    const previousYear = previousMonth < 0 ? year - 1 : year;
    const normalizedMonth = previousMonth < 0 ? 11 : previousMonth;
    periodStart = new Date(previousYear, normalizedMonth, Math.min(anchorDay, endOfMonthDay(previousYear, normalizedMonth)));
  }
  return formatLocalDate(periodStart);
}

export function billingPeriodLabel(periodKey: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(periodKey)) return `${periodKey}開始分`;
  return `${periodKey}分`;
}

export function isPaidPlan(plan?: string | null, subscriptionStatus?: string | null) {
  if (plan === "free") return false;
  if (["past_due", "canceled", "suspended"].includes(String(subscriptionStatus || ""))) return false;
  return ["trial", "standard", "pro", "setup_support"].includes(String(plan || "")) && ["active", "trialing"].includes(String(subscriptionStatus || ""));
}

export function ocrAddonStats(billing: BillingSettings, billingKey: string) {
  const history = (billing.ocrAddonHistory || []).filter((record) => record.billingMonth === billingKey);
  const historyLimit = history.reduce((sum, record) => sum + (Number(record.addedLimit) || 0), 0);
  const historyCharge = history.reduce((sum, record) => sum + (Number(record.price) || 0), 0);
  if (history.length > 0) {
    return { addonCount: history.length, addedLimit: historyLimit, addonCharge: historyCharge };
  }
  const legacyPacks = Number(billing.ocrAddonPacks) || 0;
  return {
    addonCount: legacyPacks,
    addedLimit: legacyPacks * (Number(billing.ocrAddonPackSize) || 0),
    addonCharge: legacyPacks * (Number(billing.ocrAddonPrice) || 0),
  };
}
