import type { L2Id } from "@/lib/oee/rejectConfigStore";

export const L2_BADGE_CLASS: Record<L2Id, string> = {
  RM: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  RP: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  RS: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
};

export function L2Badge({ l2 }: { l2: L2Id }) {
  return (
    <span
      data-testid={`l2-badge-${l2}`}
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold ${L2_BADGE_CLASS[l2]}`}
    >
      {l2}
    </span>
  );
}
