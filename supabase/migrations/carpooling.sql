-- Migration for Carpooling features
alter table event_vehicles add column if not exists driver_gender text check (driver_gender in ('pere', 'mere', 'autre'));
alter table event_vehicles add column if not exists has_child_present boolean not null default true;
alter table event_vehicles add column if not exists passenger_preference text check (passenger_preference in ('all', 'women_and_children', 'men_and_children')) default 'all';

alter table event_vehicle_assignments add column if not exists status text not null default 'pending' check (status in ('pending', 'approved', 'rejected'));

-- Update event_vehicle_assignments policies
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
      or (
        me.role = 'joueur' 
        and me.equipe_id is not null 
        and ev.equipe_id = me.equipe_id 
        and event_vehicle_assignments.profile_id = auth.uid()
      )
      or (
        me.role = 'parent'
        and exists (
          select 1 from public.parent_children pc
          join public.profiles child on child.id = pc.child_id
          where pc.parent_id = auth.uid() and ev.equipe_id = child.equipe_id and event_vehicle_assignments.profile_id = pc.child_id
        )
      )
  )
);

-- Owner of the vehicle can update assignments to approve/reject
drop policy if exists "event_vehicle_assignments_update" on event_vehicle_assignments;
create policy "event_vehicle_assignments_update" on event_vehicle_assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.my_profile() me
    join public.evenements ev on ev.id = event_vehicle_assignments.evenement_id
    join public.event_vehicles v on v.id = event_vehicle_assignments.vehicle_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and ev.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and ev.equipe_id = me.equipe_id)
      or (
        v.owner_profile_id = auth.uid()
      )
      or (
        me.role = 'parent'
        and exists (
          select 1 from public.parent_children pc
          where pc.parent_id = auth.uid() and pc.child_id = v.owner_profile_id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.my_profile() me
    join public.evenements ev on ev.id = event_vehicle_assignments.evenement_id
    join public.event_vehicles v on v.id = event_vehicle_assignments.vehicle_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and ev.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and ev.equipe_id = me.equipe_id)
      or (
        v.owner_profile_id = auth.uid()
      )
      or (
        me.role = 'parent'
        and exists (
          select 1 from public.parent_children pc
          where pc.parent_id = auth.uid() and pc.child_id = v.owner_profile_id
        )
      )
  )
);

-- Delete policy (users can cancel their own pending requests, owner can reject/delete, admins/coaches can delete)
drop policy if exists "event_vehicle_assignments_delete" on event_vehicle_assignments;
create policy "event_vehicle_assignments_delete" on event_vehicle_assignments
for delete
to authenticated
using (
  event_vehicle_assignments.profile_id = auth.uid()
  or exists (
    select 1 from public.parent_children pc
    where pc.parent_id = auth.uid() and pc.child_id = event_vehicle_assignments.profile_id
  )
  or exists (
    select 1
    from public.my_profile() me
    join public.evenements ev on ev.id = event_vehicle_assignments.evenement_id
    join public.event_vehicles v on v.id = event_vehicle_assignments.vehicle_id
    where
      me.role = 'super_admin'
      or (me.role = 'admin' and me.club_id is not null and ev.club_id = me.club_id)
      or (me.role = 'coach' and me.equipe_id is not null and ev.equipe_id = me.equipe_id)
      or (v.owner_profile_id = auth.uid())
      or (
        me.role = 'parent'
        and exists (
          select 1 from public.parent_children pc
          where pc.parent_id = auth.uid() and pc.child_id = v.owner_profile_id
        )
      )
  )
);
