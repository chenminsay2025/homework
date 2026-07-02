import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import type { Plan } from "../types";

const STORAGE_KEY = "homework_current_plan_id";

interface PlanContextValue {
  plans: Plan[];
  currentPlan: Plan | null;
  currentPlanId: number | null;
  loading: boolean;
  setCurrentPlanId: (id: number) => void;
  refreshPlans: () => Promise<void>;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanIdState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshPlans = useCallback(async () => {
    const list = await api.getPlans();
    setPlans(list);
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedId = stored ? Number(stored) : null;
    const validId = list.find((p) => p.id === storedId)?.id ?? list[0]?.id ?? null;
    setCurrentPlanIdState(validId);
    if (validId) localStorage.setItem(STORAGE_KEY, String(validId));
  }, []);

  useEffect(() => {
    refreshPlans().finally(() => setLoading(false));
  }, [refreshPlans]);

  const setCurrentPlanId = (id: number) => {
    setCurrentPlanIdState(id);
    localStorage.setItem(STORAGE_KEY, String(id));
  };

  const currentPlan = plans.find((p) => p.id === currentPlanId) ?? null;

  return (
    <PlanContext.Provider
      value={{ plans, currentPlan, currentPlanId, loading, setCurrentPlanId, refreshPlans }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}
