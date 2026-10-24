-- BinderFinders CMS. Additive migration; no existing catalog is overwritten.
begin;
create table public.admin_users (
  user_id uuid primary key references auth.users(id), email text not null,
  role text not null check(role in ('owner','editor')), active boolean not null default true,
  created_at timestamptz not null default now()
);
create function public.cms_is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.admin_users where user_id=auth.uid() and active)
$$;
create function public.cms_is_owner() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.admin_users where user_id=auth.uid() and active and role='owner')
$$;
create table public.cards (
  id text primary key check(id ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  data jsonb not null check(jsonb_typeof(data)='object' and length(data->>'name')>0),
  price_cents bigint not null check(price_cents between 0 and 1000000000),
  publication text not null default 'draft' check(publication in ('draft','published','archived')),
  availability text not null default 'available' check(availability in ('available','reserved','sold','unavailable')),
  featured_order integer check(featured_order between 0 and 9999),
  reserved_by uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index cards_public_idx on public.cards(publication,availability);
create table public.collections (
  id text primary key, name text not null check(length(name) between 1 and 80),
  sort_order integer not null default 0, updated_at timestamptz not null default now()
);
create table public.collection_cards (
  collection_id text references public.collections(id) on delete cascade,
  card_id text references public.cards(id), sort_order integer not null default 0,
  primary key(collection_id,card_id)
);
create table public.store_settings (
  id boolean primary key default true check(id), data jsonb not null,
  updated_at timestamptz not null default now()
);
create table public.hold_requests (
  id uuid primary key default gen_random_uuid(), request_key uuid not null unique,
  name text not null, email text not null, note text not null default '',
  status text not null default 'pending' check(status in ('pending','accepted','completed','rejected','cancelled')),
  currency text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.cards add constraint cards_reserved_by_fkey foreign key(reserved_by) references public.hold_requests(id);
create table public.hold_request_items (
  request_id uuid references public.hold_requests(id), card_id text references public.cards(id),
  name text not null, price_cents bigint not null, primary key(request_id,card_id)
);
create table public.hold_rate_limits (key text primary key, started_at timestamptz not null, attempts integer not null);
create table public.audit_log (
  id bigint generated always as identity primary key, table_name text not null, record_id text not null,
  actor_id uuid, old_data jsonb, new_data jsonb, created_at timestamptz not null default now()
);
create function public.cms_audit() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.audit_log(table_name,record_id,actor_id,old_data,new_data)
  values(tg_table_name,coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'user_id'),auth.uid(),case when tg_op='INSERT' then null else to_jsonb(old) end,to_jsonb(new));
  return new;
end $$;
create trigger cards_audit after insert or update on public.cards for each row execute function public.cms_audit();
create trigger collections_audit after insert or update on public.collections for each row execute function public.cms_audit();
create trigger settings_audit after insert or update on public.store_settings for each row execute function public.cms_audit();
create trigger holds_audit after insert or update on public.hold_requests for each row execute function public.cms_audit();
create trigger admins_audit after insert or update on public.admin_users for each row execute function public.cms_audit();

alter table public.admin_users enable row level security;
alter table public.cards enable row level security;
alter table public.collections enable row level security;
alter table public.collection_cards enable row level security;
alter table public.store_settings enable row level security;
alter table public.hold_requests enable row level security;
alter table public.hold_request_items enable row level security;
alter table public.hold_rate_limits enable row level security;
alter table public.audit_log enable row level security;
create policy admin_read on public.admin_users for select to authenticated using(user_id=auth.uid() or public.cms_is_owner());
create policy card_read on public.cards for select to anon,authenticated using(publication='published' or public.cms_is_admin());
create policy collection_read on public.collections for select to anon,authenticated using(true);
create policy membership_read on public.collection_cards for select to anon,authenticated using(exists(select 1 from public.cards c where c.id=card_id and (c.publication='published' or public.cms_is_admin())));
create policy settings_read on public.store_settings for select to anon,authenticated using(true);
create policy hold_read on public.hold_requests for select to authenticated using(public.cms_is_admin());
create policy hold_items_read on public.hold_request_items for select to authenticated using(public.cms_is_admin());
create policy audit_read on public.audit_log for select to authenticated using(public.cms_is_admin());
-- Mutations are only possible through validated RPCs below; never raw table writes.
revoke all on public.admin_users,public.cards,public.collections,public.collection_cards,public.store_settings,public.hold_requests,public.hold_request_items,public.hold_rate_limits,public.audit_log from anon,authenticated;
grant select on public.cards,public.collections,public.collection_cards,public.store_settings to anon,authenticated;
grant select on public.admin_users,public.hold_requests,public.hold_request_items,public.audit_log to authenticated;

create function public.cms_save_card(p_card jsonb, p_expected timestamptz default null) returns text language plpgsql security definer set search_path='' as $$
declare existing public.cards; cid text:=p_card->>'id'; state text:=p_card->>'availability'; cents bigint;
begin
  if not public.cms_is_admin() then raise exception 'Administrator access required'; end if;
  if jsonb_typeof(p_card)<>'object' or length(coalesce(p_card->>'name','')) not between 1 and 120 or length(coalesce(p_card->>'set','')) not between 1 and 120 then raise exception 'Invalid listing'; end if;
  if (p_card->>'pokemonId')::integer not between 1 and 1025 or (p_card->>'year')::integer not between 1996 and 2100 then raise exception 'Invalid card metadata'; end if;
  if (p_card->>'price')::numeric*100 <> trunc((p_card->>'price')::numeric*100) then raise exception 'Invalid price precision'; end if;
  cents:=((p_card->>'price')::numeric*100)::bigint;
  if p_card->>'publication'='published' and coalesce(p_card->>'imageUrl','')='' then raise exception 'A front scan is required'; end if;
  if state is null or p_card->>'publication' is null then raise exception 'Status is required'; end if;
  select * into existing from public.cards where id=cid for update;
  if found then
    if p_expected is null or existing.updated_at<>p_expected then raise exception 'This card changed in another session. Reload before saving.'; end if;
    if existing.reserved_by is not null and (state<>existing.availability or cents<>existing.price_cents or p_card->>'publication'<>existing.publication) then raise exception 'Manage this card through its accepted hold request first'; end if;
  elsif p_expected is not null then raise exception 'Listing no longer exists';
  end if;
  if state='reserved' and existing.reserved_by is null then raise exception 'Reserve cards by accepting a hold request'; end if;
  insert into public.cards(id,data,price_cents,publication,availability,featured_order)
  values(cid,p_card-'id'-'price'-'publication'-'availability'-'featuredOrder'-'updatedAt',cents,p_card->>'publication',state,(p_card->>'featuredOrder')::integer)
  on conflict(id) do update set data=excluded.data,price_cents=excluded.price_cents,publication=excluded.publication,availability=excluded.availability,featured_order=excluded.featured_order,updated_at=clock_timestamp();
  return cid;
end $$;

create function public.cms_save_collection(p_collection jsonb, p_expected timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
declare existing public.collections; cid text:=p_collection->>'id';
begin
  if not public.cms_is_admin() then raise exception 'Administrator access required'; end if;
  if cid !~ '^[a-z0-9][a-z0-9-]{0,79}$' or jsonb_array_length(p_collection->'cardIds')>500 then raise exception 'Invalid collection'; end if;
  select * into existing from public.collections where id=cid for update;
  if found and (p_expected is null or existing.updated_at<>p_expected) then raise exception 'Collection changed. Reload before saving.'; end if;
  insert into public.collections(id,name,sort_order) values(cid,p_collection->>'name',(p_collection->>'sortOrder')::integer)
  on conflict(id) do update set name=excluded.name,sort_order=excluded.sort_order,updated_at=clock_timestamp();
  delete from public.collection_cards where collection_id=cid;
  insert into public.collection_cards(collection_id,card_id,sort_order) select cid,value,ordinality::integer from jsonb_array_elements_text(p_collection->'cardIds') with ordinality;
end $$;

create function public.cms_save_settings(p_settings jsonb, p_expected timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare existing public.store_settings;
begin
  if not public.cms_is_admin() then raise exception 'Administrator access required'; end if;
  select * into existing from public.store_settings where id for update;
  if existing.updated_at is distinct from p_expected then raise exception 'Settings changed. Reload before saving.'; end if;
  if not public.cms_is_owner() and (existing.data->'currency' is distinct from p_settings->'currency' or existing.data->'holdsEnabled' is distinct from p_settings->'holdsEnabled') then raise exception 'Only an owner can change store settings'; end if;
  if coalesce((p_settings->>'holdsEnabled')::boolean,false) and p_settings->>'currency' not in ('AUD','USD','PHP','GBP','EUR','CAD','NZD','JPY') then raise exception 'Choose a currency'; end if;
  update public.store_settings set data=p_settings,updated_at=clock_timestamp() where id;
end $$;

-- Service-only public submission. Prices and availability come from locked database rows.
create function public.cms_submit_hold(p_request jsonb,p_ip_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; c public.cards; settings jsonb; ids text[]; k text; attempts_now integer;
begin
  select id into result from public.hold_requests where request_key=(p_request->>'requestKey')::uuid;
  if found then
    if not exists(select 1 from public.hold_requests where id=result and email=lower(p_request->>'email')) then raise exception 'Invalid request'; end if;
    return result;
  end if;
  select data into settings from public.store_settings where id;
  if not coalesce((settings->>'holdsEnabled')::boolean,false) then raise exception 'Hold requests are currently unavailable. Please contact the store.'; end if;
  if length(coalesce(p_request->>'name','')) not between 1 and 120 or length(coalesce(p_request->>'email','')) not between 3 and 200 or length(coalesce(p_request->>'note',''))>2000 then raise exception 'Invalid contact details'; end if;
  select array_agg(distinct value order by value) into ids from jsonb_array_elements_text(p_request->'cardIds');
  if coalesce(array_length(ids,1),0) not between 1 and 30 then raise exception 'Select between 1 and 30 cards'; end if;
  foreach k in array array['ip:'||p_ip_hash,'email:'||lower(p_request->>'email')] loop
    insert into public.hold_rate_limits(key,started_at,attempts) values(k,now(),1)
    on conflict(key) do update set attempts=case when public.hold_rate_limits.started_at<now()-interval '15 minutes' then 1 else public.hold_rate_limits.attempts+1 end,started_at=case when public.hold_rate_limits.started_at<now()-interval '15 minutes' then now() else public.hold_rate_limits.started_at end
    returning attempts into attempts_now;
    if attempts_now>5 then raise exception 'Too many requests. Please try again later.'; end if;
  end loop;
  perform id from public.cards where id=any(ids) order by id for update;
  if (select count(*) from public.cards where id=any(ids) and publication='published' and availability='available')<>array_length(ids,1) then raise exception 'A selected card is no longer available. Please refresh your bag.'; end if;
  for c in select * from public.cards where id=any(ids) loop
    if coalesce((p_request->'prices'->>c.id)::bigint,-1)<>c.price_cents then raise exception 'A card price changed. Refresh your bag and review the new total.'; end if;
  end loop;
  insert into public.hold_requests(request_key,name,email,note,currency) values((p_request->>'requestKey')::uuid,p_request->>'name',lower(p_request->>'email'),coalesce(p_request->>'note',''),settings->>'currency') returning id into result;
  insert into public.hold_request_items(request_id,card_id,name,price_cents) select result,id,data->>'name',price_cents from public.cards where id=any(ids);
  return result;
end $$;

create function public.cms_transition_hold(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare h public.hold_requests; ids text[];
begin
  if not public.cms_is_admin() then raise exception 'Administrator access required'; end if;
  select * into h from public.hold_requests where id=p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if not ((h.status='pending' and p_status in ('accepted','rejected','cancelled')) or (h.status='accepted' and p_status in ('completed','cancelled'))) then raise exception 'Invalid request transition. Refresh the list.'; end if;
  select array_agg(card_id order by card_id) into ids from public.hold_request_items where request_id=p_id;
  perform id from public.cards where id=any(ids) order by id for update;
  if p_status='accepted' then
    if (select count(*) from public.cards where id=any(ids) and publication='published' and availability='available')<>array_length(ids,1) then raise exception 'One or more cards are no longer available'; end if;
    if exists(select 1 from public.cards c join public.hold_request_items i on i.card_id=c.id where i.request_id=p_id and i.price_cents<>c.price_cents) then raise exception 'Prices changed since this request. Contact the customer before creating a new request.'; end if;
    update public.cards set availability='reserved',reserved_by=p_id,updated_at=clock_timestamp() where id=any(ids);
  elsif h.status='accepted' then
    if (select count(*) from public.cards where id=any(ids) and reserved_by=p_id)<>array_length(ids,1) then raise exception 'Reservation conflict'; end if;
    update public.cards set availability=case when p_status='completed' then 'sold' else 'available' end,reserved_by=null,updated_at=clock_timestamp() where reserved_by=p_id;
  end if;
  update public.hold_requests set status=p_status,updated_at=clock_timestamp() where id=p_id;
end $$;

create function public.cms_set_admin(p_user uuid,p_email text,p_role text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.cms_is_owner() then raise exception 'Owner access required'; end if;
  -- Serialize membership changes, preserving at least one active owner.
  perform user_id from public.admin_users order by user_id for update;
  if p_user=auth.uid() then raise exception 'You cannot change your own access'; end if;
  if not exists(select 1 from auth.users where id=p_user and lower(email)=lower(p_email)) then raise exception 'User ID and email must match an existing account'; end if;
  insert into public.admin_users(user_id,email,role,active) values(p_user,p_email,p_role,p_active)
  on conflict(user_id) do update set role=excluded.role,active=excluded.active;
end $$;

revoke all on function public.cms_audit(),public.cms_is_admin(),public.cms_is_owner(),public.cms_save_card(jsonb,timestamptz),public.cms_save_collection(jsonb,timestamptz),public.cms_save_settings(jsonb,timestamptz),public.cms_submit_hold(jsonb,text),public.cms_transition_hold(uuid,text),public.cms_set_admin(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.cms_is_admin(),public.cms_is_owner() to anon,authenticated;
grant execute on function public.cms_save_card(jsonb,timestamptz),public.cms_save_collection(jsonb,timestamptz),public.cms_save_settings(jsonb,timestamptz),public.cms_transition_hold(uuid,text),public.cms_set_admin(uuid,text,text,boolean) to authenticated;
grant execute on function public.cms_submit_hold(jsonb,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('card-scans','card-scans',false,8388608,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy scans_admin_read on storage.objects for select to authenticated using(bucket_id='card-scans' and public.cms_is_admin());
create policy scans_admin_insert on storage.objects for insert to authenticated with check(bucket_id='card-scans' and public.cms_is_admin());
-- Private bucket: public image proxy verifies the image belongs to a published card.
notify pgrst,'reload schema';
commit;
