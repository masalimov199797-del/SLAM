-- SLAM: таблицы, права доступа и триггер push-уведомлений.
-- Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Перед запуском замените __PROJECT_URL__ на адрес проекта (Project URL), например https://abcdefgh.supabase.co

-- 1. Таблицы
create table if not exists public.reports (
  id          text primary key,
  site        text not null,
  worker_id   text not null,
  created_at  timestamptz not null,          -- время заполнения на телефоне
  data        jsonb not null,                -- весь чек-лист
  review      jsonb,                         -- решение по замечанию и его история
  notified_at timestamptz,                   -- когда отправлено push-уведомление
  received_at timestamptz not null default now()  -- когда чек-лист дошёл до базы
);
create index if not exists reports_worker_idx  on public.reports (worker_id);
create index if not exists reports_created_idx on public.reports (created_at desc);
create index if not exists reports_site_idx    on public.reports (site);

create table if not exists public.photos (
  id         text primary key,
  report_id  text not null,
  data       text not null,                  -- сжатое фото JPEG (data URI)
  created_at timestamptz not null default now()
);
create index if not exists photos_report_idx on public.photos (report_id);

create table if not exists public.config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subs (
  endpoint   text primary key,
  site       text not null,
  sub        jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2. Права доступа (демонстрационный прототип: вход без учётных записей)
alter table public.reports   enable row level security;
alter table public.photos    enable row level security;
alter table public.config    enable row level security;
alter table public.push_subs enable row level security;

drop policy if exists "slam read reports"   on public.reports;
drop policy if exists "slam insert reports" on public.reports;
drop policy if exists "slam review reports" on public.reports;
create policy "slam read reports"   on public.reports for select to anon using (true);
create policy "slam insert reports" on public.reports for insert to anon with check (true);
create policy "slam review reports" on public.reports for update to anon using (true) with check (true);
-- Из приложения можно менять только решение по замечанию
revoke update on public.reports from anon;
grant  update (review) on public.reports to anon;

drop policy if exists "slam read photos"   on public.photos;
drop policy if exists "slam insert photos" on public.photos;
create policy "slam read photos"   on public.photos for select to anon using (true);
create policy "slam insert photos" on public.photos for insert to anon with check (true);

drop policy if exists "slam config" on public.config;
create policy "slam config" on public.config for all to anon using (true) with check (true);

drop policy if exists "slam push subs" on public.push_subs;
create policy "slam push subs" on public.push_subs for all to anon using (true) with check (true);

-- 3. Триггер: после нового чек-листа вызвать функцию notify-lead
create extension if not exists pg_net with schema extensions;

create or replace function public.slam_notify_lead() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url     := 'https://ytzxcxyabsicvmslvqhv.supabase.co/functions/v1/notify-lead',
    body    := jsonb_build_object('record', jsonb_build_object('id', new.id)),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end $$;

drop trigger if exists slam_notify_lead on public.reports;
create trigger slam_notify_lead after insert on public.reports
  for each row execute function public.slam_notify_lead();
