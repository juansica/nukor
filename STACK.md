ps# Nukor — Tech Stack, Structure & Features

## Overview
AI-powered company knowledge base with collaborative workspaces. The assistant captures, organizes, and answers questions using company knowledge from conversations, documents, and connected tools. Spanish-first UI.

---

## Tech Stack

### Core
| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.1 (App Router) |
| Language | TypeScript |
| React | 19.2.4 |
| Styling | Tailwind CSS v4 + PostCSS |
| UI Components | Radix UI (shadcn/ui) + Lucide icons |
| Animations | Framer Motion |

### Backend & Database
| Layer | Technology |
|---|---|
| Database | PostgreSQL (Supabase) |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Auth | Supabase Auth (JWT, OAuth) |
| Server-side client | `@supabase/ssr` |

### AI & Knowledge
| Layer | Technology |
|---|---|
| LLM | OpenAI GPT-4o (chat) + GPT-4o-mini (titles) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Vector search | pgvector (Supabase RPC `match_entries`) |
| Document RAG | Ragie (chunking, indexing, semantic search) |
| Streaming | Server-Sent Events (SSE) |

### Billing
| Provider | SDK |
|---|---|
| Paddle | `@paddle/paddle-node-sdk` v3.6 |

### Video
| Tool | Purpose |
|---|---|
| Remotion | Programmatic video rendering for marketing content |

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Database
DATABASE_URL

# OpenAI
OPENAI_API_KEY

# Ragie (Document RAG)
RAGIE_API_KEY

# Paddle (Billing)
PADDLE_API_KEY
PADDLE_ENVIRONMENT          # 'sandbox' | 'production'
PADDLE_WEBHOOK_SECRET
PADDLE_PRICE_ID

# App
NEXT_PUBLIC_APP_URL
```

---

## Directory Structure

```
src/
├── app/
│   ├── page.tsx                      # Landing page
│   ├── layout.tsx                    # Root layout
│   ├── sign-in/                      # Auth pages
│   ├── sign-up/
│   ├── auth/callback/                # Supabase OAuth callback
│   ├── onboarding/                   # Workspace setup flow
│   ├── dashboard/
│   │   ├── page.tsx                  # Main chat dashboard
│   │   ├── overview/                 # Analytics
│   │   ├── library/                  # Knowledge base browser
│   │   └── settings/                 # Workspace settings + integrations
│   └── api/
│       ├── chat/                     # Streaming AI chat (SSE)
│       ├── conversations/            # Conversation CRUD
│       ├── entries/                  # Knowledge entry CRUD + embeddings
│       ├── areas/                    # Department management
│       ├── collections/              # Knowledge collections
│       ├── upload/                   # Document file upload → Ragie
│       ├── documents/                # Uploaded document list
│       ├── integrations/             # Third-party connections (Ragie connectors)
│       ├── billing/
│       │   ├── checkout/             # Paddle checkout URL
│       │   ├── subscription/         # Subscription status + portal
│       │   └── webhook/              # Paddle webhook handler
│       ├── workspace/config/         # AI config (model, system prompt)
│       ├── dashboard/stats/          # Analytics data
│       ├── invitations/              # Team invitations
│       └── onboarding/               # Onboarding progress
│
├── components/
│   ├── dashboard/
│   │   ├── DashboardClient.tsx       # Root dashboard state + streaming logic
│   │   ├── ChatArea.tsx              # Message list, thinking indicator, logs panel
│   │   ├── ChatInput.tsx             # Message input + file upload
│   │   ├── Sidebar.tsx               # Nav, workspace selector, conversation history
│   │   ├── UserMenu.tsx              # Top-right user dropdown (settings, sign out)
│   │   └── OverviewClient.tsx        # Stats/analytics dashboard
│   ├── landing/
│   │   ├── Navbar.tsx
│   │   ├── HeroSection.tsx           # Interactive chat mockup demo
│   │   ├── Features.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── Pricing.tsx
│   │   ├── SocialProof.tsx
│   │   ├── FinalCTA.tsx
│   │   └── Footer.tsx
│   ├── settings/
│   │   └── IntegrationsTab.tsx
│   ├── auth/
│   │   └── SignOutButton.tsx
│   └── ui/                           # 51 Radix/shadcn components
│
├── lib/
│   ├── prisma.ts                     # Prisma singleton
│   ├── supabase/
│   │   ├── client.ts                 # Browser Supabase client
│   │   └── server.ts                 # Server Supabase client
│   ├── openai.ts                     # streamChat() async generator
│   ├── ragie.ts                      # searchRagie(), uploadDocument()
│   ├── plans.ts                      # Plan config + feature gating helpers
│   ├── paddle.ts                     # createCheckoutUrl(), verifyWebhookSignature()
│   └── utils.ts
│
├── types/
│   └── chat.ts                       # IConversation, IMessage, StreamEvent types
│
└── hooks/
    ├── use-toast.ts
    └── use-mobile.ts

remotion/
├── src/
│   ├── NukorDemo.tsx                 # Animated chat mockup composition
│   ├── Root.tsx                      # Remotion root
│   └── index.ts
└── remotion.config.ts
```

---

## Database Models (Prisma)

### Core
- **Profile** — user accounts, avatar, `last_workspace_id`
- **Workspace** — tenant, `ai_config` (JSON), billing columns (`paddle_subscription_id`, `plan`, `subscription_status`)
- **WorkspaceMember** — role-based membership (`admin`, `editor`, `viewer`)
- **Invitation** — email invitations with expiry tokens

### Knowledge Base
- **Area** — departments/divisions within a workspace
- **Collection** — knowledge groupings within areas (`enabled` flag controls RAG inclusion)
- **Entry** — knowledge articles: `title`, `content`, `embedding` (pgvector), `is_published`, soft delete
- **EntryVersion** — full version history per entry
- **EntryTag / Tag** — tagging system
- **Template** — reusable entry templates

### Engagement
- **EntryFeedback** — `helpful | outdated | incorrect`
- **Reaction** — `confirmed | outdated | confusing | helpful`
- **EntryRelation** — `parent | related | duplicate` links between entries
- **Comment** — threaded discussion on entries
- **Follow / Mention / Announcement**

### Chat
- **Conversation** — chat thread per user per workspace
- **Message** — individual messages with `role`, token counts, model used

### Analytics
- **SearchHistory** — query logs
- **EntryAnalytics** — `view | search_click | copy` events
- **AiUsage** — monthly token usage per workspace

### Config / System
- **CustomField / CustomFieldValue** — extensible entry fields
- **SavedView** — saved filtered views
- **OnboardingTrack / OnboardingProgress** — learning paths
- **ActivityLog** — full audit trail
- **Notification**
- **Integration** — OAuth credentials for third-party services
- **Subscription / Plan** — billing state

---

## Features

### AI Assistant
- Streaming chat with GPT-4o via SSE
- Tool calling loop (up to 5 iterations):
  - `get_areas`, `get_collections`, `get_entries`
  - `create_entry`, `update_entry`
  - `create_area`, `create_collection`
  - `detect_contradiction` — semantic duplicate check before saving
  - `suggest_knowledge_gaps`
  - `run_knowledge_audit`
- Thinking/step animation while waiting for first token
- Source citations from RAG results
- Activity log panel (Cmd+L) showing RAG, tool, and response events
- Configurable per workspace: model, system prompt, max messages

### Knowledge Base
- Entries with auto-generated pgvector embeddings
- Organized by Area → Collection → Entry hierarchy
- Collections can be disabled (excluded from RAG)
- Version history per entry
- Feedback system (helpful/outdated/incorrect)
- Save-from-chat banner when AI detects new knowledge

### Document RAG (Ragie)
- Upload PDF, Word (.docx), Excel (.xlsx) — max 50MB
- Files chunked and indexed by Ragie per workspace partition
- Semantic search over documents during chat
- Supports third-party connectors (Slack, Notion, Google Drive sync)

### Workspaces
- Multi-tenant with role-based access (`admin`, `editor`, `viewer`)
- Workspace selector in sidebar
- Per-workspace AI configuration
- Invitation flow for team members

### Dashboard
- Chat interface with conversation history (grouped: Hoy / Ayer / Esta semana / Anteriores)
- Overview with analytics (stats via `/api/dashboard/stats`)
- Library browser for knowledge base
- Settings page: AI config, integrations, billing

### Billing (Paddle)
- Checkout URL generation
- Webhook handling (`subscription.created`, `subscription.updated`, etc.)
- Customer portal link
- Plan enforcement via `src/lib/plans.ts`

| Plan | Users | Documents | Integrations | WhatsApp | AI |
|---|---|---|---|---|---|
| Starter | 1 | 10 | 0 | ✗ | Daily limit |
| Plus | 5 | 25 | 2 | ✗ | Unlimited |
| Pro | 15 | 100 | 5 | ✅ | Unlimited |
| Enterprise | Unlimited | Unlimited | Unlimited | ✅ | Unlimited + API |

### Auth
- Email/password via Supabase
- OAuth callback handler
- Server-side auth checks on all API routes and dashboard pages
- RLS policies on all tables (using `auth.uid()::text` cast for text columns)

### Video (Remotion)
- `npm run video:studio` — live preview at localhost:3000
- `npm run video:render` — renders `out/nukor-demo.mp4`
- Composition: 24s, 30fps, 1280×720 — animates the hero chat mockup across 3 niche tabs

---

## Streaming Chat Architecture

```
User sends message
       │
       ▼
DashboardClient.handleSendMessage()
  → optimistically adds message + bumps updated_at
  → sets isTyping = true (shows TypingIndicator)
  → calls streamChat(workspaceId, history, conversationId)
       │
       ▼ POST /api/chat (SSE)
  1. Auth check
  2. Generate embedding for user message
  3. pgvector search (match_entries RPC, threshold 0.1, top 8)
  4. Ragie semantic search (top chunks from workspace partition)
  5. Build system prompt with RAG context
  6. GPT-4o tool-calling loop (max 5 iterations)
  7. Stream tokens → isTyping = false on first token
  8. Stream sources, done signal
       │
       ▼
DashboardClient processes events:
  token   → append to message content
  step    → update ThinkingLog
  log     → append to activity log panel
  sources → attach to message
  done    → fetchConversations() to refresh titles/order
```

---

*Last updated: 2026-03-24*
