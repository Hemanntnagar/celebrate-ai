create or replace function public.get_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'invitation', jsonb_build_object('id', i.id, 'event_id', i.event_id, 'guest_id', i.guest_id, 'subject', i.subject, 'preview_html', i.preview_html, 'status', i.status),
    'event', jsonb_build_object('name', e.name, 'start_date', e.start_date, 'location', e.location, 'theme', e.theme),
    'guest', jsonb_build_object('full_name', g.full_name, 'dietary', g.dietary, 'plus_ones', g.plus_ones),
    'rsvp', to_jsonb(r)
  )
  into result
  from public.invitations i
  join public.events e on e.id = i.event_id
  join public.guests g on g.id = i.guest_id
  left join public.rsvps r on r.invitation_id = i.id
  where i.token = p_token;
  return result;
end;
$$;

create or replace function public.submit_rsvp(
  p_token text,
  p_status text,
  p_party_size integer,
  p_meal_choice text,
  p_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  invite public.invitations;
  saved public.rsvps;
begin
  if p_status not in ('yes', 'no', 'maybe') then
    raise exception 'Invalid RSVP';
  end if;
  select * into invite from public.invitations where token = p_token;
  if not found then
    raise exception 'Invitation not found';
  end if;
  insert into public.rsvps (invitation_id, guest_id, event_id, status, party_size, meal_choice, message)
  values (invite.id, invite.guest_id, invite.event_id, p_status, greatest(p_party_size, 1), p_meal_choice, p_message)
  on conflict (invitation_id) do update
    set status = excluded.status,
        party_size = excluded.party_size,
        meal_choice = excluded.meal_choice,
        message = excluded.message,
        responded_at = now()
  returning * into saved;
  return to_jsonb(saved);
end;
$$;

grant execute on function public.get_invite(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, text, integer, text, text) to anon, authenticated;
