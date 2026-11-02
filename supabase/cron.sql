-- Rappels : appelle la fonction send-reminders toutes les 10 minutes. À lancer APRÈS avoir déployé la fonction.
-- Remplacer <PROJECT_REF> (l'identifiant du projet, dans l'URL https://<PROJECT_REF>.supabase.co)
-- et <CRON_SECRET> (le même secret que celui enregistré pour la fonction). Voir docs/supabase.md.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('sillage-rappels') where exists (select 1 from cron.job where jobname = 'sillage-rappels');

select cron.schedule(
	'sillage-rappels',
	'*/10 * * * *',
	$$
	select net.http_post(
		url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
		headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
		body := '{}'::jsonb
	);
	$$
);
