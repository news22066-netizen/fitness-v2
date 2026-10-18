-- Removes the old Telegram-version tables, then creates the website version.
drop table if exists merch_products, withdrawals, sessions, videos, payments, profiles, creators cascade;

create table creators (
  id uuid default gen_random_uuid() primary key,
  user_id uuid unique references auth.users(id) on delete cascade,
  name text not null,
  bkash_number text not null,
  youtube_channel_url text,
  telegram_community_link text not null,
  created_at timestamptz default now()
);
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone_number text,
  is_approved boolean default false,
  trial_creator_id uuid references creators(id) on delete set null,
  trial_ends_at timestamptz,
  created_at timestamptz default now()
);
create table payments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  creator_id uuid references creators(id),
  amount_bdt int not null,
  bkash_txn_id text unique not null,
  status text default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now()
);
create table videos (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references creators(id) on delete cascade,
  youtube_id text not null,
  title text not null,
  discipline text not null,
  duration_minutes int not null,
  created_at timestamptz default now()
);
create table sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  video_id uuid references videos(id) on delete cascade,
  reps int default 0,
  seconds int default 0,
  created_at timestamptz default now()
);
create table withdrawals (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references creators(id),
  amount_bdt int not null,
  fee_bdt int default 100,
  status text default 'pending',
  created_at timestamptz default now()
);
-- Draft for v2 (unused). Merch money is handled personally.
create table merch_products (
  id uuid default gen_random_uuid() primary key,
  creator_id uuid references creators(id),
  title text not null, price_bdt int not null, image_url text not null,
  is_active boolean default false, created_at timestamptz default now()
);
alter table creators enable row level security;
alter table profiles enable row level security;
alter table payments enable row level security;
alter table videos enable row level security;
alter table sessions enable row level security;
alter table withdrawals enable row level security;
alter table merch_products enable row level security;

-- STEP 2 (run AFTER the creator has signed up on the website once):
-- insert into creators (user_id, name, bkash_number, telegram_community_link)
-- select id, 'Belac', '01336105576', 'https://t.me/belac99' from auth.users where email = 'YOUR_EMAIL_HERE';
