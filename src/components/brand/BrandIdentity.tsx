import React from 'react';

export const HERBAL_VITALY = {
  name: 'Herbal Vitaly',
  application: 'Herbal Vitaly Affiliate Hub',
  tagline: 'Let nature be your medicine',
  primary: '#1F6B3A',
  logo: 'https://cdn.shopify.com/s/files/1/1003/9420/5506/files/herbal-vitaly-affiliate-official-logo.png?v=1793365508',
} as const;

/** Uses the original transparent Herbal Vitaly logo, not a redrawn symbol. */
export function BrandIdentity({
  compact = false,
  align = 'center',
  className = '',
}: {
  compact?: boolean;
  align?: 'center' | 'start';
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col ${align === 'center' ? 'items-center text-center' : 'items-start text-left'} ${className}`}>
      <img
        src={HERBAL_VITALY.logo}
        alt="Herbal Vitaly — Let nature be your medicine"
        width={compact ? 148 : 210}
        height={compact ? 105 : 148}
        className={compact ? 'h-auto max-h-[74px] w-[148px] object-contain object-left' : 'h-auto max-h-[156px] w-[210px] object-contain'}
        loading="eager"
      />
      {!compact && <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary sm:text-sm">Affiliate Hub</p>}
    </div>
  );
}
