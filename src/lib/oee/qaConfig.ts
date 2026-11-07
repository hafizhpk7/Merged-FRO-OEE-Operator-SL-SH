/**
 * QA Inspection Alert Configuration and Trigger Logic (§3.4)
 */

export type QaCategoryRule = {
  minMpq: number;
  maxMpq: number;
  intervalPcs: number;
  categoryName: string;
};

export const QA_CATEGORY_RULES: QaCategoryRule[] = [
  { minMpq: 1, maxMpq: 699, intervalPcs: 50, categoryName: "Kategori 1 (1 - 699 pcs)" },
  { minMpq: 700, maxMpq: 2999, intervalPcs: 100, categoryName: "Kategori 2 (700 - 2,999 pcs)" },
  {
    minMpq: 3000,
    maxMpq: 150000,
    intervalPcs: 200,
    categoryName: "Kategori 3 (3,000 - 150,000 pcs)",
  },
];

export function getQaIntervalForMpq(mpq: number): number {
  for (const rule of QA_CATEGORY_RULES) {
    if (mpq >= rule.minMpq && mpq <= rule.maxMpq) {
      return rule.intervalPcs;
    }
  }
  return 200; // default
}
