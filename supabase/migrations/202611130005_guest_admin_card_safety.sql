-- Preserve existing CMS behavior while protecting Guest Checkout reservations.
begin;

create or replace function public.cms_save_card(p_card jsonb, p_expected timestamptz default null) returns text language plpgsql security definer set search_path='' as $$
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
    if existing.guest_reserved_by is not null and (state<>existing.availability or cents<>existing.price_cents or p_card->>'publication'<>existing.publication) then raise exception 'This card has an active Guest Checkout reservation'; end if;
  elsif p_expected is not null then raise exception 'Listing no longer exists';
  end if;
  if state='reserved' and existing.reserved_by is null and existing.guest_reserved_by is null then raise exception 'Reserve cards through an authorized checkout or hold request'; end if;
  insert into public.cards(id,data,price_cents,publication,availability,featured_order)
  values(cid,p_card-'id'-'price'-'publication'-'availability'-'featuredOrder'-'updatedAt',cents,p_card->>'publication',state,(p_card->>'featuredOrder')::integer)
  on conflict(id) do update set data=excluded.data,price_cents=excluded.price_cents,publication=excluded.publication,availability=excluded.availability,featured_order=excluded.featured_order,updated_at=clock_timestamp();
  return cid;
end $$;

revoke all on function public.cms_save_card(jsonb,timestamptz)
from public,anon,authenticated;

grant execute on function public.cms_save_card(jsonb,timestamptz)
to authenticated;

notify pgrst,'reload schema';
commit;