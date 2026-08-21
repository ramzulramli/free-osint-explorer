
---

# 2. `ARCHITECTURE.md`

This one explains **how the system is designed**, rather than where we're currently at.

Copy:

```markdown
# Free OSINT Explorer — Architecture

## Objective

A lightweight, on-demand OSINT discovery engine running primarily on free cloud services.

The system is designed around independent components so individual search providers or processing methods can be replaced without rebuilding the entire system.

---

# High-Level Architecture

```text
                         USER
                           │
                           ▼
                    Web Interface
                           │
                           ▼
                    Cloudflare Worker
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
           Search        Fetch         Read
              │            │            │
              ▼            ▼            ▼
          Search         Public       Clean
          Provider       Webpage      Text
              │
              ▼
        Search Results
              │
              ▼
       Entity Extraction
              │
              ▼
       Relevance Scoring
              │
              ▼
       Discovery Queue
              │
              ▼
       Recursive Search
              │
              ▼
       Knowledge Graph
              │
        ┌─────┴─────┐
        ▼           ▼
      Report      Mind Map
        │           │
        └─────┬─────┘
              ▼
             PDF
