begin;
create table public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '' check (length(name) <= 120),
  created_at timestamptz not null default now()
);
alter table public.customer_profiles enable row level security;
revoke all on public.customer_profiles from anon, authenticated;
grant select, insert on public.customer_profiles to authenticated;
grant update(name) on public.customer_profiles to authenticated;
create policy customer_read_self on public.customer_profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy customer_insert_self on public.customer_profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy customer_update_self on public.customer_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
notify pgrst, 'reload schema';
commit;
