-- Customers often send two WhatsApp messages in a row, and each arrives as its
-- own webhook. The engine takes this short lease so one customer's messages are
-- handled one at a time (the second waits), instead of both reading the same
-- state and one overwriting the other's progress.
alter table conversations add column locked_until timestamptz;

-- Acquire the lease if it's free or expired. Returns true when this caller holds it.
create or replace function public.lock_conversation(conversation_id uuid, lease_seconds integer default 45)
  returns boolean
  language sql
  security invoker
  set search_path = ''
as $$
  with taken as (
    update public.conversations
       set locked_until = now() + make_interval(secs => lease_seconds)
     where id = conversation_id
       and (locked_until is null or locked_until < now())
    returning 1
  )
  select exists (select 1 from taken);
$$;

revoke execute on function public.lock_conversation(uuid, integer) from public, anon, authenticated;
