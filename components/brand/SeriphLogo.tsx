type SeriphLogoProps = {
  className?: string;
  label?: string;
};

export default function SeriphLogo({ className, label }: SeriphLogoProps) {
  return (
    <span className={`inline-block ${className ?? ''}`} role={label ? 'img' : undefined} aria-label={label}>
      <span
        aria-hidden="true"
        className="block w-full"
        style={{
          aspectRatio: '193 / 48',
          backgroundColor: 'currentColor',
          maskImage: "url('/seriph-logo.svg')",
          maskPosition: 'center',
          maskRepeat: 'no-repeat',
          maskSize: 'contain',
          WebkitMaskImage: "url('/seriph-logo.svg')",
          WebkitMaskPosition: 'center',
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskSize: 'contain',
        }}
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
