import React from 'react';
import { StatusKey, STATUS_DEFINITIONS } from '@/lib/types/models';

export interface StatusBadgeProps {
  status: StatusKey | string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusPill: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  className = '',
}) => {
  // Normalize status string
  const normalizedKey = (
    status === 'Not started' || status === 'not_started'
      ? 'not_started'
      : status === 'In progress' || status === 'in_progress' || status === 'Fieldwork' || status === 'Planning'
      ? 'in_progress'
      : status === 'Unreconciled' || status === 'unreconciled'
      ? 'unreconciled'
      : status === 'Reconciled' || status === 'reconciled'
      ? 'reconciled'
      : status === 'Prepared' || status === 'prepared'
      ? 'prepared'
      : status === 'Signed off' || status === 'signed_off' || status === 'Reviewed' || status === 'Confirmed' || status === 'Done' || status === 'Approved' || status === 'Posted'
      ? 'signed_off'
      : status === 'Needs you' || status === 'needs_you' || status === 'Needs category' || status === 'Needs attention' || status === 'Differs' || status === 'Blocked' || status === 'Open'
      ? 'needs_you'
      : status === 'Stale' || status === 'stale'
      ? 'stale'
      : status === 'Waiting on client' || status === 'waiting_on_client' || status === 'Waiting on me'
      ? 'waiting_on_client'
      : status === 'AI suggestion' || status === 'AI suggested' || status === 'ai_suggestion'
      ? 'ai_suggestion'
      : 'not_started'
  ) as StatusKey;

  const def = STATUS_DEFINITIONS[normalizedKey] || STATUS_DEFINITIONS.not_started;
  const displayLabel = label || def.label;

  const sizeStyles =
    size === 'sm'
      ? 'px-2 py-0.5 text-[11px] leading-4'
      : 'px-2.5 py-1 text-xs leading-4 min-h-[26px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border border-black/5 shrink-0 select-none ${sizeStyles} ${def.bgClass} ${def.colorClass} ${className}`}
    >
      <span aria-hidden="true" className="font-bold text-xs">
        {def.symbol}
      </span>
      <span>{displayLabel}</span>
    </span>
  );
};

export const StatusBadge = StatusPill;
