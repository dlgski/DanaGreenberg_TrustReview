import './FieldSkeleton.css';

export function FieldSkeleton() {
  return (
    <div className="field-skeleton" aria-hidden="true">
      <div className="field-skeleton__tick" />
      <div className="field-skeleton__body">
        <div className="field-skeleton__label" />
        <div className="field-skeleton__value" />
      </div>
    </div>
  );
}
