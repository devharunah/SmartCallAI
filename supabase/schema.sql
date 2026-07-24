-- SmartCall AI schema. Run this in the Supabase SQL editor (or push via Supabase MCP/CLI).

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  department text not null,
  categories text[] not null default '{}',
  available boolean not null default true
);

create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  transcript text not null,
  category text not null,
  summary text not null,
  confidence numeric not null,
  reason text not null,
  assigned_agent_id uuid references agents(id),
  assigned_agent_name text,
  routing_time_ms integer,
  created_at timestamptz not null default now()
);

insert into agents (name, phone, department, categories, available) values
  ('Sarah', '0701234567', 'Technical Support', array['Technical Support'], true),
  ('John', '0702234567', 'Technical Support', array['Technical Support'], false),
  ('Grace', '0703234567', 'Billing', array['Billing'], true),
  ('Michael', '0704234567', 'Billing', array['Billing'], false),
  ('Ama', '0705234567', 'Sales', array['Sales'], true),
  ('David', '0706234567', 'Insurance', array['Insurance'], true),
  ('Linda', '0707234567', 'Loans', array['Loans'], true),
  ('Peter', '0708234567', 'Card Support', array['Card Support'], true)
on conflict do nothing;
