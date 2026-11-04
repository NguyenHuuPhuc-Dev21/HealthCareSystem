import type { ReactNode } from 'react';
import { Check } from 'lucide-react';

export type StepStatus = 'done' | 'now' | 'todo';

interface StepperProps {
  steps: Array<{ title: string; status: StepStatus }>;
}

/** Thanh 3 bước đầu trang SH3. */
export function Stepper({ steps }: StepperProps) {
  return (
    <ol className="stepper" aria-label="Tiến trình thiết lập">
      {steps.map((step, i) => (
        <li key={step.title} className={`st ${step.status}`} aria-current={step.status === 'now' ? 'step' : undefined}>
          <span className="st__n" aria-hidden="true">{step.status === 'done' ? <Check size={14} /> : i + 1}</span>
          <span>
            <small>Bước {i + 1}{step.status === 'now' ? ' · Đang thực hiện' : ''}</small>
            <b>{step.title}</b>
          </span>
        </li>
      ))}
    </ol>
  );
}

interface StepSummaryProps {
  n: number;
  done?: boolean;
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
}

/** Thẻ 1 dòng cho bước đã xong (✓) hoặc chưa mở (số mờ). */
export function StepSummary({ n, done = false, title, description, action }: StepSummaryProps) {
  return (
    <div className={`card step-summary${done ? '' : ' step-summary--locked'}`}>
      <span className="step-summary__n" aria-hidden="true">{done ? <Check size={14} /> : n}</span>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action && <div className="step-summary__edit">{action}</div>}
    </div>
  );
}
