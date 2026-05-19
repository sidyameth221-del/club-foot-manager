-- Soissons IFC: schema principal pour Supabase PostgreSQL

create extension if not exists pgcrypto;

-- Clubs (multi-clubs)
create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nom text not null,
  logo_path text,
  chat_restricted boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table clubs add column if not exists chat_restricted boolean not null default false;

create table if not exists equipes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  nom text not null,
  categorie text not null check (categorie in ('U9', 'U12', 'U18', 'U21', 'Seniors')),
  code_invitation text not null unique,
  created_at timestamptz not null default now()
);

-- Codes d'invitation: permettent d'assigner un role au moment de l'inscription.
-- Exemple: un code admin (sans equipe), ou un code coach lie a une equipe.
create table if not exists invitation_codes (
  code text primary key,
  kind text not null default 'club_member' check (kind in ('super_admin', 'club_admin_create', 'club_member')),
  role text not null check (role in ('joueur', 'coach', 'admin', 'super_admin')),
  club_id uuid references clubs(id) on delete set null,
  equipe_id uuid references equipes(id) on delete set null,
  active boolean not null default true,
  max_uses integer not null default 1 check (max_uses >= 1),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('joueur', 'coach', 'admin', 'super_admin')),
  nom text not null,
  photo text,
  club_id uuid references clubs(id) on delete set null,
  needs_club_setup boolean not null default false,
  equipe_id uuid references equipes(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists evenements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid references clubs(id) on delete set null,
  equipe_id uuid references equipes(id) on delete set null,
  type text not null check (type in ('match', 'entrainement')),
  date timestamptz not null,
  lieu text not null,
  infos text,
  created_at timestamptz not null default now()
);

create table if not exists presences (
  evenement_id uuid not null references evenements(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  statut text not null check (statut in ('present', 'absent', 'retard')),
  created_at timestamptz not null default now(),
  primary key (evenement_id, profile_id)
);

-- Convocations (match only)
create table if not exists event_convocations (
  evenement_id uuid not null references evenements(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (evenement_id, profile_id)
);

create index if not exists idx_event_convocations_event on event_convocations(evenement_id);
create index if not exists idx_event_convocations_profile on event_convocations(profile_id);

-- Covoiturage
create table if not exists event_vehicles (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references evenements(id) on delete cascade,
  owner_profile_id uuid references profiles(id) on delete set null,
  label text,
  seats_total integer not null default 0 check (seats_total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (evenement_id, owner_profile_id)
);

create index if not exists idx_event_vehicles_event on event_vehicles(evenement_id);
create index if not exists idx_event_vehicles_owner on event_vehicles(owner_profile_id);

create table if not exists event_vehicle_assignments (
  evenement_id uuid not null references evenements(id) on delete cascade,
  vehicle_id uuid not null references event_vehicles(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (vehicle_id, profile_id),
  unique (evenement_id, profile_id)
);

create index if not exists idx_event_vehicle_assignments_event on event_vehicle_assignments(evenement_id);
create index if not exists idx_event_vehicle_assignments_vehicle on event_vehicle_assignments(vehicle_id);
create index if not exists idx_event_vehicle_assignments_profile on event_vehicle_assignments(profile_id);

create table if not exists tests_physiques (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type_test text not null,
  score numeric(10, 2) not null,
  date timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table tests_physiques add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Classement (persisted team ranking)
create table if not exists classement_entries (
  id uuid primary key default gen_random_uuid(),
  equipe_id uuid not null references equipes(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  points integer not null default 0,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (equipe_id, profile_id)
);

create index if not exists idx_classement_entries_equipe_sort on classement_entries(equipe_id, sort_order);
create index if not exists idx_classement_entries_profile on classement_entries(profile_id);

-- Terrain tactique (11 points draggables + assignation de joueurs)
create table if not exists tactical_slots (
  id uuid primary key default gen_random_uuid(),
  equipe_id uuid not null references equipes(id) on delete cascade,
  slot_index integer not null check (slot_index >= 1 and slot_index <= 11),
  x numeric(5, 2) not null default 50,
  y numeric(5, 2) not null default 50,
  profile_id uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (equipe_id, slot_index)
);

create index if not exists idx_tactical_slots_equipe on tactical_slots(equipe_id);
create index if not exists idx_tactical_slots_profile on tactical_slots(profile_id);

-- Chat messages (persisted)
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_club_created_at on chat_messages(club_id, created_at);

-- Realtime (optional but recommended)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'chat_messages'
        and c.relkind = 'r'
    ) then
      begin
        alter publication supabase_realtime add table public.chat_messages;
      exception
        when duplicate_object then
          null;
      end;
    end if;

    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'profiles'
        and c.relkind = 'r'
    ) then
      begin
        alter publication supabase_realtime add table public.profiles;
      exception
        when duplicate_object then
          null;
      end;
    end if;

    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'tactical_slots'
        and c.relkind = 'r'
    ) then
      begin
        alter publication supabase_realtime add table public.tactical_slots;
      exception
        when duplicate_object then
          null;
      end;
    end if;

    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'player_competency_levels'
        and c.relkind = 'r'
    ) then
      begin
        alter publication supabase_realtime add table public.player_competency_levels;
      exception
        when duplicate_object then
          null;
      end;
    end if;
  end if;
end;
$$;

-- Migration helpers (if an older mono-club schema was applied before)
alter table equipes add column if not exists club_id uuid references clubs(id) on delete cascade;

create unique index if not exists uq_equipes_club_categorie on equipes(club_id, categorie);

alter table invitation_codes add column if not exists kind text;
alter table invitation_codes add column if not exists club_id uuid references clubs(id) on delete set null;
alter table invitation_codes add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table invitation_codes add column if not exists target_profile_id uuid references profiles(id) on delete set null;

alter table profiles add column if not exists club_id uuid references clubs(id) on delete set null;
alter table profiles add column if not exists needs_club_setup boolean not null default false;
alter table profiles add column if not exists is_approved boolean not null default true;

create table if not exists public.parent_children (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.profiles(id) on delete cascade not null,
  child_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (parent_id, child_id)
);
alter table public.parent_children enable row level security;

alter table evenements add column if not exists club_id uuid references clubs(id) on delete set null;

-- Ensure role/kind constraints exist with the expected allowed values
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('joueur', 'coach', 'admin', 'super_admin', 'parent'));

alter table invitation_codes drop constraint if exists invitation_codes_role_check;
alter table invitation_codes add constraint invitation_codes_role_check check (role in ('joueur', 'coach', 'admin', 'super_admin', 'parent'));

alter table invitation_codes drop constraint if exists invitation_codes_kind_check;
alter table invitation_codes add constraint invitation_codes_kind_check check (kind in ('super_admin', 'club_admin_create', 'club_member'));

-- Backfill: create a default club and attach legacy data
do $$
begin
  -- Only create the default club when migrating an older schema that already has data.
  if exists (select 1 from public.equipes limit 1)
    or exists (select 1 from public.profiles limit 1)
    or exists (select 1 from public.evenements limit 1)
    or exists (select 1 from public.invitation_codes limit 1)
  then
    insert into public.clubs (slug, nom)
    values ('soissons-ifc', 'Soissons IFC')
    on conflict (slug) do nothing;
  end if;
end $$;

update equipes
set club_id = (select id from clubs where slug = 'soissons-ifc')
where club_id is null;

update profiles p
set club_id = e.club_id
from equipes e
where p.club_id is null
  and p.role <> 'super_admin'
  and p.equipe_id is not null
  and e.id = p.equipe_id;

update evenements ev
set club_id = e.club_id
from equipes e
where ev.club_id is null
  and ev.equipe_id is not null
  and e.id = ev.equipe_id;

update invitation_codes i
set club_id = e.club_id
from equipes e
where i.club_id is null
  and i.equipe_id is not null
  and e.id = i.equipe_id;

update invitation_codes
set kind = 'club_member'
where kind is null;

create index if not exists idx_profiles_equipe_id on profiles(equipe_id);
create index if not exists idx_profiles_club_id on profiles(club_id);
create index if not exists idx_evenements_equipe_id on evenements(equipe_id);
create index if not exists idx_evenements_club_id on evenements(club_id);
create index if not exists idx_evenements_date on evenements(date);
create index if not exists idx_tests_physiques_profile_id on tests_physiques(profile_id);
create index if not exists idx_tests_physiques_date on tests_physiques(date);
create index if not exists idx_invitation_codes_equipe_id on invitation_codes(equipe_id);
create index if not exists idx_invitation_codes_club_id on invitation_codes(club_id);

-- Auto-create a public profile when a new auth user signs up.
-- The frontend must send metadata at signup:
--   { nom, photo?, invite_code }
-- NOTE: role is NOT trusted from the client; it's derived from invite_code.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom text;
  v_photo text;
  v_invite_code text;
  v_kind text;
  v_club_id uuid;
  v_equipe_id uuid;
  v_role text;
  v_needs_club_setup boolean := false;
  v_target_profile_id uuid;
begin
  -- Retrieve metadata
  v_invite_code := new.raw_user_meta_data->>'invite_code';
  v_nom := new.raw_user_meta_data->>'nom';
  v_photo := new.raw_user_meta_data->>'photo';

  if v_invite_code is null then
    raise exception 'invite_code is required';
  end if;

  if v_nom is null or v_nom = '' then
    raise exception 'nom is required';
  end if;

  -- Invitation codes drive role + club assignment
  select i.kind, i.role, i.club_id, i.equipe_id, i.target_profile_id
  into v_kind, v_role, v_club_id, v_equipe_id, v_target_profile_id
  from invitation_codes i
  where i.code = v_invite_code
    and i.active = true
    and i.used_count < i.max_uses
    and (i.expires_at is null or i.expires_at > now())
  for update;

  if v_role is null or v_kind is null then
    raise exception 'invalid invite_code';
  end if;

  -- Consume the code (atomic)
  update invitation_codes
  set
    used_count = used_count + 1,
    active = case when used_count + 1 >= max_uses then false else active end
  where code = v_invite_code
    and used_count < max_uses
    and active = true;

  if v_kind = 'super_admin' then
    if v_role <> 'super_admin' then
      raise exception 'invalid super_admin invite';
    end if;
    v_club_id := null;
    v_equipe_id := null;
    v_needs_club_setup := false;
  elsif v_kind = 'club_admin_create' then
    if v_role <> 'admin' then
      raise exception 'invalid club_admin_create invite';
    end if;
    v_club_id := null;
    v_equipe_id := null;
    v_needs_club_setup := true;
  elsif v_kind = 'club_member' then
    if v_club_id is null then
      raise exception 'invite_code missing club_id';
    end if;

    -- For coach/joueur, equipe_id is required.
    if v_role in ('coach', 'joueur') and v_equipe_id is null then
      raise exception 'invite_code missing equipe_id';
    end if;

    if v_equipe_id is not null then
      if not exists (
        select 1
        from equipes e
        where e.id = v_equipe_id
          and e.club_id = v_club_id
      ) then
        raise exception 'invite_code equipe_id does not belong to club_id';
      end if;
    end if;
  else
    raise exception 'invalid invite_code kind';
  end if;

  if v_target_profile_id is not null then
    -- Claim profile: update existing ghost profile ID to new auth.uid (thanks to on update cascade)
    -- We need to update the id of the target_profile to the new user id.
    -- Wait, foreign keys might have ON UPDATE CASCADE. We need to make sure.
    -- Let's update the profiles table.
    update profiles
    set id = new.id, nom = v_nom, is_approved = true
    where id = v_target_profile_id;
  else
    insert into profiles (id, role, nom, photo, club_id, needs_club_setup, equipe_id, is_approved)
    values (new.id, v_role, v_nom, v_photo, v_club_id, v_needs_club_setup, v_equipe_id, true);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Helper: read the caller profile without RLS recursion
create or replace function public.my_profile()
returns table (role text, club_id uuid, equipe_id uuid)
language sql
security definer
set search_path = public
set row_security = off
as $$
  select p.role, p.club_id, p.equipe_id
  from public.profiles p
  where p.id = auth.uid();
$$;

grant execute on function public.my_profile() to authenticated;

-- RLS (minimal, safe default)
alter table clubs enable row level security;
alter table profiles enable row level security;
alter table equipes enable row level security;
alter table evenements enable row level security;
alter table presences enable row level security;
alter table tests_physiques enable row level security;
alter table invitation_codes enable row level security;
alter table chat_messages enable row level security;
alter table classement_entries enable row level security;
alter table tactical_slots enable row level security;
alter table event_convocations enable row level security;
alter table parent_children enable row level security;

-- parent_children policies:
drop policy if exists "Parents can view their children links" on parent_children;
create policy "Parents can view their children links" on parent_children
  for select using (auth.uid() = parent_id);

drop policy if exists "Admins can view all parent_children links" on parent_children;
create policy "Admins can view all parent_children links" on parent_children
  for select using (
    exists (
      select 1 from public.my_profile() me
      where me.role in ('admin', 'super_admin')
    )
  );

drop policy if exists "Parents can insert children links" on parent_children;
create policy "Parents can insert children links" on parent_children
  for insert with check (auth.uid() = parent_id);

drop policy if exists "Parents can delete children links" on parent_children;
create policy "Parents can delete children links" on parent_children
  for delete using (auth.uid() = parent_id);
alter table event_vehicles enable row level security;
alter table event_vehicle_assignments enable row level security;

-- profiles: user can read/update their own row
drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
for select
to authenticated
using (id = auth.uid());

-- Helper function to avoid infinite recursion when parents read children's teammates
create or replace function public.my_children_equipes()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select child.equipe_id
  from public.parent_children pc
  join public.profiles child on child.id = pc.child_id
  where pc.parent_id = auth.uid() and child.equipe_id is not null;
$$;

-- profiles: scoped select for admin/coach (needed to pick players for tests/classement)
drop policy if exists "profiles_select_scope" on profiles;
create policy "profiles_select_scope" on profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and profiles.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and profiles.equipe_id = me.equipe_id)
      or (
        me.role = 'parent'
        and profiles.equipe_id in (select public.my_children_equipes())
      )
      or (profiles.id = auth.uid())
  )
);

-- Suppression du FK pour permettre les profils fantômes
alter table profiles drop constraint if exists profiles_id_fkey;

-- Remplacement du ON DELETE CASCADE par un trigger
create or replace function public.handle_deleted_user()
returns trigger as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute procedure public.handle_deleted_user();

-- Fonction RPC sécurisée pour ajouter un enfant fantôme
create or replace function public.create_ghost_profile(p_nom text, p_club_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent_role text;
  v_new_id uuid;
begin
  -- Vérifier que l'appelant est bien un parent du même club
  select role into v_parent_role from public.profiles where id = auth.uid() and club_id = p_club_id;
  if v_parent_role <> 'parent' then
    raise exception 'Unauthorized: Only parents can create ghost profiles for this club.';
  end if;

  v_new_id := gen_random_uuid();

  insert into public.profiles (id, role, nom, club_id, is_approved)
  values (v_new_id, 'joueur', p_nom, p_club_id, false);

  insert into public.parent_children (parent_id, child_id)
  values (auth.uid(), v_new_id);

  return v_new_id;
end;
$$;

-- Fonction RPC pour valider un enfant par l'admin sans erreur RLS
create or replace function public.approve_ghost_profile(p_child_id uuid, p_equipe_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_club_id uuid;
  v_child_club_id uuid;
begin
  select club_id into v_admin_club_id from public.profiles where id = auth.uid() and role = 'admin';
  if v_admin_club_id is null then
    raise exception 'Unauthorized: Must be an admin';
  end if;

  select club_id into v_child_club_id from public.profiles where id = p_child_id;
  if v_child_club_id <> v_admin_club_id then
    raise exception 'Unauthorized: Profile is in a different club';
  end if;

  update public.profiles
  set is_approved = true, equipe_id = p_equipe_id
  where id = p_child_id;
end;
$$;

-- profiles: allow club admin (needs_club_setup) to claim a club_id once
drop policy if exists "profiles_admin_setup_update" on profiles;
create policy "profiles_admin_setup_update" on profiles
for update
to authenticated
using (
  id = auth.uid()
  and role = 'admin'
  and needs_club_setup = true
  and club_id is null
)
with check (
  id = auth.uid()
  and role = 'admin'
  and needs_club_setup = false
  and club_id is not null
);

-- IMPORTANT: no direct UPDATE on profiles for regular users (prevents role escalation).

-- clubs: authenticated users can read their club; super_admin can read all
drop policy if exists "clubs_select_authenticated" on clubs;
create policy "clubs_select_authenticated" on clubs
for select
to authenticated
using (
  exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and (
        p.role = 'super_admin'
        or p.club_id = clubs.id
        or clubs.created_by = auth.uid()
      )
  )
);

-- clubs: allow admin in setup to create exactly one club (created_by = auth.uid())
drop policy if exists "clubs_insert_admin_setup" on clubs;
create policy "clubs_insert_admin_setup" on clubs
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.needs_club_setup = true
      and p.club_id is null
  )
);

-- clubs: allow updates by super_admin or club admin of that club
drop policy if exists "clubs_update_admin" on clubs;
create policy "clubs_update_admin" on clubs
for update
to authenticated
using (
  exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and (
        p.role = 'super_admin'
        or (p.role = 'admin' and p.club_id = clubs.id)
      )
  )
)
with check (
  exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and (
        p.role = 'super_admin'
        or (p.role = 'admin' and p.club_id = clubs.id)
      )
  )
);

-- Public helper: fetch club branding by slug (used before login on the club subdomain)
create or replace function public.get_club_public(p_slug text)
returns table (id uuid, slug text, nom text, logo_path text)
language sql
security definer
set search_path = public
as $$
  select c.id, c.slug, c.nom, c.logo_path
  from clubs c
  where c.slug = p_slug
  limit 1;
$$;

grant execute on function public.get_club_public(text) to anon;
grant execute on function public.get_club_public(text) to authenticated;

-- Storage: bucket for club logos
-- NOTE: if Storage is disabled in your Supabase project, this section can be skipped.
insert into storage.buckets (id, name, public)
values ('club-logos', 'club-logos', true)
on conflict (id) do nothing;

-- Allow upload/update for super_admin and for club admin during setup, under a per-user prefix.
drop policy if exists "club_logos_insert" on storage.objects;
create policy "club_logos_insert" on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'club-logos'
  and name like ('clubs/' || auth.uid() || '/%')
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'super_admin'
        or (p.role = 'admin' and (p.needs_club_setup = true or p.club_id is not null))
      )
  )
);

drop policy if exists "club_logos_update" on storage.objects;
create policy "club_logos_update" on storage.objects
for update
to authenticated
using (
  bucket_id = 'club-logos'
  and name like ('clubs/' || auth.uid() || '/%')
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'super_admin'
        or (p.role = 'admin' and (p.needs_club_setup = true or p.club_id is not null))
      )
  )
)
with check (
  bucket_id = 'club-logos'
  and name like ('clubs/' || auth.uid() || '/%')
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'super_admin'
        or (p.role = 'admin' and (p.needs_club_setup = true or p.club_id is not null))
      )
  )
);

-- equipes: users can read teams of their club; super_admin can read all
drop policy if exists "equipes_select_authenticated" on equipes;
create policy "equipes_select_authenticated" on equipes
for select
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and me.club_id = equipes.club_id)
      or (
        me.role in ('coach', 'joueur')
        and me.equipe_id is not null
        and equipes.id = me.equipe_id
      )
  )
);

-- equipes: allow admin to insert teams for their club, including during setup for the club they just created
drop policy if exists "equipes_insert_admin" on equipes;
create policy "equipes_insert_admin" on equipes
for insert
to authenticated
with check (
  exists (
    select 1
    from profiles p
    where p.id = auth.uid()
      and (
        p.role = 'super_admin'
        or (
          p.role = 'admin'
          and (
            (p.club_id is not null and p.club_id = equipes.club_id)
            or (
              p.needs_club_setup = true
              and p.club_id is null
              and exists (select 1 from clubs c where c.id = equipes.club_id and c.created_by = auth.uid())
            )
          )
        )
      )
  )
);

-- evenements: authenticated users can read events of their club; super_admin can read all
drop policy if exists "evenements_select_team" on evenements;
create policy "evenements_select_team" on evenements
for select
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and me.club_id = evenements.club_id)
      or (
        me.role in ('coach', 'joueur')
        and me.equipe_id is not null
        and evenements.equipe_id = me.equipe_id
      )
      or (
        me.role = 'parent'
        and exists (
          select 1 from public.parent_children pc
          join public.profiles child on child.id = pc.child_id
          where pc.parent_id = auth.uid() and evenements.equipe_id = child.equipe_id
        )
      )
  )
);

-- evenements: coach/admin can create events in their scope
drop policy if exists "evenements_insert_scope" on evenements;
create policy "evenements_insert_scope" on evenements
for insert
to authenticated
with check (
  exists (
    select 1
    from public.my_profile() me
    where
      me.role = 'super_admin'
      or (
        me.role = 'admin'
        and me.club_id is not null
        and evenements.club_id = me.club_id
      )
      or (
        me.role = 'coach'
        and me.club_id is not null
        and me.equipe_id is not null
        and evenements.club_id = me.club_id
        and evenements.equipe_id = me.equipe_id
      )
  )
);

-- evenements: coach/admin can update/delete events in their scope
drop policy if exists "evenements_update_scope" on evenements;
create policy "evenements_update_scope" on evenements
for update
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    where
      me.role = 'super_admin'
      or (
        me.role = 'admin'
        and me.club_id is not null
        and evenements.club_id = me.club_id
      )
      or (
        me.role = 'coach'
        and me.club_id is not null
        and me.equipe_id is not null
        and evenements.club_id = me.club_id
        and evenements.equipe_id = me.equipe_id
      )
  )
)
with check (
  exists (
    select 1
    from public.my_profile() me
    where
      me.role = 'super_admin'
      or (
        me.role = 'admin'
        and me.club_id is not null
        and evenements.club_id = me.club_id
      )
      or (
        me.role = 'coach'
        and me.club_id is not null
        and me.equipe_id is not null
        and evenements.club_id = me.club_id
        and evenements.equipe_id = me.equipe_id
      )
  )
);

drop policy if exists "evenements_delete_scope" on evenements;
create policy "evenements_delete_scope" on evenements
for delete
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    where
      me.role = 'super_admin'
      or (
        me.role = 'admin'
        and me.club_id is not null
        and evenements.club_id = me.club_id
      )
      or (
        me.role = 'coach'
        and me.club_id is not null
        and me.equipe_id is not null
        and evenements.club_id = me.club_id
        and evenements.equipe_id = me.equipe_id
      )
  )
);

-- presences: select within scope
drop policy if exists "presences_select_scope" on presences;
create policy "presences_select_scope" on presences
for select
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.evenements ev on ev.id = presences.evenement_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and ev.club_id = me.club_id)
      or (me.role in ('coach', 'joueur') and me.equipe_id is not null and ev.equipe_id = me.equipe_id)
      or (
        me.role = 'parent'
        and exists (
          select 1 from public.parent_children pc
          join public.profiles child on child.id = pc.child_id
          where pc.parent_id = auth.uid() and ev.equipe_id = child.equipe_id
        )
      )
  )
);

-- presences: user can set their own presence; for match, must be convoked
drop policy if exists "presences_upsert_own" on presences;
create policy "presences_upsert_own" on presences
for insert
to authenticated
with check (
  (
    profile_id = auth.uid()
    and exists (select 1 from public.profiles mep where mep.id = auth.uid() and mep.role = 'joueur')
  )
  or (
    exists (
      select 1 from public.parent_children pc
      join public.profiles mep on mep.id = pc.parent_id
      where mep.id = auth.uid() and mep.role = 'parent' and pc.child_id = presences.profile_id
    )
  )
  and exists (
    select 1
    from public.my_profile() me
    join public.evenements ev on ev.id = presences.evenement_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and ev.club_id = me.club_id)
      or (me.role in ('coach', 'joueur') and me.equipe_id is not null and ev.equipe_id = me.equipe_id)
  )
  and (
    exists (select 1 from public.evenements ev2 where ev2.id = presences.evenement_id and ev2.type = 'entrainement')
    or exists (
      select 1
      from public.evenements ev3
      where ev3.id = presences.evenement_id
        and ev3.type = 'match'
        and exists (
          select 1
          from public.event_convocations c
          where c.evenement_id = presences.evenement_id
            and c.profile_id = auth.uid()
        )
    )
  )
);

drop policy if exists "presences_update_own" on presences;
create policy "presences_update_own" on presences
for update
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1 from public.parent_children pc
    join public.profiles mep on mep.id = pc.parent_id
    where mep.id = auth.uid() and mep.role = 'parent' and pc.child_id = presences.profile_id
  )
)
with check (
  (
    profile_id = auth.uid()
    and exists (select 1 from public.profiles mep where mep.id = auth.uid() and mep.role = 'joueur')
  )
  or (
    exists (
      select 1 from public.parent_children pc
      join public.profiles mep on mep.id = pc.parent_id
      where mep.id = auth.uid() and mep.role = 'parent' and pc.child_id = presences.profile_id
    )
  )
  and (
    exists (select 1 from public.evenements ev2 where ev2.id = presences.evenement_id and ev2.type = 'entrainement')
    or exists (
      select 1
      from public.evenements ev3
      where ev3.id = presences.evenement_id
        and ev3.type = 'match'
        and exists (
          select 1
          from public.event_convocations c
          where c.evenement_id = presences.evenement_id
            and c.profile_id = auth.uid()
        )
    )
  )
);

drop policy if exists "presences_insert_scope" on presences;
drop policy if exists "presences_update_scope" on presences;

-- convocation: select within scope
drop policy if exists "event_convocations_select" on event_convocations;
create policy "event_convocations_select" on event_convocations
for select
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.evenements ev on ev.id = event_convocations.evenement_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and ev.club_id = me.club_id)
      or (me.role in ('coach', 'joueur') and me.equipe_id is not null and ev.equipe_id = me.equipe_id)
      or (
        me.role = 'parent'
        and exists (
          select 1 from public.parent_children pc
          join public.profiles child on child.id = pc.child_id
          where pc.parent_id = auth.uid() and ev.equipe_id = child.equipe_id
        )
      )
  )
);

-- convocation: coach/admin manage convoked list for match
drop policy if exists "event_convocations_insert" on event_convocations;
create policy "event_convocations_insert" on event_convocations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.my_profile() me
    join public.evenements ev on ev.id = event_convocations.evenement_id
    join public.profiles p on p.id = event_convocations.profile_id
    where
      me.role = 'super_admin'
      or (
        me.role = 'admin'
        and me.club_id is not null
        and ev.club_id = me.club_id
        and p.club_id = me.club_id
      )
      or (
        me.role = 'coach'
        and me.equipe_id is not null
        and ev.equipe_id = me.equipe_id
        and p.equipe_id = me.equipe_id
      )
  )
  and exists (select 1 from public.evenements ev2 where ev2.id = event_convocations.evenement_id and ev2.type = 'match')
);

drop policy if exists "event_convocations_delete" on event_convocations;
create policy "event_convocations_delete" on event_convocations
for delete
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.evenements ev on ev.id = event_convocations.evenement_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and ev.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and ev.equipe_id = me.equipe_id)
  )
);

-- vehicles: select within scope
drop policy if exists "event_vehicles_select" on event_vehicles;
create policy "event_vehicles_select" on event_vehicles
for select
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.evenements ev on ev.id = event_vehicles.evenement_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and ev.club_id = me.club_id)
      or (me.role in ('coach', 'joueur') and me.equipe_id is not null and ev.equipe_id = me.equipe_id)
      or (
        me.role = 'parent'
        and exists (
          select 1 from public.parent_children pc
          join public.profiles child on child.id = pc.child_id
          where pc.parent_id = auth.uid() and ev.equipe_id = child.equipe_id
        )
      )
  )
);

-- vehicles: owner can manage their own vehicle; coach/admin can manage in scope (including independent vehicles)
drop policy if exists "event_vehicles_insert" on event_vehicles;
create policy "event_vehicles_insert" on event_vehicles
for insert
to authenticated
with check (
  exists (
    select 1
    from public.my_profile() me
    join public.evenements ev on ev.id = event_vehicles.evenement_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and ev.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and ev.equipe_id = me.equipe_id)
      or (me.role = 'joueur' and me.equipe_id is not null and ev.equipe_id = me.equipe_id and event_vehicles.owner_profile_id = auth.uid())
      or (
        me.role = 'parent'
        and exists (
          select 1 from public.parent_children pc
          join public.profiles child on child.id = pc.child_id
          where pc.parent_id = auth.uid() and ev.equipe_id = child.equipe_id and pc.child_id = event_vehicles.owner_profile_id
        )
      )
  )
);

drop policy if exists "event_vehicles_update" on event_vehicles;
create policy "event_vehicles_update" on event_vehicles
for update
to authenticated
using (
  event_vehicles.owner_profile_id = auth.uid()
  or exists (
    select 1 from public.parent_children pc
    join public.profiles mep on mep.id = pc.parent_id
    where mep.id = auth.uid() and mep.role = 'parent' and pc.child_id = event_vehicles.owner_profile_id
  )
  or exists (
    select 1
    from public.my_profile() me
    join public.evenements ev on ev.id = event_vehicles.evenement_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and ev.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and ev.equipe_id = me.equipe_id)
  )
)
with check (
  event_vehicles.owner_profile_id = auth.uid()
  or exists (
    select 1 from public.parent_children pc
    join public.profiles mep on mep.id = pc.parent_id
    where mep.id = auth.uid() and mep.role = 'parent' and pc.child_id = event_vehicles.owner_profile_id
  )
  or exists (
    select 1
    from public.my_profile() me
    join public.evenements ev on ev.id = event_vehicles.evenement_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and ev.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and ev.equipe_id = me.equipe_id)
  )
);

drop policy if exists "event_vehicles_delete" on event_vehicles;
create policy "event_vehicles_delete" on event_vehicles
for delete
to authenticated
using (
  event_vehicles.owner_profile_id = auth.uid()
  or exists (
    select 1 from public.parent_children pc
    join public.profiles mep on mep.id = pc.parent_id
    where mep.id = auth.uid() and mep.role = 'parent' and pc.child_id = event_vehicles.owner_profile_id
  )
  or exists (
    select 1
    from public.my_profile() me
    join public.evenements ev on ev.id = event_vehicles.evenement_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and ev.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and ev.equipe_id = me.equipe_id)
  )
);

-- vehicle assignments: select within scope
drop policy if exists "event_vehicle_assignments_select" on event_vehicle_assignments;
create policy "event_vehicle_assignments_select" on event_vehicle_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.evenements ev on ev.id = event_vehicle_assignments.evenement_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and ev.club_id = me.club_id)
      or (me.role in ('coach', 'joueur') and me.equipe_id is not null and ev.equipe_id = me.equipe_id)
  )
);

-- vehicle assignments: coach/admin can assign players within the same scope, to vehicles of this event
drop policy if exists "event_vehicle_assignments_insert" on event_vehicle_assignments;
create policy "event_vehicle_assignments_insert" on event_vehicle_assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.my_profile() me
    join public.evenements ev on ev.id = event_vehicle_assignments.evenement_id
    join public.event_vehicles v on v.id = event_vehicle_assignments.vehicle_id and v.evenement_id = event_vehicle_assignments.evenement_id
    join public.profiles p on p.id = event_vehicle_assignments.profile_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and ev.club_id = me.club_id and p.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and ev.equipe_id = me.equipe_id and p.equipe_id = me.equipe_id)
  )
);

drop policy if exists "event_vehicle_assignments_delete" on event_vehicle_assignments;
create policy "event_vehicle_assignments_delete" on event_vehicle_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.evenements ev on ev.id = event_vehicle_assignments.evenement_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and ev.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and ev.equipe_id = me.equipe_id)
  )
);

-- Chat RLS
drop policy if exists "chat_messages_select" on chat_messages;
create policy "chat_messages_select" on chat_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.clubs c on c.id = chat_messages.club_id
    where
      me.role = 'super_admin'
      or (
        me.club_id is not null
        and me.club_id = chat_messages.club_id
        and (
          c.chat_restricted = false
          or me.role in ('admin', 'coach')
        )
      )
  )
);

drop policy if exists "chat_messages_insert" on chat_messages;
create policy "chat_messages_insert" on chat_messages
for insert
to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1
    from public.my_profile() me
    join public.clubs c on c.id = chat_messages.club_id
    where
      me.role = 'super_admin'
      or (
        me.club_id is not null
        and me.club_id = chat_messages.club_id
        and (
          c.chat_restricted = false
          or me.role in ('admin', 'coach')
        )
      )
  )
);

drop policy if exists "chat_messages_delete" on chat_messages;
create policy "chat_messages_delete" on chat_messages
for delete
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    where
      me.role = 'super_admin'
      or (
        me.role in ('admin')
        and me.club_id is not null
        and me.club_id = chat_messages.club_id
      )
  )
);

-- Chat admin actions (RPC)
create or replace function public.set_chat_restricted(p_club_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_role text;
  v_club_id uuid;
begin
  select role, club_id into v_role, v_club_id
  from public.profiles
  where id = auth.uid();

  if v_role = 'super_admin' then
    update public.clubs set chat_restricted = p_value where id = p_club_id;
    return;
  end if;

  if v_role in ('admin') and v_club_id = p_club_id then
    update public.clubs set chat_restricted = p_value where id = p_club_id;
    return;
  end if;

  raise exception 'not allowed';
end;
$$;

grant execute on function public.set_chat_restricted(uuid, boolean) to authenticated;

create or replace function public.reset_chat(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_role text;
  v_club_id uuid;
begin
  select role, club_id into v_role, v_club_id
  from public.profiles
  where id = auth.uid();

  if v_role = 'super_admin' then
    delete from public.chat_messages where club_id = p_club_id;
    return;
  end if;

  if v_role in ('admin') and v_club_id = p_club_id then
    delete from public.chat_messages where club_id = p_club_id;
    return;
  end if;

  raise exception 'not allowed';
end;
$$;

grant execute on function public.reset_chat(uuid) to authenticated;

-- Ensure the categorie constraint exists even if the table already existed.
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'equipes'
      and c.conname = 'equipes_categorie_check'
  ) then
    alter table equipes
      add constraint equipes_categorie_check
      check (categorie in ('U9', 'U12', 'U18', 'U21', 'Seniors'));
  end if;
end $$;

-- invitation_codes:
-- - super_admin: manage all
-- - club admin: manage club_member codes of their club (admin/coach/joueur)
-- - coach: manage club_member codes for their equipe (coach/joueur)
drop policy if exists "invitation_codes_select" on invitation_codes;
create policy "invitation_codes_select" on invitation_codes
for select
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    where
      me.role = 'super_admin'
      or (
        me.role = 'admin'
        and invitation_codes.kind = 'club_member'
        and me.club_id is not null
        and invitation_codes.club_id = me.club_id
        and (
          (invitation_codes.role = 'admin' and invitation_codes.equipe_id is null)
          or (invitation_codes.role in ('coach', 'joueur') and invitation_codes.equipe_id is not null)
        )
      )
      or (
        me.role = 'coach'
        and invitation_codes.kind = 'club_member'
        and me.club_id is not null
        and me.equipe_id is not null
        and invitation_codes.club_id = me.club_id
        and invitation_codes.equipe_id = me.equipe_id
        and invitation_codes.role in ('coach', 'joueur')
      )
  )
);

drop policy if exists "invitation_codes_insert" on invitation_codes;
create policy "invitation_codes_insert" on invitation_codes
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.my_profile() me
    where
      me.role = 'super_admin'
      or (
        me.role = 'admin'
        and invitation_codes.kind = 'club_member'
        and me.club_id is not null
        and invitation_codes.club_id = me.club_id
        and (
          (invitation_codes.role = 'admin' and invitation_codes.equipe_id is null)
          or (invitation_codes.role in ('coach', 'joueur') and invitation_codes.equipe_id is not null)
        )
      )
      or (
        me.role = 'coach'
        and invitation_codes.kind = 'club_member'
        and me.club_id is not null
        and me.equipe_id is not null
        and invitation_codes.club_id = me.club_id
        and invitation_codes.equipe_id = me.equipe_id
        and invitation_codes.role in ('coach', 'joueur')
      )
  )
);

drop policy if exists "invitation_codes_update" on invitation_codes;
create policy "invitation_codes_update" on invitation_codes
for update
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    where
      me.role = 'super_admin'
      or (
        me.role = 'admin'
        and invitation_codes.kind = 'club_member'
        and me.club_id is not null
        and invitation_codes.club_id = me.club_id
        and (
          (invitation_codes.role = 'admin' and invitation_codes.equipe_id is null)
          or (invitation_codes.role in ('coach', 'joueur') and invitation_codes.equipe_id is not null)
        )
      )
      or (
        me.role = 'coach'
        and invitation_codes.kind = 'club_member'
        and me.club_id is not null
        and me.equipe_id is not null
        and invitation_codes.club_id = me.club_id
        and invitation_codes.equipe_id = me.equipe_id
        and invitation_codes.role in ('coach', 'joueur')
      )
  )
)
with check (
  exists (
    select 1
    from public.my_profile() me
    where
      me.role = 'super_admin'
      or (
        me.role = 'admin'
        and invitation_codes.kind = 'club_member'
        and me.club_id is not null
        and invitation_codes.club_id = me.club_id
        and (
          (invitation_codes.role = 'admin' and invitation_codes.equipe_id is null)
          or (invitation_codes.role in ('coach', 'joueur') and invitation_codes.equipe_id is not null)
        )
      )
      or (
        me.role = 'coach'
        and invitation_codes.kind = 'club_member'
        and me.club_id is not null
        and me.equipe_id is not null
        and invitation_codes.club_id = me.club_id
        and invitation_codes.equipe_id = me.equipe_id
        and invitation_codes.role in ('coach', 'joueur')
      )
  )
);

-- tests_physiques: user can read their own test rows
drop policy if exists "tests_select_own" on tests_physiques;
create policy "tests_select_own" on tests_physiques
for select
to authenticated
using (profile_id = auth.uid());

-- tests_physiques: coach/admin can read tests in their scope
drop policy if exists "tests_select_scope" on tests_physiques;
create policy "tests_select_scope" on tests_physiques
for select
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.profiles p on p.id = tests_physiques.profile_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and p.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and p.equipe_id = me.equipe_id)
  )
);

-- tests_physiques: coach/admin can insert evaluations in their scope
drop policy if exists "tests_insert_scope" on tests_physiques;
create policy "tests_insert_scope" on tests_physiques
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.my_profile() me
    join public.profiles p on p.id = tests_physiques.profile_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and p.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and p.equipe_id = me.equipe_id)
  )
);

-- Classement RLS
drop policy if exists "classement_select" on classement_entries;
create policy "classement_select" on classement_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.equipes e on e.id = classement_entries.equipe_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and e.club_id = me.club_id)
      or (me.role in ('coach', 'joueur') and me.equipe_id is not null and classement_entries.equipe_id = me.equipe_id)
  )
);

drop policy if exists "classement_insert" on classement_entries;
create policy "classement_insert" on classement_entries
for insert
to authenticated
with check (
  exists (
    select 1
    from public.my_profile() me
    join public.equipes e on e.id = classement_entries.equipe_id
    join public.profiles p on p.id = classement_entries.profile_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and e.club_id = me.club_id and p.club_id = me.club_id)
      or (
        me.role = 'coach'
        and me.equipe_id is not null
        and classement_entries.equipe_id = me.equipe_id
        and p.equipe_id = me.equipe_id
      )
  )
);

drop policy if exists "classement_update" on classement_entries;
create policy "classement_update" on classement_entries
for update
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.equipes e on e.id = classement_entries.equipe_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and e.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and classement_entries.equipe_id = me.equipe_id)
  )
)
with check (
  exists (
    select 1
    from public.my_profile() me
    join public.equipes e on e.id = classement_entries.equipe_id
    join public.profiles p on p.id = classement_entries.profile_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and e.club_id = me.club_id and p.club_id = me.club_id)
      or (
        me.role = 'coach'
        and me.equipe_id is not null
        and classement_entries.equipe_id = me.equipe_id
        and p.equipe_id = me.equipe_id
      )
  )
);

drop policy if exists "classement_delete" on classement_entries;
create policy "classement_delete" on classement_entries
for delete
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.equipes e on e.id = classement_entries.equipe_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and e.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and classement_entries.equipe_id = me.equipe_id)
  )
);

-- tactical_slots RLS
drop policy if exists "tactical_slots_select" on tactical_slots;
create policy "tactical_slots_select" on tactical_slots
for select
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.equipes e on e.id = tactical_slots.equipe_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and e.club_id = me.club_id)
      or (me.role in ('coach', 'joueur') and me.equipe_id is not null and tactical_slots.equipe_id = me.equipe_id)
  )
);

drop policy if exists "tactical_slots_insert" on tactical_slots;
create policy "tactical_slots_insert" on tactical_slots
for insert
to authenticated
with check (
  exists (
    select 1
    from public.my_profile() me
    join public.equipes e on e.id = tactical_slots.equipe_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and e.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and tactical_slots.equipe_id = me.equipe_id)
  )
  and (
    tactical_slots.profile_id is null
    or exists (
      select 1
      from public.profiles p
      where p.id = tactical_slots.profile_id
        and p.role = 'joueur'
        and p.equipe_id = tactical_slots.equipe_id
    )
  )
);

drop policy if exists "tactical_slots_update" on tactical_slots;
create policy "tactical_slots_update" on tactical_slots
for update
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.equipes e on e.id = tactical_slots.equipe_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and e.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and tactical_slots.equipe_id = me.equipe_id)
  )
)
with check (
  exists (
    select 1
    from public.my_profile() me
    join public.equipes e on e.id = tactical_slots.equipe_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and e.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and tactical_slots.equipe_id = me.equipe_id)
  )
  and (
    tactical_slots.profile_id is null
    or exists (
      select 1
      from public.profiles p
      where p.id = tactical_slots.profile_id
        and p.role = 'joueur'
        and p.equipe_id = tactical_slots.equipe_id
    )
  )
);

drop policy if exists "tactical_slots_delete" on tactical_slots;
create policy "tactical_slots_delete" on tactical_slots
for delete
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.equipes e on e.id = tactical_slots.equipe_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and e.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and tactical_slots.equipe_id = me.equipe_id)
  )
);

-- Competency Framework Tables (Tests/Évaluations)

-- Competency categories and definitions with levels
create table if not exists competency_framework (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  category text not null check (category in ('Technique', 'Mental', 'Tactique', 'Physique', 'Perceptif', 'Cognitif')),
  competency_name text not null,
  level_rank integer not null check (level_rank >= 1 and level_rank <= 10),
  level_name text not null,
  level_description text,
  created_at timestamptz not null default now(),
  unique (club_id, category, competency_name, level_rank)
);

create index if not exists idx_competency_framework_club_category on competency_framework(club_id, category);
create index if not exists idx_competency_framework_competency on competency_framework(club_id, competency_name);

-- Player competency levels (what level is each player at for each competency)
create table if not exists player_competency_levels (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  competency_id uuid not null references competency_framework(id) on delete cascade,
  current_level_rank integer not null check (current_level_rank >= 1 and current_level_rank <= 10),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (profile_id, competency_id)
);

create index if not exists idx_player_competency_levels_profile on player_competency_levels(profile_id);
create index if not exists idx_player_competency_levels_competency on player_competency_levels(competency_id);
create index if not exists idx_player_competency_levels_updated_by on player_competency_levels(updated_by);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.player_competency_levels;
    exception
      when duplicate_object then
        null;
    end;
  end if;
end;
$$;

-- Enable RLS on competency tables
alter table competency_framework enable row level security;
alter table player_competency_levels enable row level security;

-- competency_framework: users can read all competencies within their club scope
drop policy if exists "competency_framework_select" on competency_framework;
create policy "competency_framework_select" on competency_framework
for select
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    where
      me.role = 'super_admin'
      or (me.club_id is not null and competency_framework.club_id = me.club_id)
  )
);

-- player_competency_levels: player can read own level; coach/admin can read team scope
drop policy if exists "player_competency_levels_select_own" on player_competency_levels;
create policy "player_competency_levels_select_own" on player_competency_levels
for select
to authenticated
using (
  profile_id = auth.uid()
  or exists (
    select 1
    from public.my_profile() me
    join public.profiles p on p.id = player_competency_levels.profile_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and p.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and p.equipe_id = me.equipe_id)
  )
);

-- player_competency_levels: only coach/admin can insert (not players)
drop policy if exists "player_competency_levels_insert" on player_competency_levels;
create policy "player_competency_levels_insert" on player_competency_levels
for insert
to authenticated
with check (
  updated_by = auth.uid()
  and exists (
    select 1
    from public.my_profile() me
    join public.profiles p on p.id = player_competency_levels.profile_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and p.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and p.equipe_id = me.equipe_id)
  )
);

-- player_competency_levels: only coach/admin can update (not players)
drop policy if exists "player_competency_levels_update" on player_competency_levels;
create policy "player_competency_levels_update" on player_competency_levels
for update
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.profiles p on p.id = player_competency_levels.profile_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and p.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and p.equipe_id = me.equipe_id)
  )
)
with check (
  updated_by = auth.uid()
  and exists (
    select 1
    from public.my_profile() me
    join public.profiles p on p.id = player_competency_levels.profile_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and p.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and p.equipe_id = me.equipe_id)
  )
);

-- player_competency_levels: only coach/admin can delete
drop policy if exists "player_competency_levels_delete" on player_competency_levels;
create policy "player_competency_levels_delete" on player_competency_levels
for delete
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.profiles p on p.id = player_competency_levels.profile_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and p.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and p.equipe_id = me.equipe_id)
  )
);

-- NOTE: en mode multi-clubs, les equipes doivent etre creees par club (lors du setup club).
