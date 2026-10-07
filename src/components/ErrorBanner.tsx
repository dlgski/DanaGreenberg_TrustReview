import { Button } from './Button';
import './ErrorBanner.css';

interface ErrorBannerProps {
  message: string;
  receivedCount: number;
  totalCount: number;
  onRetry: () => void;
}

export function ErrorBanner({ message, receivedCount, totalCount, onRetry }: ErrorBannerProps) {
  return (
    <div className="error-banner" role="alert">
      <div className="error-banner__text">
        <strong>Extraction job failed.</strong>
        <span>{message}</span>
        <span>
          {receivedCount} of {totalCount} fields were received before the job stopped. The
          document cannot be approved until the remaining fields are extracted.
        </span>
      </div>
      <Button variant="primary" onClick={onRetry}>
        Retry extraction
      </Button>
    </div>
  );
}
