'use client';

// MZAZI TECH — Button.
//
// One component for every action so touch size, focus ring, disabled and
// loading behaviour stay identical across the whole product.
// Renders <a> when `href` is supplied, otherwise <button>.

import Link from 'next/link';
import { Loader } from './Feedback';

const VARIANTS = {
  primary: 'btn btn-primary',
  blue: 'btn btn-blue',
  ghost: 'btn btn-ghost',
  dark: 'btn btn-dark',
  danger: 'btn btn-danger',
};

const SIZES = { sm: 'btn-sm', md: '', lg: 'btn-lg' };

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  href,
  icon = null,
  iconRight = null,
  loading = false,
  loadingText,
  disabled = false,
  block = false,
  type = 'button',
  className = '',
  style,
  ...rest
}) {
  const cls = [
    VARIANTS[variant] || VARIANTS.primary,
    SIZES[size] ?? '',
    block ? 'btn-block' : '',
    className,
  ].filter(Boolean).join(' ');

  const isDisabled = disabled || loading;
  const content = (
    <>
      {loading ? <Loader size={16} /> : icon}
      <span>{loading && loadingText ? loadingText : children}</span>
      {!loading && iconRight}
    </>
  );

  if (href && !isDisabled) {
    return (
      <Link href={href} className={cls} style={style} {...rest}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={cls}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={style}
      {...rest}
    >
      {content}
    </button>
  );
}
