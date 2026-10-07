import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import './Flag.css';

export type FlagTone = 'caution' | 'danger' | 'info';

interface FlagProps {
  tone: FlagTone;
  icon: IconName;
  children: ReactNode;
}

export function Flag({ tone, icon, children }: FlagProps) {
  return (
    <span className={`flag flag--${tone}`}>
      <Icon name={icon} />
      {children}
    </span>
  );
}
