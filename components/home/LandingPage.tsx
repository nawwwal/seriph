'use client';

import Link from 'next/link';
import { DEMO_SPECIMENS, VALUE_PROPS } from './landingContent';

export default function LandingPage() {
  return (
    <div className="flex-1 min-h-0 w-full p-8 sm:p-10 md:p-12 lg:p-16 overflow-auto">
        {/* Hero */}
        <header className="w-full rule-b pb-6 sm:pb-8">
          <h1 className="cap-tight uppercase font-black tracking-tight text-[clamp(56px,11vw,180px)] leading-[0.85]">
            Seriph
          </h1>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <p className="max-w-2xl text-lg sm:text-xl md:text-2xl tracking-tight">
              A visual, semantically searchable home for your type. Turn a scattered attic of
              font files into a library you can actually see and search.
            </p>
            <Link
              href="/login"
              className="shrink-0 uppercase font-bold rule px-5 py-3 rounded-[var(--radius)] text-base btn-ink ink-bg shimmer"
            >
              Sign in <span className="caret"></span>
            </Link>
          </div>
        </header>

        {/* Live specimen showcase */}
        <section className="mt-8 sm:mt-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {DEMO_SPECIMENS.map((spec) => (
              <div
                key={spec.label}
                className="rule rounded-[var(--radius)] overflow-hidden flex flex-col"
              >
                <div className="flex-1 flex items-end p-6 min-h-[140px]">
                  <div
                    className="leading-none font-black uppercase tracking-tight text-[18vw] sm:text-[10vw] lg:text-[5vw]"
                    style={{ fontWeight: spec.weight, fontStyle: spec.italic ? 'italic' : 'normal' }}
                  >
                    {spec.sample}
                  </div>
                </div>
                <div className="rule-t p-3 bg-[var(--paper)] uppercase text-xs font-bold opacity-80">
                  {spec.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Value props */}
        <section className="mt-10 sm:mt-12 grid md:grid-cols-3 gap-6 sm:gap-8">
          {VALUE_PROPS.map((prop) => (
            <div key={prop.step} className="p-6 rule rounded-[var(--radius)] flex flex-col">
              <div className="uppercase text-xs font-bold opacity-60">{prop.step}</div>
              <h3 className="mt-2 text-2xl font-black uppercase tracking-tight cap-tight">
                {prop.title}
              </h3>
              <p className="mt-3 text-base leading-snug">{prop.body}</p>
            </div>
          ))}
        </section>

        {/* Closing CTA */}
        <section className="mt-10 sm:mt-12 rule-t pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-lg sm:text-xl font-bold uppercase tracking-tight">
            Your fonts, finally findable.
          </p>
          <Link
            href="/login"
            className="shrink-0 uppercase font-bold rule px-5 py-3 rounded-[var(--radius)] text-base btn-ink"
          >
            Get started <span className="caret"></span>
          </Link>
        </section>

        <footer className="mt-10 sm:mt-12 rule-t pt-4 text-sm opacity-70">
          One color, many voices. Pick a theme up top and make it yours.
        </footer>
    </div>
  );
}
