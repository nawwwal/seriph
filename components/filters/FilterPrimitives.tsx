'use client';

import { createContext, use, useMemo, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface ActiveFilterPill {
  key: string;
  label: string;
  onRemove: () => void;
}

interface FilterContextValue {
  state: { activeCount: number };
  actions: { onReset?: () => void };
}

const FilterContext = createContext<FilterContextValue | undefined>(undefined);

function useRequiredFilterContext() {
  const ctx = use(FilterContext);
  if (!ctx) throw new Error('FilterBar compound children must render inside FilterBar.Root');
  return ctx;
}

function Root({ activeCount = 0, onReset, children }: { activeCount?: number; onReset?: () => void; children: ReactNode }) {
  const value = useMemo<FilterContextValue>(() => ({ state: { activeCount }, actions: { onReset } }), [activeCount, onReset]);
  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

function Header() {
  const { state, actions } = useRequiredFilterContext();
  if (state.activeCount === 0 || !actions.onReset) return null;
  return (
    <div className="flex items-center justify-between gap-2 pb-2">
      <span className="rule rounded-[var(--radius)] px-1.5 py-0.5 text-[10px] font-black leading-none">{state.activeCount}</span>
      <Button type="button" onClick={actions.onReset} icon={<X size={14} aria-hidden="true" />} size="clearIcon" tone="plain" aria-label="Clear filters" />
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rule-t pt-3 first:border-t-0 first:pt-0">
      <h3 className="mb-2 text-[10px] font-black uppercase tracking-wide opacity-60">{title}</h3>
      {children}
    </section>
  );
}

function Chip({ label, count, pressed, onClick }: { label: string; count?: number; pressed: boolean; onClick: () => void }) {
  return (
    <Button type="button" aria-pressed={pressed} onClick={onClick} size="filterTiny" tone={pressed ? 'active' : 'plain'}>
      <span>{label}</span>
      {count !== undefined && <span className="ml-1 opacity-60">{count}</span>}
    </Button>
  );
}

export function ActiveFilterPills({ pills, onReset }: { pills: ActiveFilterPill[]; onReset?: () => void }) {
  if (pills.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1.5" aria-label="Active filters">
      {pills.map((pill) => (
        <Button key={pill.key} type="button" size="filterTiny" tone="active" onClick={pill.onRemove}>
          <span>{pill.label}</span>
          <X size={11} className="ml-1" aria-hidden="true" />
        </Button>
      ))}
      {onReset && pills.length > 1 && (
        <Button type="button" size="filterTiny" tone="plain" onClick={onReset}>Clear all</Button>
      )}
    </div>
  );
}

export const FilterBar = { Root, Header, Group, Chip, ActivePills: ActiveFilterPills };
