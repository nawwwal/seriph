'use client';

import { AnalysisState } from '@/models/ingest.models';
import { Hourglass, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface AnalysisStateIndicatorProps {
  analysisState: AnalysisState;
  showSteps?: boolean;
  className?: string;
}

const ANALYSIS_STEPS: Record<AnalysisState, { label: string; icon: React.ReactNode }> = {
  not_started: {
    label: 'Not Started',
    icon: <Hourglass className="text-gray-400" size={16} />,
  },
  queued: {
    label: 'Queued',
    icon: <Hourglass className="text-blue-500 animate-spin" size={16} />,
  },
  analyzing: {
    label: 'Analyzing',
    icon: <Loader2 className="text-blue-500 animate-spin" size={16} />,
  },
  enriching: {
    label: 'Enriching',
    icon: <Loader2 className="text-purple-500 animate-spin" size={16} />,
  },
  complete: {
    label: 'Complete',
    icon: <CheckCircle2 className="text-green-500" size={16} />,
  },
  error: {
    label: 'Error',
    icon: <AlertTriangle className="text-red-500" size={16} />,
  },
  retrying: {
    label: 'Retrying',
    icon: <Loader2 className="text-orange-500 animate-spin" size={16} />,
  },
  quarantined: {
    label: 'Quarantined',
    icon: <AlertTriangle className="text-yellow-500" size={16} />,
  },
};

const STEP_ORDER: AnalysisState[] = ['queued', 'analyzing', 'enriching', 'complete'];

export default function AnalysisStateIndicator({
  analysisState,
  showSteps = false,
  className = '',
}: AnalysisStateIndicatorProps) {
  const step = ANALYSIS_STEPS[analysisState] || ANALYSIS_STEPS.not_started;
  const currentStepIndex = STEP_ORDER.indexOf(analysisState);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {step.icon}
      <span className="text-sm font-medium">{step.label}</span>
      {showSteps && currentStepIndex >= 0 && (
        <div className="flex items-center gap-1 ml-2 text-xs opacity-70">
          {STEP_ORDER.map((s, idx) => (
            <span
              key={s}
              className={
                idx <= currentStepIndex
                  ? 'font-bold'
                  : idx === currentStepIndex + 1
                  ? 'opacity-50'
                  : 'opacity-30'
              }
            >
              {idx > 0 && ' → '}
              {ANALYSIS_STEPS[s].label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

