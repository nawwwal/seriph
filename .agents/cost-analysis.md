# Seriph — Cost Analysis (font processing)

> Bottom-up model of what it costs to **process** fonts through the pipeline
> (ingest → store → enrich → index). Serving/egress (traffic-driven) is modelled
> separately at the end. Rates checked 2026-06-28; see [Rate card](#rate-card).
> All prices USD, `asia-southeast1`/regional-Standard assumptions noted inline.

## TL;DR

- The pipeline is **AI-dominated**. At realistic volumes everything except Vertex
  AI sits inside Google's monthly free tiers (≈ **$0**).
- Blended cost is **~$0.0005–0.0008 per font file processed**, i.e.
  **~$0.0021 per family** (one multimodal analysis + one embedding).
- Rule of thumb: **~$0.55 per 1,000 fonts**, **~$5.50 per 10,000**, **~$77 per
  100,000** per month (all-in, processing only).
- Two optimizations already shipped cut this hard: **Batch API** (~50% off the
  analysis call) and the **per-family idempotency guard** (was up to ~4× when a
  family re-enriched once per face).

---

## Methodology & assumptions

The unit a user thinks in is a **font file** (one face: Regular, Bold, …). AI
enrichment runs once **per family**, not per face, so family count drives AI cost.

| Assumption | Value | Notes |
|---|---|---|
| Faces per family (avg) | **4** | biggest lever on per-font AI cost |
| Analysis input tokens / family | **~1,000** | ~400 prompt + **516 image** + schema |
| Analysis output tokens / family | **~300** | structured JSON (moods, summary, …) |
| Embedding tokens / family | **~150** | enrichment text, inline (not batched) |
| Specimen image | 1024×576 PNG | → `ceil(1024/768)·ceil(576/768)·258 = 2·1·258 = 516` tokens |
| Font file size | 0.30 MB original + 0.15 MB woff2 | 0.45 MB stored per face |
| Ingest compute | expandArchive ~1.5 s, processUpload ~3.5 s | 1 GiB, **cpu 2** |
| Enrich compute | submit ~0.5 s/family, poll ~1 s/family | scheduled; `minInstances=0` |
| Schedulers | poll /10 min, submit /30 min | fixed idle invocations |

Compute durations are estimates (±50%); they only matter at the very top of the
table because functions stay free-tier until ~17k fonts/mo.

---

## Rate card

| Service | Rate | Free tier (monthly) |
|---|---|---|
| **Gemini 3.5 Flash** (analysis) | $1.50 / $9.00 per 1M in/out · **Batch: $0.75 / $4.50** | — |
| **gemini-embedding-2** | $0.20 per 1M input tokens | — |
| **Cloud Run** (gen2 functions) | $0.000024/vCPU-s · $0.0000025/GiB-s · $0.40/1M req | 180k vCPU-s · 360k GiB-s · 2M req |
| **Firestore** | $0.03/100k reads · $0.09/100k writes · $0.01/100k deletes · $0.15/GB-mo | 50k read·20k write·20k delete **per day** · 1 GB |
| **Cloud Storage** (Standard, regional) | $0.020/GB-mo · Class A $0.05/10k · Class B $0.004/10k | 5 GB-mo · some ops |
| **Cloud Scheduler** | $0.10/job/mo | **3 jobs free** (we use 2 → $0) |
| **Egress** (serving) | Firebase Hosting $0.15/GB (10 GB/mo free) · Cloud Run $0.12/GB | 10 GB Hosting |

Sources: Gemini/Vertex pricing, Cloud Run, Firestore, Cloud Storage, image
tokenization — see [References](#references).

---

## Per-unit derivation

### 1. Vertex AI (the dominant cost) — per **family**

Analysis via **Batch API** (50% off; our all-batch lane):

```
input :  1,000 tok × $0.75 / 1e6  = $0.000750
output:    300 tok × $4.50 / 1e6  = $0.001350
embed :    150 tok × $0.20 / 1e6  = $0.000030   (inline, standard)
                                   ----------
analysis + embed per family       ≈ $0.00213
```

Per **font file** (÷4 faces) ≈ **$0.00053**.

> **Batch vs realtime:** realtime analysis would be `1000×$1.50 + 300×$9.00`
> = $0.00420/family → **batch nearly halves AI** ($0.00213 vs $0.00435/family).
> At 100k fonts/mo that's **~$52 vs ~$104** — batch saves ~$52/mo.

> **Idempotency guard:** before the F1 fix a 4-face family re-enriched up to 4×
> (the family doc is written once per face). That made AI cost ~per-face, i.e.
> up to **4× higher**. The guard pins it to one analysis per family.

### 2. Cloud Functions — per font + fixed

```
vCPU-s ≈ 10.5·N + 2,800      (ingest 10/font + enrich 2/family + idle schedulers)
GiB-s  ≈  5.25·N + 1,400
req    ≈     2·N + 5,950
free   :  180,000 vCPU-s · 360,000 GiB-s · 2,000,000 req
```

vCPU-seconds is the binding constraint; it crosses the free tier at
**N ≈ 16,900 fonts/mo**. Below that, **functions are $0**.

### 3. Firestore — per font

~6 writes + ~3 reads + ~1 delete per font (family upsert, ingest doc + state
transitions, enrichment write, finalize, vector index entry). Monthly free ≈
620k writes / 1.55M reads / 620k deletes. Writes bind at **N ≈ 103k fonts/mo** →
Firestore is effectively **$0 through ~100k fonts/mo**.

### 4. Cloud Storage — per font

`0.45 MB × $0.020/GB` for the month it's added **+** ~5 Class-A ops × $0.05/10k
≈ **$0.000034/font**. Note storage is **cumulative**: a standing library of *L*
fonts costs `L × 0.45 MB × $0.020/GB-mo` (≈ **$9/mo per 1M fonts** stored).
Batch JSONL IO auto-expires after 7 days (lifecycle rule) → negligible.

### 5. Cloud Scheduler

2 jobs ≤ 3 free → **$0**.

---

## Monthly cost by volume (processing only)

Fonts processed in the month → all-in processing cost:

| Fonts / mo | Families | Vertex AI | Functions | Firestore | Storage* | **Total** | **$/font** |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 25 | $0.05 | $0 | $0 | $0.003 | **$0.06** | $0.0006 |
| 1,000 | 250 | $0.53 | $0 | $0 | $0.03 | **$0.56** | $0.0006 |
| 10,000 | 2,500 | $5.25 | $0 | $0 | $0.34 | **$5.6** | $0.0006 |
| 50,000 | 12,500 | $26.25 | $8.35 | $0 | $1.70 | **$36.3** | $0.0007 |
| 100,000 | 25,000 | $52.50 | $21.37 | ~$0 | $3.40 | **$77.3** | $0.0008 |

\* Storage = that month's newly-added fonts only; the standing library adds
~$9/mo per 1M fonts on top, every month.

**Reading it:** up to ~10k fonts/mo you're paying **only for Vertex AI** (a few
dollars), everything else is free-tier. Functions start to bill past ~17k/mo;
Firestore past ~100k/mo. Even at 100k fonts/mo the whole pipeline is **< $80**.

---

## Sensitivity — what moves the number

- **Faces per family** is the #1 lever. AI per font = `$0.00213 / faces_per_family`.
  Families of 8 → ~$0.00027/font; families of 1 (single-weight display fonts) →
  ~$0.00213/font (4× the table). Real "attic" dumps skew toward multi-weight
  families, which is favorable.
- **Output tokens** dominate AI (output is 6× the input rate). The 300-token
  structured response is already tight; don't let summaries balloon.
- **Image size**: 1024×576 = 2 tiles = 516 tokens. Going ≤768px wide would drop
  it to 1 tile (258 tok) — but we deliberately keep the larger specimen for
  analysis quality (saving is ~$0.0002/family, not worth the quality risk).
- **Realtime vs batch**: flipping `enrich_batch_enabled` off (realtime) roughly
  doubles AI cost for instant enrichment. Batch is the default.

---

## Serving & egress (separate axis — traffic, not processing)

Independent of how many fonts you *process*; driven by how many are *viewed*:

- **Font delivery**: woff2 ~150 KB, served via the Firebase Hosting CDN
  (immutable, 1-year cache). ~**$0.15/GB** egress after 10 GB/mo free.
  → 1M font-views/mo ≈ 150 GB ≈ **~$21/mo** (less, as the CDN absorbs repeat hits).
- **Search**: query embedding (~20 tok → ~$0.000004) + a Firestore vector
  `findNearest` read of K candidates per query. Negligible per query.
- **CSS / metadata**: `/css2` is a tiny Firestore batch read per request; cached.

If serving traffic grows, egress becomes the next line to watch — but it tracks
audience size, not catalogue size.

---

## One-time / non-volume costs

- **Deploys**: Cloud Build (~free tier 120 build-min/day) — dev-time only.
- **Vector index**: storage proportional to family count (2048 floats/family),
  rolled into Firestore storage; negligible at these volumes.
- **No always-on resources**: every function has `minInstances=0` (scales to
  zero, $0 idle); no Vertex Vector Search endpoint; 2 schedulers within free tier.

---

## References

- [Gemini 3.5 Flash pricing (May 2026 guide)](https://www.metacto.com/blogs/the-true-cost-of-google-gemini-a-guide-to-api-pricing-and-integration)
- [Vertex AI pricing](https://cloud.google.com/vertex-ai/pricing)
- [Gemini Batch API (50% off)](https://developers.googleblog.com/en/gemini-batch-api-now-supports-embeddings-and-openai-compatibility/)
- [Gemini embedding pricing](https://developers.googleblog.com/gemini-embedding-available-gemini-api/)
- [Image token tiling (258/tile, 768px)](https://ai.google.dev/gemini-api/docs/tokens)
- [Cloud Run pricing](https://cloud.google.com/run/pricing)
- [Firestore pricing](https://cloud.google.com/firestore/pricing)
- [Cloud Storage pricing](https://cloud.google.com/storage/pricing)
