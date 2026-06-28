# Seriph — Product Context

> Source of truth for *why Seriph exists* and *how it should feel*. Architecture
> and stack decisions live in [architecture.md](./architecture.md) and
> [models-and-stack.md](./models-and-stack.md). Routed from
> [AGENTS.md](./AGENTS.md).

## The problem (the origin story)

I have **tonnes of font files** accumulated over years, sitting in an "attic" —
scattered across hard drives, archives, and folders I never open. They are
effectively invisible:

- I don't know *which* fonts I even own.
- I can't *see* what they look like without installing them one by one.
- I can't tell what *family* a loose file belongs to.
- I have no idea what *features* (OpenType features, stylistic sets), *character
  coverage*, *scripts*, or *technology* (variable axes, color, etc.) each one has.
- When I'm building something and need "a warm editorial serif" or "a font with
  the energy of a 90s ski poster," I have no way to find it in my own collection.

So they rot. I end up reaching for the same handful of Google Fonts instead of
the library I already paid for and collected.

## What Seriph is

Seriph is the place where that attic becomes a **living, visual, searchable
library**. Upload a font (or a pile of them) and Seriph:

1. **Shows it to you** — rendered specimens, glyphs, the full character set,
   weights/styles, variable-font axes you can play with live.
2. **Understands it** — groups loose files into the right family, classifies it,
   and runs an enrichment layer that describes its *mood*, *voice*, *good use
   cases*, and *pairings*.
3. **Makes it usable** — every font has a stable URL you can copy or download,
   so you go from "I think I own something like that" to "it's in my project" in
   seconds.
4. **Lets you search it the way you think** — not just by name, but by *vibe*:
   "geometric sans with a friendly lowercase," "something that feels like a legal
   document," "pairs well with this display face."

## The two audiences

Seriph is built for **two kinds of users**, and the second one is the long game:

1. **Me (the human).** Browse, rediscover, play with, and grab fonts from my own
   collection. Visual-first, fast, delightful.
2. **Agents (the future wedge).** The software I build has agents that need to
   *choose type*. Seriph becomes the typographic backend they query: "given this
   brand mood / this product, what fonts in the library fit, and what pairs with
   what?" They search by semantics, get back reasoned matches, and use the actual
   font assets directly. See [search-and-agents.md](./search-and-agents.md).

## Product principles

- **Visual-first, always.** The font itself — rendered, interactive — is the
  hero. Metadata supports the picture; it never replaces it.
- **The front-end design is sacred.** The current UI/aesthetic is *not* up for
  redesign. Everything behind it is open to change; the look and feel is the one
  fixed point. Treat the existing visual language as a constraint, not a draft.
- **Instant usability.** A font in Seriph is always one copy/click from being
  used elsewhere (stable storage URL, downloadable). Storage and accessibility
  come before enrichment — a font is useful the moment it's uploaded, and gets
  *richer* over time.
- **Semantics over tags.** Tag taxonomies are a means, not the end. The goal is
  retrieval by meaning/mood/intent, backed by embeddings and reasoning — not a
  rigid folksonomy the user has to learn.
- **Enrichment is progressive, not blocking.** Analysis runs asynchronously and
  enhances a font over time. Nothing in the core "see it / grab it" loop waits on
  an AI call.

## The reframe (why we're rethinking the architecture)

The original enrichment pipeline was designed when models were weak: it leaned on
many brittle stages, hand-rolled prompts, web-scraping enrichment, and rigid
taxonomies to squeeze signal out of models that couldn't see or reason well.

**The world has changed.** Modern multimodal models can *look at a specimen* and
describe it better than our staged pipeline ever did, and natively-multimodal
embeddings let us search a font's actual *appearance* by language. So the new
architecture is simpler and stronger: render the font, let a strong multimodal
model see and describe it, embed image + description into one space, and search
that. We keep what still earns its place (deterministic parsing, family grouping,
structured outputs, kill-switches) and drop the scaffolding the old models needed.

## Definition of done (product-level)

A feature is "done" in Seriph when:

- It preserves the existing front-end feel.
- A font remains instantly viewable and downloadable throughout.
- Enrichment never blocks the core loop and fails safe (a font is never *worse*
  than its deterministic metadata).
- New retrievable signal is actually *searchable* (it lands in the search/embedding
  layer), not just stored.
