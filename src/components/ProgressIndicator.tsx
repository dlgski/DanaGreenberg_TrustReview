import './ProgressIndicator.css';

interface ProgressIndicatorProps {
  label: string;
  value: number;
  max: number;
}

export function ProgressIndicator({ label, value, max }: ProgressIndicatorProps) {
  return (
    <div className="progress-indicator">
      <div className="progress-indicator__label">
        <span>{label}</span>
        <span>
          {value} / {max}
        </span>
      </div>
      <progress className="progress-indicator__bar" value={value} max={max} />
    </div>
  );
}
