export type ShiftItem = {
  id: string;
  name: string;
  startTime: string; // e.g. "07:00"
  endTime: string; // e.g. "15:00"
  label: string; // e.g. "Shift 1 (07:00 – 15:00)"
  isCurrent: boolean;
  dateStr: string;
};

export function getMockShifts(): ShiftItem[] {
  // Prototype static date: Friday, 6 November 2026
  return [
    {
      id: "shift-3-current",
      name: "Shift 3",
      startTime: "23:00",
      endTime: "07:00",
      label: "Shift test 3 (23:00 – 09:30)",
      isCurrent: true,
      dateStr: "Friday, 6 Nov 2026",
    },
    {
      id: "shift-2-prev",
      name: "Shift 2",
      startTime: "15:00",
      endTime: "23:00",
      label: "Shift 2 (15:00 – 23:00)",
      isCurrent: false,
      dateStr: "Thursday, 5 Nov 2026",
    },
    {
      id: "shift-1-prev",
      name: "Shift 1",
      startTime: "07:00",
      endTime: "15:00",
      label: "Shift 1 (07:00 – 15:00)",
      isCurrent: false,
      dateStr: "Thursday, 5 Nov 2026",
    },
  ];
}
