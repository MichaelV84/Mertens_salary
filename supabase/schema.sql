create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  blocked boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade unique,
  base_rate numeric not null default 60,
  default_sick_hours numeric not null default 9,
  default_off_hours numeric not null default 9,
  created_at timestamptz not null default now()
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  shift_date date not null,
  start_time time not null,
  end_time time not null,
  day_type text not null check (day_type in ('work', 'sick', 'off')),
  is_manual_holiday boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, shift_date, start_time, end_time)
);

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  holiday_date date not null,
  holiday_type text not null default 'full' check (holiday_type in ('eve', 'full', 'yom_kippur_eve', 'yom_kippur_full')),
  label text,
  created_at timestamptz not null default now(),
  unique (user_id, holiday_date)
);

alter table public.holidays
add column if not exists holiday_type text not null default 'full';

alter table public.settings
alter column default_sick_hours set default 9,
alter column default_off_hours set default 9;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'holidays_holiday_type_check'
  ) then
    alter table public.holidays
    drop constraint holidays_holiday_type_check;
  end if;

  alter table public.holidays
  add constraint holidays_holiday_type_check
  check (holiday_type in ('eve', 'full', 'yom_kippur_eve', 'yom_kippur_full'));
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'holidays_user_id_holiday_date_key'
  ) then
    alter table public.holidays
    add constraint holidays_user_id_holiday_date_key unique (user_id, holiday_date);
  end if;
end $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid() and is_admin = true
  );
$$;

alter table public.users enable row level security;
alter table public.settings enable row level security;
alter table public.shifts enable row level security;
alter table public.holidays enable row level security;

drop policy if exists "users read self" on public.users;
drop policy if exists "users read all for admin" on public.users;
drop policy if exists "users update self" on public.users;
drop policy if exists "users update admin" on public.users;
drop policy if exists "settings all self" on public.settings;
drop policy if exists "shifts all self" on public.shifts;
drop policy if exists "holidays all self" on public.holidays;

create policy "users read self" on public.users
for select using (auth.uid() = id);

create policy "users read all for admin" on public.users
for select using (public.is_admin());

create policy "users update self" on public.users
for update using (auth.uid() = id)
with check (
  auth.uid() = id
  and public.is_admin() = false
);

create policy "users update admin" on public.users
for update using (public.is_admin())
with check (public.is_admin());

create policy "settings all self" on public.settings
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "shifts all self" on public.shifts
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "holidays all self" on public.holidays
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.users (id, email) values (new.id, new.email);
  insert into public.settings (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
