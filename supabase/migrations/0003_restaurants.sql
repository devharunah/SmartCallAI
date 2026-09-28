-- Emmere: a WhatsApp ordering assistant for restaurants. Each restaurant owns
-- its menu, conversations, orders and bot workflow. The dashboard reads these
-- through the signed-in user's session (RLS below); the WhatsApp webhook and the
-- chat engine use the service role and always filter by restaurant_id.

create table restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  slug text not null unique,
  currency text not null default 'UGX',
  timezone text not null default 'Africa/Kampala',
  default_language text not null default 'lug' check (default_language in ('lug', 'eng')),
  -- {"open": "07:00", "close": "22:30"} every day, in the restaurant's timezone.
  hours jsonb not null default '{"open": "08:00", "close": "22:00"}',
  -- {"pickup": true, "delivery": true, "fee": 3000, "areas": ["Kololo", ...]}
  delivery jsonb not null default '{"pickup": true, "delivery": true, "fee": 0, "areas": []}',
  greeting text,
  whatsapp_phone_number_id text unique,
  created_at timestamptz not null default now()
);
create index restaurants_owner_idx on restaurants (owner_id);

create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  name text not null,
  name_lg text,
  position integer not null default 0
);
create index menu_categories_restaurant_idx on menu_categories (restaurant_id);

-- Prices are whole Uganda shillings (UGX has no minor unit in practice).
create table menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  name_lg text,
  description text,
  price integer not null check (price >= 0),
  available boolean not null default true,
  image_path text,
  aliases text[] not null default '{}',
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index menu_items_restaurant_idx on menu_items (restaurant_id);

-- Uploaded menu images the bot sends. With none, the bot sends a generated one.
create table menu_assets (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  storage_path text not null,
  kind text not null default 'menu_image' check (kind in ('menu_image')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index menu_assets_restaurant_idx on menu_assets (restaurant_id);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'web')),
  customer_id text not null,          -- WhatsApp wa_id, or the web simulator's session id
  customer_name text,
  language text not null default 'lug' check (language in ('lug', 'eng')),
  messages jsonb not null default '[]',     -- AI SDK ModelMessage[] (what the model sees)
  display_log jsonb not null default '[]',  -- what the inbox renders, images included
  current_node text,
  cart jsonb not null default '{"items": []}',
  misses integer not null default 0,
  status text not null default 'active' check (status in ('active', 'handoff', 'closed')),
  ai_paused boolean not null default false,
  consent_shown boolean not null default false,
  last_customer_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, channel, customer_id)
);
create index conversations_restaurant_updated_idx on conversations (restaurant_id, updated_at desc);

create table orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  channel text not null,
  customer_name text,
  customer_phone text,
  fulfillment text not null check (fulfillment in ('pickup', 'delivery')),
  address text,
  notes text,
  subtotal integer not null,
  delivery_fee integer not null default 0,
  total integer not null,
  status text not null default 'new'
    check (status in ('new', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'mtn_momo', 'airtel_money')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_restaurant_created_idx on orders (restaurant_id, created_at desc);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name_snapshot text not null,
  unit_price integer not null,
  qty integer not null check (qty > 0),
  notes text
);
create index order_items_order_idx on order_items (order_id);

create table workflows (
  restaurant_id uuid primary key references restaurants(id) on delete cascade,
  graph jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);

-- WhatsApp retries webhooks; the message id makes handling idempotent.
create table processed_messages (
  wamid text primary key,
  created_at timestamptz not null default now()
);

-- RLS: owners manage their own restaurant's rows. The service role bypasses this.
alter table restaurants enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table menu_assets enable row level security;
alter table conversations enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table workflows enable row level security;
alter table processed_messages enable row level security; -- no policies: service role only

create policy "owners manage their restaurant" on restaurants
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create or replace function public.owns_restaurant(rid uuid) returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.restaurants where id = rid and owner_id = (select auth.uid()));
$$;

create policy "owners manage menu categories" on menu_categories
  for all to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));
create policy "owners manage menu items" on menu_items
  for all to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));
create policy "owners manage menu assets" on menu_assets
  for all to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));
create policy "owners manage conversations" on conversations
  for all to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));
create policy "owners manage orders" on orders
  for all to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));
create policy "owners manage order items" on order_items
  for all to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and public.owns_restaurant(o.restaurant_id)))
  with check (exists (select 1 from public.orders o where o.id = order_id and public.owns_restaurant(o.restaurant_id)));
create policy "owners manage workflows" on workflows
  for all to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));

-- Live order board and inbox.
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table conversations;

-- Menu images: public read so WhatsApp can fetch them by link.
insert into storage.buckets (id, name, public) values ('menus', 'menus', true)
  on conflict (id) do nothing;

-- Demo restaurant used by the public /try simulator. No owner until claimed.
with r as (
  insert into restaurants (name, slug, default_language, hours, delivery, greeting)
  values (
    'Mama Rose Kitchen', 'mama-rose-kitchen', 'lug',
    '{"open": "07:00", "close": "22:30"}',
    '{"pickup": true, "delivery": true, "fee": 3000, "areas": ["Kololo", "Nakasero", "Kamwokya", "Ntinda", "Bukoto", "Wandegeya", "Kisementi"]}',
    null
  )
  returning id
),
cats as (
  insert into menu_categories (restaurant_id, name, name_lg, position)
  select r.id, c.name, c.name_lg, c.position
  from r, (values
    ('Breakfast & Rolex', 'Eky''enkya ne Rolex', 1),
    ('Local dishes', 'Emmere y''ewaka', 2),
    ('Grill', 'Ennyama eyokeddwa', 3),
    ('Drinks', 'Ebyokunywa', 4)
  ) as c(name, name_lg, position)
  returning id, name, restaurant_id
)
insert into menu_items (restaurant_id, category_id, name, name_lg, description, price, aliases, position)
select cats.restaurant_id, cats.id, i.name, i.name_lg, i.description, i.price, i.aliases, i.position
from cats join (values
  ('Breakfast & Rolex', 'Classic Rolex', null, 'Two eggs rolled in a chapati with tomato, onion and cabbage', 5000, array['rolex', 'rolexes'], 1),
  ('Breakfast & Rolex', 'Rolex Special', null, 'Three eggs, sausage and avocado rolled in chapati', 8000, array['special rolex', 'rolex special'], 2),
  ('Breakfast & Rolex', 'Chapati', 'Kyapati', 'Soft layered chapati', 1000, array['chapo', 'chapati', 'kyapati'], 3),
  ('Breakfast & Rolex', 'Katogo (beef)', 'Katogo w''ennyama', 'Matooke cooked with beef stew', 10000, array['katogo'], 4),
  ('Local dishes', 'Chicken Luwombo', 'Luwombo w''enkoko', 'Chicken steamed in banana leaves with groundnut sauce', 25000, array['luwombo', 'chicken luwombo', 'enkoko'], 1),
  ('Local dishes', 'Beef Luwombo', 'Luwombo w''ennyama', 'Beef steamed in banana leaves', 22000, array['beef luwombo'], 2),
  ('Local dishes', 'Matooke & groundnut sauce', 'Matooke n''ebinyeebwa', 'Steamed matooke with groundnut sauce', 9000, array['matooke', 'binyebwa', 'ebinyeebwa'], 3),
  ('Local dishes', 'Beef pilau', 'Pilawo', 'Spiced rice with beef', 12000, array['pilau', 'pilawo'], 4),
  ('Local dishes', 'Posho & beans', 'Kawunga n''ebijanjaalo', 'Posho with bean stew', 6000, array['posho', 'kawunga', 'beans', 'bijanjaalo'], 5),
  ('Grill', 'Grilled tilapia', 'Ekyennyanja', 'Whole tilapia with chips or matooke', 30000, array['fish', 'tilapia', 'ngege', 'kyennyanja'], 1),
  ('Grill', 'Muchomo (goat)', 'Mucomo w''embuzi', 'Grilled goat skewers', 15000, array['muchomo', 'goat', 'mbuzi'], 2),
  ('Grill', 'Chips', null, 'French fries', 5000, array['chips', 'fries'], 3),
  ('Drinks', 'Fresh passion juice', 'Omubisi gwa passion', 'Freshly blended passion fruit', 4000, array['juice', 'passion', 'passion juice'], 1),
  ('Drinks', 'Soda (300ml)', null, 'Coca-Cola, Fanta or Sprite', 2000, array['soda', 'coke', 'fanta', 'sprite'], 2),
  ('Drinks', 'African tea', 'Caayi', 'Spiced milk tea', 2000, array['tea', 'chai', 'caayi', 'african tea'], 3),
  ('Drinks', 'Water (500ml)', 'Amazzi', 'Bottled water', 1500, array['water', 'amazzi'], 4)
) as i(category, name, name_lg, description, price, aliases, position) on i.category = cats.name;
