import type { StreamScenario } from '../lib/streamExtraction';
import './ScenarioControl.css';

interface ScenarioControlProps {
  value: StreamScenario;
  onChange: (value: StreamScenario) => void;
}

const OPTIONS: { value: StreamScenario; label: string }[] = [
  { value: 'success', label: 'Succeeds (~10s)' },
  { value: 'fails-partway', label: 'Fails partway through' },
  { value: 'slow', label: 'Slow (~24s)' },
];

export function ScenarioControl({ value, onChange }: ScenarioControlProps) {
  return (
    <label className="scenario-control">
      <span className="scenario-control__label">Dev: simulate job</span>
      <select
        className="scenario-control__select"
        value={value}
        onChange={(e) => onChange(e.target.value as StreamScenario)}
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
