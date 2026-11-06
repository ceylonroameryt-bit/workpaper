import React from 'react';

interface AvatarProps {
  name: string;
  avatarUrl?: string;
  initials?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  roleTitle?: string;
  isTest?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  avatarUrl,
  initials,
  size = 'md',
  className = '',
  roleTitle,
  isTest,
}) => {
  const cleanName = name.replace(/\(Test\)/gi, '').trim();
  const computedInitials =
    initials ||
    cleanName
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const isTestAccount = isTest ?? name.toLowerCase().includes('test');

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-xs',
    lg: 'w-11 h-11 text-sm',
  };

  const tooltip = isTestAccount
    ? `[Test User] ${name}${roleTitle ? ` (${roleTitle})` : ''}`
    : roleTitle
    ? `${name} (${roleTitle})`
    : name;

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full bg-[#EAF5FC] text-[#1D4E89] font-semibold border border-[#D3DCEE]/60 shrink-0 overflow-hidden select-none ${sizeClasses[size]} ${className}`}
      title={tooltip}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            // fallback to initials on load failure
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : null}
      <span className="sr-only">{name}</span>
      <span aria-hidden="true">{computedInitials}</span>
    </div>
  );
};
