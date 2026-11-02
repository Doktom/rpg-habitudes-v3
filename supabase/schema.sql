-- Le Sillage (RPG Habitudes V3) : base Supabase. À coller dans SQL Editor > New query, puis Run.
-- Voir docs/supabase.md. Le script peut être relancé sans risque.

-- 1. Les données de l'app : un document par utilisateur, versionné (rev) pour fusionner entre appareils.
create table if not exists public.app_state (
	user_id uuid primary key references auth.users on delete cascade,
	data jsonb not null,
	rev bigint not null default 1,
	updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "app_state: lire les siennes" on public.app_state;
create policy "app_state: lire les siennes" on public.app_state for select using (auth.uid() = user_id);

-- Écriture uniquement par push_state, qui vérifie la révision attendue (sinon : conflit, l'app fusionne et réessaie).
create or replace function public.push_state(p_data jsonb, p_expected bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
	new_rev bigint;
begin
	if auth.uid() is null then
		raise exception 'non connecté';
	end if;
	if p_expected = 0 then
		insert into app_state (user_id, data, rev) values (auth.uid(), p_data, 1)
		on conflict (user_id) do nothing
		returning rev into new_rev;
	else
		update app_state set data = p_data, rev = rev + 1, updated_at = now()
		where user_id = auth.uid() and rev = p_expected
		returning rev into new_rev;
	end if;
	return new_rev; -- null : un autre appareil a écrit entre-temps
end;
$$;

revoke all on function public.push_state(jsonb, bigint) from public, anon;
grant execute on function public.push_state(jsonb, bigint) to authenticated;

-- 2. Abonnements aux notifications push (un par navigateur / appareil).
create table if not exists public.push_subscriptions (
	endpoint text primary key,
	user_id uuid not null references auth.users on delete cascade,
	p256dh text not null,
	auth text not null,
	device text,
	created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push: gérer les siens" on public.push_subscriptions;
create policy "push: gérer les siens" on public.push_subscriptions for all
	using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Rappels déjà envoyés (un par rappel et par jour), pour ne jamais envoyer deux fois.
create table if not exists public.reminder_log (
	user_id uuid not null references auth.users on delete cascade,
	key text not null,
	sent_at timestamptz not null default now(),
	primary key (user_id, key)
);

alter table public.reminder_log enable row level security; -- aucun accès depuis l'app : seule la fonction serveur écrit ici
