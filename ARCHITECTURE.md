# Free OSINT Explorer — Architecture

## 1. Overview

Free OSINT Explorer is an on-demand web investigation system.

The system accepts a seed such as:

- Person
- Organisation
- Company
- Website
- Username
- Location
- Topic
- Keyword

It searches public sources, reads webpages, extracts entities and relationships, then recursively investigates the most relevant discoveries.

The system is designed for:

- RM0 / free operation where realistically possible
- On-demand execution
- No always-running server
- Browser-based development
- Cloudflare Workers
- GitHub-based deployment

---

# 2. High-Level Architecture

```text
                    USER
                     │
                     ▼
              ┌─────────────┐
              │ Web UI      │
              │ Investigation│
              └──────┬──────┘
                     │
                     ▼
              ┌─────────────┐
              │ Cloudflare  │
              │ Worker API  │
              └──────┬──────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       Search      Fetch       Read
       Engine      Engine      Engine
          │          │          │
          └──────────┼──────────┘
                     ▼
             Entity Extraction
                     │
                     ▼
              Relevance Engine
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
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       Sources    Entities   Relations
          │          │          │
          └──────────┼──────────┘
                     ▼
              Report Generator
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       Summary    Timeline    Mind Map
                     │
                     ▼
                  PDF
