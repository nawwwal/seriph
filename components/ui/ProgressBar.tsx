interface ProgressBarProps {
  progress: number; // 0-100
}

export default function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="w-full progress-bar">
      <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}></div>
    </div>
  );
}

