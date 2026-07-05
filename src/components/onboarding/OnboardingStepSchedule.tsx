import type { TimeSlot } from "../../types";
import { WeeklyScheduleEditor } from "../WeeklyScheduleEditor";

interface Props {
  value: Partial<Record<number, TimeSlot[]>>;
  onChange: (value: Partial<Record<number, TimeSlot[]>>) => void;
  hasError: boolean;
}

export function OnboardingStepSchedule({ value, onChange, hasError }: Props) {
  return (
    <section className="card">
      <WeeklyScheduleEditor value={value} onChange={onChange} showInitialSlots hasError={hasError} />
    </section>
  );
}
