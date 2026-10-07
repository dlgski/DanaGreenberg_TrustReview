import './VarianceSchedule.css';

interface VarianceScheduleProps {
  fieldLabel: string;
  extractedValue: string;
  documentValue: string;
  /** Where the document's number is, e.g. "Consolidated statement of operations, page 3". */
  documentSource: string;
  difference: number;
  code: string;
}

const formatNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });

/** An auditor-style variance: what the model said, what the document says, and the gap. */
export function VarianceSchedule({
  fieldLabel,
  extractedValue,
  documentValue,
  documentSource,
  difference,
  code,
}: VarianceScheduleProps) {
  return (
    <div className="variance-schedule">
      <table className="variance-schedule__table">
        <caption className="visually-hidden">{fieldLabel} variance</caption>
        <tbody>
          <tr>
            <th scope="row">Model extracted, no source cited</th>
            <td>{extractedValue}</td>
          </tr>
          <tr>
            <th scope="row">{documentSource}</th>
            <td>{documentValue}</td>
          </tr>
          <tr className="variance-schedule__difference">
            <th scope="row">Difference</th>
            <td>{formatNumber.format(difference)}</td>
          </tr>
        </tbody>
      </table>
      <p className="variance-schedule__note">
        Check line {code} before deciding. Edit the value if the statement is right.
      </p>
    </div>
  );
}
