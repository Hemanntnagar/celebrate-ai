-- Celebrate AI complete schema, RLS, and scheduled-job helpers.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  event_type text not null check (event_type in ('wedding','birthday','anniversary','festival','community')),
  start_date date not null,
  end_date date not null,
  location text not null,
  guest_count integer not null check (guest_count > 0),
  budget numeric,
  currency char(3) not null default 'USD',
  theme text,
  status text not null default 'planning' check (status in ('planning','confirmed','in_progress','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','planner','coordinator','viewer')),
  status text not null default 'invited' check (status in ('invited','active','revoked')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (event_id, email)
);

create table if not exists public.event_preferences (
  event_id uuid primary key references public.events(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.planning_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.planning_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.planning_sessions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.event_plans (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.planning_sessions(id) on delete set null,
  version integer not null,
  plan jsonb not null,
  user_edits jsonb,
  status text not null default 'draft' check (status in ('draft','approved','superseded','applied')),
  approved_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.event_budgets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  total_minor bigint not null check (total_minor >= 0),
  currency char(3) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.event_budgets(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  allocation_minor bigint not null check (allocation_minor >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.budget_items (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.event_budgets(id) on delete cascade,
  category_id uuid not null references public.budget_categories(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  planned_minor bigint not null default 0,
  vendor_commitment_minor bigint not null default 0,
  vendor_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.event_budgets(id) on delete cascade,
  category_id uuid not null references public.budget_categories(id) on delete restrict,
  budget_item_id uuid references public.budget_items(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null,
  vendor_name text,
  notes text,
  expense_date date not null default current_date,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  paid_at date not null,
  method text not null check (method in ('cash','card','bank_transfer','upi','other')),
  reference text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, idempotency_key)
);

create table if not exists public.payment_history (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  amount_minor bigint not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done')),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  due_date date,
  milestone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  assignee_email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_id uuid not null references public.tasks(id) on delete cascade,
  unique (task_id, depends_on_id),
  check (task_id <> depends_on_id)
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  contact_name text,
  email text,
  phone text,
  website text,
  service_description text,
  notes text,
  verification_status text not null default 'user_entered',
  created_at timestamptz not null default now()
);

create table if not exists public.vendor_quotes (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount_minor bigint not null check (amount_minor >= 0),
  currency char(3) not null,
  included_services text not null,
  terms text,
  availability text,
  valid_until date,
  verification_status text not null default 'user_entered',
  created_at timestamptz not null default now()
);

create table if not exists public.vendor_bookings (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  quote_id uuid references public.vendor_quotes(id) on delete set null,
  budget_id uuid references public.event_budgets(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'suggested',
  commitment_minor bigint not null default 0,
  currency char(3) not null,
  payment_schedule jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_booking_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.vendor_bookings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.vendor_files (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.vendor_bookings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  content_type text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.vendor_contracts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.vendor_bookings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  terms text,
  signed_at date,
  storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null
);

create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid references public.guest_groups(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  household text,
  dietary text,
  plus_ones integer not null default 0,
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  subject text not null,
  preview_html text not null,
  status text not null default 'draft' check (status in ('draft','queued','sent','failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references public.invitations(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  status text not null check (status in ('yes','no','maybe')),
  party_size integer not null default 1,
  meal_choice text,
  message text,
  responded_at timestamptz not null default now()
);

create table if not exists public.seating_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  capacity integer not null check (capacity > 0)
);

create table if not exists public.seating_assignments (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.seating_tables(id) on delete cascade,
  guest_id uuid not null unique references public.guests(id) on delete cascade
);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  actor_id uuid,
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  kind text not null,
  run_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processed','failed')),
  processed_at timestamptz
);

create index if not exists events_owner_idx on public.events (owner_id, start_date);
create index if not exists event_members_user_idx on public.event_members (user_id, status);
create index if not exists tasks_event_due_idx on public.tasks (event_id, due_date);
create index if not exists guests_event_idx on public.guests (event_id, full_name);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists scheduled_jobs_due_idx on public.scheduled_jobs (status, run_at);

create or replace function public.is_event_accessible(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and (
        e.owner_id = auth.uid()
        or exists (
          select 1
          from public.event_members m
          where m.event_id = p_event_id
            and m.user_id = auth.uid()
            and m.status = 'active'
        )
      )
  );
$$;

create or replace function public.event_role(p_event_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.events e where e.id = p_event_id and e.owner_id = auth.uid()) then 'owner'
    else (
      select m.role
      from public.event_members m
      where m.event_id = p_event_id and m.user_id = auth.uid() and m.status = 'active'
      limit 1
    )
  end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email)
  on conflict (id) do update set email = excluded.email, full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_new_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.event_members (event_id, user_id, email, role, status, invited_by)
  values (new.id, new.owner_id, coalesce((select email from public.profiles where id = new.owner_id), 'owner@local'), 'owner', 'active', new.owner_id)
  on conflict (event_id, email) do nothing;
  insert into public.event_preferences (event_id, preferences) values (new.id, '{}'::jsonb)
  on conflict (event_id) do nothing;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_event_created on public.events;
create trigger on_event_created
  after insert on public.events
  for each row execute function public.handle_new_event();

create or replace function public.record_payment(
  p_expense_id uuid,
  p_owner_id uuid,
  p_amount_minor bigint,
  p_paid_at date,
  p_method text,
  p_reference text,
  p_idempotency_key text
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.payments;
  created public.payments;
  expense_amount bigint;
  paid_so_far bigint;
begin
  select * into existing from public.payments where owner_id = p_owner_id and idempotency_key = p_idempotency_key;
  if found then
    return existing;
  end if;

  select amount_minor into expense_amount from public.expenses where id = p_expense_id and owner_id = p_owner_id;
  if expense_amount is null then
    raise exception 'Expense not found';
  end if;

  select coalesce(sum(amount_minor), 0) into paid_so_far from public.payments where expense_id = p_expense_id;
  if paid_so_far + p_amount_minor > expense_amount then
    raise exception 'Payment exceeds remaining expense';
  end if;

  insert into public.payments (expense_id, owner_id, amount_minor, paid_at, method, reference, idempotency_key)
  values (p_expense_id, p_owner_id, p_amount_minor, p_paid_at, p_method, p_reference, p_idempotency_key)
  returning * into created;

  insert into public.payment_history (payment_id, owner_id, action, amount_minor, note)
  values (created.id, p_owner_id, 'recorded', p_amount_minor, null);

  return created;
end;
$$;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.event_preferences enable row level security;
alter table public.planning_sessions enable row level security;
alter table public.planning_messages enable row level security;
alter table public.event_plans enable row level security;
alter table public.event_budgets enable row level security;
alter table public.budget_categories enable row level security;
alter table public.budget_items enable row level security;
alter table public.expenses enable row level security;
alter table public.payments enable row level security;
alter table public.payment_history enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_quotes enable row level security;
alter table public.vendor_bookings enable row level security;
alter table public.vendor_booking_history enable row level security;
alter table public.vendor_files enable row level security;
alter table public.vendor_contracts enable row level security;
alter table public.guest_groups enable row level security;
alter table public.guests enable row level security;
alter table public.invitations enable row level security;
alter table public.rsvps enable row level security;
alter table public.seating_tables enable row level security;
alter table public.seating_assignments enable row level security;
alter table public.activity_log enable row level security;
alter table public.notifications enable row level security;
alter table public.scheduled_jobs enable row level security;

create policy profiles_self on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy events_select on public.events for select using (public.is_event_accessible(id));
create policy events_insert on public.events for insert with check (owner_id = auth.uid());
create policy events_update on public.events for update using (public.event_role(id) in ('owner','planner'));
create policy events_delete on public.events for delete using (owner_id = auth.uid());

create policy members_select on public.event_members for select using (public.is_event_accessible(event_id));
create policy members_write on public.event_members for all using (public.event_role(event_id) = 'owner') with check (public.event_role(event_id) = 'owner');

create policy prefs_select on public.event_preferences for select using (public.is_event_accessible(event_id));
create policy prefs_write on public.event_preferences for all using (public.event_role(event_id) in ('owner','planner')) with check (public.event_role(event_id) in ('owner','planner'));

create policy plans_select on public.planning_sessions for select using (public.is_event_accessible(event_id));
create policy plans_write on public.planning_sessions for all using (public.event_role(event_id) in ('owner','planner')) with check (public.event_role(event_id) in ('owner','planner'));
create policy plan_messages_select on public.planning_messages for select using (exists (select 1 from public.planning_sessions s where s.id = session_id and public.is_event_accessible(s.event_id)));
create policy plan_messages_write on public.planning_messages for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy event_plans_select on public.event_plans for select using (public.is_event_accessible(event_id));
create policy event_plans_write on public.event_plans for all using (public.event_role(event_id) in ('owner','planner')) with check (public.event_role(event_id) in ('owner','planner'));

create policy budgets_select on public.event_budgets for select using (public.is_event_accessible(event_id));
create policy budgets_write on public.event_budgets for all using (public.event_role(event_id) in ('owner','planner')) with check (public.event_role(event_id) in ('owner','planner'));
create policy budget_child_select on public.budget_categories for select using (exists (select 1 from public.event_budgets b where b.id = budget_id and public.is_event_accessible(b.event_id)));
create policy budget_child_write on public.budget_categories for all using (exists (select 1 from public.event_budgets b where b.id = budget_id and public.event_role(b.event_id) in ('owner','planner'))) with check (exists (select 1 from public.event_budgets b where b.id = budget_id and public.event_role(b.event_id) in ('owner','planner')));
create policy budget_items_select on public.budget_items for select using (exists (select 1 from public.event_budgets b where b.id = budget_id and public.is_event_accessible(b.event_id)));
create policy budget_items_write on public.budget_items for all using (exists (select 1 from public.event_budgets b where b.id = budget_id and public.event_role(b.event_id) in ('owner','planner'))) with check (exists (select 1 from public.event_budgets b where b.id = budget_id and public.event_role(b.event_id) in ('owner','planner')));
create policy expenses_select on public.expenses for select using (exists (select 1 from public.event_budgets b where b.id = budget_id and public.is_event_accessible(b.event_id)));
create policy expenses_write on public.expenses for all using (exists (select 1 from public.event_budgets b where b.id = budget_id and public.event_role(b.event_id) in ('owner','planner'))) with check (exists (select 1 from public.event_budgets b where b.id = budget_id and public.event_role(b.event_id) in ('owner','planner')));
create policy payments_select on public.payments for select using (owner_id = auth.uid() or exists (select 1 from public.expenses e join public.event_budgets b on b.id = e.budget_id where e.id = expense_id and public.is_event_accessible(b.event_id)));
create policy payments_write on public.payments for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy payment_history_select on public.payment_history for select using (owner_id = auth.uid());
create policy payment_history_write on public.payment_history for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy tasks_select on public.tasks for select using (public.is_event_accessible(event_id));
create policy tasks_write on public.tasks for all using (public.event_role(event_id) in ('owner','planner','coordinator')) with check (public.event_role(event_id) in ('owner','planner','coordinator'));
create policy task_assign_select on public.task_assignments for select using (public.is_event_accessible(event_id));
create policy task_assign_write on public.task_assignments for all using (public.event_role(event_id) in ('owner','planner','coordinator')) with check (public.event_role(event_id) in ('owner','planner','coordinator'));
create policy task_dep_select on public.task_dependencies for select using (public.is_event_accessible(event_id));
create policy task_dep_write on public.task_dependencies for all using (public.event_role(event_id) in ('owner','planner','coordinator')) with check (public.event_role(event_id) in ('owner','planner','coordinator'));

create policy vendors_owner on public.vendors for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy quotes_select on public.vendor_quotes for select using (public.is_event_accessible(event_id));
create policy quotes_write on public.vendor_quotes for all using (public.event_role(event_id) in ('owner','planner','coordinator')) with check (public.event_role(event_id) in ('owner','planner','coordinator'));
create policy bookings_select on public.vendor_bookings for select using (public.is_event_accessible(event_id));
create policy bookings_write on public.vendor_bookings for all using (public.event_role(event_id) in ('owner','planner','coordinator')) with check (public.event_role(event_id) in ('owner','planner','coordinator'));
create policy booking_hist_select on public.vendor_booking_history for select using (owner_id = auth.uid());
create policy booking_hist_write on public.vendor_booking_history for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy vendor_files_owner on public.vendor_files for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy vendor_contracts_owner on public.vendor_contracts for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy guest_groups_select on public.guest_groups for select using (public.is_event_accessible(event_id));
create policy guest_groups_write on public.guest_groups for all using (public.event_role(event_id) in ('owner','planner','coordinator')) with check (public.event_role(event_id) in ('owner','planner','coordinator'));
create policy guests_select on public.guests for select using (public.is_event_accessible(event_id));
create policy guests_write on public.guests for all using (public.event_role(event_id) in ('owner','planner','coordinator')) with check (public.event_role(event_id) in ('owner','planner','coordinator'));
create policy invitations_select on public.invitations for select using (public.is_event_accessible(event_id));
create policy invitations_write on public.invitations for all using (public.event_role(event_id) in ('owner','planner','coordinator')) with check (public.event_role(event_id) in ('owner','planner','coordinator'));
create policy rsvps_select on public.rsvps for select using (public.is_event_accessible(event_id));
create policy rsvps_insert on public.rsvps for insert with check (true);
create policy seating_select on public.seating_tables for select using (public.is_event_accessible(event_id));
create policy seating_write on public.seating_tables for all using (public.event_role(event_id) in ('owner','planner','coordinator')) with check (public.event_role(event_id) in ('owner','planner','coordinator'));
create policy seating_assign_select on public.seating_assignments for select using (exists (select 1 from public.seating_tables t where t.id = table_id and public.is_event_accessible(t.event_id)));
create policy seating_assign_write on public.seating_assignments for all using (exists (select 1 from public.seating_tables t where t.id = table_id and public.event_role(t.event_id) in ('owner','planner','coordinator'))) with check (exists (select 1 from public.seating_tables t where t.id = table_id and public.event_role(t.event_id) in ('owner','planner','coordinator')));

create policy activity_select on public.activity_log for select using (public.is_event_accessible(event_id));
create policy activity_write on public.activity_log for insert with check (public.is_event_accessible(event_id));
create policy notifications_self on public.notifications for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy jobs_owner on public.scheduled_jobs for all using (event_id is null or public.event_role(event_id) in ('owner','planner')) with check (event_id is null or public.event_role(event_id) in ('owner','planner'));
