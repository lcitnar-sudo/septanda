# Šeptanda cloud API — contract v1

All endpoints share the site origin, use JSON and `Cache-Control: no-store`. No service key is exposed. Authenticated calls send `Authorization: Bearer <Supabase access_token>`. Errors are `{error: string, code?: string}`. No call needs a client-supplied user ID.

## `GET /.netlify/functions/runtime-config`

Returns `{provider: "supabase"|"legacy", configured: boolean, supabase: {url, publishableKey}|null, consent: {version,text}, cloudAvailable: boolean}`. Defaults to legacy when Supabase URL/key/service role are absent. Consent version `2026-10-16-v1`, text `Chci e-mailem dostávat novinky o Šeptandě, nových hrách a tematických vydáních. Souhlas mohu kdykoli odvolat v nastavení účtu.`. Consent is optional and unchecked by default.

Supabase SDK signUp metadata MUST include `{display_name: nickname, marketing_opt_in: true|false, marketing_consent_version: config.consent.version}`. The auth.users insert trigger stores the server-controlled current text/version and server timestamp. Consent only becomes active when the e-mail is confirmed. Do not enable marketing merely based on user_metadata.

## `GET /.netlify/functions/player`

Requires access token verified against Supabase Auth. Returns `{account: {id,name,email,emailConfirmed}, state: v6|null, revision: integer, stats: {solved,spent,attempts,revealed,points}, consent: {granted,active,version,text,grantedAt,withdrawnAt,updatedAt}, admin: boolean}`. A null state means no cloud progress; offer opt-in local import. Never auto-merge another local account. Returned state is canonical v6 `{version:6, legacy:{progress:{}},days:{[YYYY-MM-DD]:{ids:[five IDs],selected:id,progress:{[id]:{attempts:[{id,text,time,score}],hints:["clue"|"small"|"previous"],status:"playing"|"won"|"revealed",draft:string}}}}}`. Optional attempt `id` should be generated once and preserved client-side. Scores/status/wallet are recomputed server-side.

## `POST /.netlify/functions/player`

Requires token. JSON `{action:"sync", state:v6, importLegacy?:boolean}`. Full monotonic merge: prior cloud history/hints/results cannot disappear; drafts/selection use the incoming request. Legacy v5 content (original nine puzzle IDs only) is accepted only on the first explicit legacy import (`importLegacy:true`); a server-owned `state.legacy.imported` flag prevents later replacement, even after initial blank sync. Immutable existing legacy remains. Incoming state points/status/score fields never grant awards. Archive dates must be valid and no later than Prague today; stored assignments are immutable and new dates use the reviewed personal pool. Returns same JSON as GET. Optimistic database revision compare-and-swap retries protect simultaneous devices; return 409 when retry budget is exceeded. Body max 2 MiB.

`{action:"profile",name:string}` changes public display name (2–24 characters). `{action:"consent",granted:boolean}` updates independent marketing preference with server current text/version and append-only audit event; false revokes immediately. Returns GET shape. Consent changes never change game access.

## `GET /.netlify/functions/cloud-leaderboard?date=YYYY-MM-DD`

Public, safe projection only. Date defaults Prague today and must not be in future. `{date,entries:[{rank,id,name,points,solved,completed,attempts}],me:null|{...same},total}`. Optional token populates `me`. Daily points = 200 per verified win − actual purchased hints (initial 100 is wallet only). No e-mails, guesses or consent are exposed. Maximum 100 entries. Public listing is based on server-generated daily_scores only.

## `GET /.netlify/functions/admin-users?filter=all|marketing&limit=50&offset=0`

Requires a verified token and membership in protected `septanda_admins` table, granted manually by database owner. Never trust metadata/claims named admin. Returns `{users:[{id,name,email,emailConfirmed,createdAt,stats,consent}],total,limit,offset}`. `marketing` returns only currently opted-in AND confirmed e-mail users. Only this endpoint ever lists account e-mails. A member may also read `?user=<UUID>` to obtain `{user,consentEvents:[{id,granted,version,text,recordedAt,source}]}` for consent history. Administration is read-only.

## Deployment notes

Netlify environment: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`), `SUPABASE_SERVICE_ROLE_KEY` server-only. Apply SQL migration before enabling variables. Supabase email auth must enable confirmations and allowed redirect URLs (production origin and local preview) and configure SMTP for a production audience. SDK handles sign-up/sign-in/reset/updateUser; server never accepts passwords. Legacy Blobs endpoint remains available when cloud is unconfigured; its personal-set validation checks approved IDs, account identity, earlier records and the frozen daily record. Existing scrypt/password records cannot silently be copied into Supabase; old users create/confirm a new email account and can explicitly import local progress.

## Personal assignments and progressive clues (5.2.0)

No new SQL migration or storage namespace. State remains v6. Optional additions: `assignmentVersion:1`, `assignmentSeed:"account:<32 hex>"` (server derives from verified user), `knownIds:[ID]` (additional previously seen IDs) and round `hintLevel:1|2|3` when `hints` includes `clue`. The three levels cost one existing 50-point purchase, never three charges. Highest purchased level survives stale writes.

GET player reserves today's approved five IDs before returning via the existing `septanda_commit_progress` CAS routine; competing requests reread and converge. Already stored IDs, including held archival puzzles, remain unchanged. A truly played offline set may replace an untouched reservation only with five approved, non-repeated IDs and the authenticated seed. Worked-on conflicting assignments return 409; the client preserves its divergent work in a private downloadable backup before adopting the server assignment. Explicit guest import remains opt-in.

New sets exclude all IDs assigned on earlier days, past worked/seen legacy IDs and `knownIds`. The 135-item approved pool yields at most 27 full personal sets; exhaustion returns an empty set and never loops. Original 509 identities and the shared 100-day calendar remain compatible for existing records. Different players may receive overlapping puzzles; rankings compare different personal sets.

Guidance reports literal matching content words against one accepted spelling plus three editorial clues. Internal score fields remain for archival compatibility and server acceptance; the UI no longer exposes semantic percentages as guidance.
