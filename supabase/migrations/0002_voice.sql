-- Phone channel (Africa's Talking). The AI agent talks to the caller turn by
-- turn; each turn is a separate webhook request, so the conversation lives in
-- voice_sessions between requests.

alter table calls
  add column channel text not null default 'web',
  add column caller_number text,
  add column session_id text unique,
  add column resolution text check (resolution in ('resolved', 'transferred', 'abandoned')),
  add column duration_seconds integer;

create table voice_sessions (
  session_id text primary key,
  caller_number text,
  messages jsonb not null default '[]',
  turns integer not null default 0,
  misses integer not null default 0,
  status text not null default 'active'
    check (status in ('active', 'resolved', 'transferred', 'abandoned')),
  summary text,
  transferred_agent_id uuid references agents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- What the AI does for the caller instead of transferring: a refund, a
-- technician visit, a callback... Humans work the queue later.
create table service_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  session_id text references voice_sessions(session_id) on delete set null,
  caller_number text,
  category text not null,
  kind text not null check (kind in ('refund', 'technician_visit', 'callback', 'card_unblock', 'claim', 'other')),
  details text not null,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);
