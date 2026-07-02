import { usePlan } from "../context/PlanContext";
import SelectMenu from "./SelectMenu";

export default function PlanSelect() {
  const { plans, currentPlanId, setCurrentPlanId } = usePlan();

  if (!currentPlanId || plans.length === 0) return null;

  return (
    <SelectMenu
      value={currentPlanId}
      options={plans.map((p) => ({ value: p.id, label: p.name }))}
      onChange={setCurrentPlanId}
      aria-label="切换计划"
      triggerClassName="border-0 bg-transparent py-1 pl-1 pr-5 text-sm font-semibold shadow-none focus:ring-0"
      className="min-w-0 flex-1"
    />
  );
}
