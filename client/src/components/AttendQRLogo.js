import React from 'react';

export default function AttendQRLogo({ size = 40, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="capGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>

      {/* Rounded square background */}
      <rect x="0" y="0" width="100" height="100" rx="20" fill="url(#logoGradient)" />

      {/* QR Code pattern elements */}
      <rect x="15" y="15" width="12" height="12" rx="2" fill="white" />
      <rect x="15" y="30" width="12" height="8" rx="1.5" fill="white" opacity="0.8" />
      <rect x="30" y="15" width="8" height="12" rx="1.5" fill="white" opacity="0.8" />

      <rect x="73" y="15" width="12" height="12" rx="2" fill="white" />
      <rect x="73" y="30" width="12" height="8" rx="1.5" fill="white" opacity="0.8" />
      <rect x="60" y="15" width="10" height="10" rx="1.5" fill="white" opacity="0.7" />

      <rect x="15" y="73" width="12" height="12" rx="2" fill="white" />
      <rect x="30" y="73" width="8" height="12" rx="1.5" fill="white" opacity="0.8" />
      <rect x="15" y="60" width="12" height="10" rx="1.5" fill="white" opacity="0.7" />

      {/* Center pattern */}
      <circle cx="48" cy="48" r="3" fill="white" opacity="0.9" />
      <circle cx="58" cy="52" r="2.5" fill="white" opacity="0.8" />
      <circle cx="40" cy="55" r="2.5" fill="white" opacity="0.8" />
      <rect x="48" y="58" width="6" height="6" rx="1" fill="white" opacity="0.7" />
      <rect x="38" y="45" width="5" height="5" rx="1" fill="white" opacity="0.7" />

      {/* Graduation cap */}
      <g transform="translate(55, 60)">
        <path d="M 4 8 L 20 2 L 36 8 L 20 14 Z" fill="url(#capGradient)" />
        <ellipse cx="20" cy="8" rx="16" ry="4" fill="url(#capGradient)" opacity="0.9" />
        <line x1="32" y1="8" x2="36" y2="14" stroke="url(#capGradient)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="36" cy="15" r="2" fill="url(#capGradient)" />
      </g>

      {/* Checkmark */}
      <path d="M 70 70 L 75 75 L 83 65" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
