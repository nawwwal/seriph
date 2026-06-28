const ICON_PROPS = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 64,
  height: 64,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const STEPS = [
  {
    n: 1,
    title: 'Drop them in',
    body: 'Click "Add Fonts" or drag font files straight into the dropzone below.',
    paths: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </>
    ),
  },
  {
    n: 2,
    title: 'Grouped for you',
    body: 'Styles snap into families, each with its own generated cover.',
    paths: (
      <>
        <line x1="4" y1="9" x2="20" y2="9" />
        <line x1="4" y1="15" x2="20" y2="15" />
        <line x1="10" y1="3" x2="8" y2="21" />
        <line x1="16" y1="3" x2="14" y2="21" />
      </>
    ),
  },
  {
    n: 3,
    title: 'Find by feeling',
    body: 'Browse covers and spines, or search your type by mood and intent.',
    paths: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </>
    ),
  },
];

export default function WelcomeSteps() {
  return (
    <div className="grid md:grid-cols-3 gap-6">
      {STEPS.map((step) => (
        <div key={step.n} className="flex flex-col items-center text-center p-6 rule rounded-[var(--radius)]">
          <div className="step-number">{step.n}</div>
          <h3 className="text-xl font-bold mt-4 mb-2">{step.title}</h3>
          <p className="mb-4">{step.body}</p>
          <div className="mt-2">
            <svg {...ICON_PROPS}>{step.paths}</svg>
          </div>
        </div>
      ))}
    </div>
  );
}
