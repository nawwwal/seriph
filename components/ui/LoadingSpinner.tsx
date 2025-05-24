'use client';

import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'medium', text, className }) => {
  let spinnerSizeClasses = '';
  switch (size) {
    case 'small':
      spinnerSizeClasses = 'w-6 h-6 border-2';
      break;
    case 'large':
      spinnerSizeClasses = 'w-12 h-12 border-4';
      break;
    case 'medium':
    default:
      spinnerSizeClasses = 'w-8 h-8 border-4';
      break;
  }

  return (
    <div className={`flex flex-col items-center justify-center p-4 ${className || ''}`}>
      <div
        className={`animate-spin rounded-full border-blue-500 border-t-transparent ${spinnerSizeClasses}`}
        role="status"
      >
        <span className="sr-only">Loading...</span>
      </div>
      {text && <p className="mt-3 text-lg text-gray-600">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
