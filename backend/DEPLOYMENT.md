# Připravené propojení Netlify a Supabase

Pro Šeptandu je propojení se samostatným živým Supabase projektem nastavené. Netlify má uložené všechny tři hodnoty, odesílací doména auth.septanda.com je ověřená a Supabase používá Resend SMTP s českými šablonami. Skutečný Deploy Preview ověřil databázový žebříček a ochranu soukromého postupu. Doručení a první vlastní přihlášení ověří provozovatel po zveřejnění. Níže zůstává reprodukovatelný postup pro další prostředí. Místní hra pro hosty funguje vždy.

## Nastavení před zapnutím cloudových účtů

1. V Supabase založ projekt (pro české hráče obvykle evropský region). Silné databázové heslo ani klíč `service_role` neposílej hráčům a nevkládej do GitHubu.
2. V Supabase **SQL Editor** spusť obsah `supabase/migrations/202610160001_septanda_cloud.sql`. Migrace vytváří tabulky s předponou `septanda_`, přístupová práva, evidenci souhlasů a transakční ukládání. Neupravuje staré účty v Netlify Blobs.
3. V **Authentication → URL Configuration** nastav **Site URL** na skutečnou HTTPS adresu Šeptandy. Do povolených přesměrování přidej stejnou adresu a adresu s cestou používanou pro obnovu hesla. Pro místní náhled můžeš přidat `http://127.0.0.1:8785/`. Nepovoluj libovolné veřejné domény.
4. U přihlášení e-mailem zapni potvrzení adresy. Pro skutečné hráče nakonfiguruj vlastní SMTP a odesílací doménu. Vývojový odesílač Supabase má omezení; samotný soubor ZIP odesílání e-mailů nezapne.
5. V Netlify přidej serverové proměnné pro **Functions** (produkční kontext):
   - `SUPABASE_URL` — například `https://ID-PROJEKTU.supabase.co`.
   - `SUPABASE_PUBLISHABLE_KEY` — veřejný klíč `sb_publishable_…`; alternativně je podporován starší `SUPABASE_ANON_KEY` s rolí `anon`.
   - `SUPABASE_SERVICE_ROLE_KEY` — tajný klíč `service_role` nebo nový `sb_secret_…`, pouze pro serverové funkce.
6. Nasaď celý projekt přes propojený GitHub. Publikuje se složka `public`, funkce jsou v `netlify/functions`. Ověř, že zásady CSP v `public/_headers` dovolují spojení s tvým Supabase hostem. Skripty zůstávají lokální; případný vlastní Supabase API hostname doplň výslovně.
7. Vytvoř nový testovací účet, potvrď e-mail, odehraj kolo a přihlas se stejným účtem na druhém zařízení. Měl by se načíst celý postup včetně tipů a nápověd. Zkontroluj obnovení hesla i odvolání marketingového souhlasu.

Pouhá přítomnost proměnných neověřuje správnost projektu. Nesprávný klíč, nespouštěná migrace či chybné URL pro přesměrování způsobí nedostupnost cloudových funkcí; místní hra zůstane použitelná.

## Přístup správce

V Supabase **Authentication → Users** zkopíruj UUID svého potvrzeného účtu. V SQL Editoru jako vlastník projektu proveď:

```sql
insert into public.septanda_admins(user_id)
values ('SEM-PATRI-UUID-TVÉHO-ÚČTU') on conflict do nothing;
```

Nahraď ukázkový text skutečným UUID. Správa se v aplikaci nabídne jen členovi této tabulky. Odstraněním jeho řádku se právo odebere. Pole `admin` v registračních datech, e-mailové doméně ani přezdívce žádné právo nepřidává.

Přehled rozlišuje všechny registrované hráče a adresáty s aktivním souhlasem. E-mail je veřejnému žebříčku nepřístupný. Správcovský endpoint kontroluje aktuální přihlášení a členství před načtením seznamu. Administrace je pouze pro čtení, neumožňuje rozesílat e-maily.

## Souhlasy a e-maily

- Registrace funguje i bez marketingového souhlasu. Zaškrtávací políčko musí zůstat nepovinné a předem vypnuté.
- Registrační metadata nesou pouze výslovnou volbu a verzi. Databázový trigger sám načte platné znění a uloží čas ze serveru; nedůvěřuje textu ani datu od prohlížeče.
- Volba se zapíše hned při vzniku účtu, takže se neztratí při čekání na potvrzovací e-mail. Do marketingové skupiny se účet dostane až po potvrzení adresy.
- Pozdější změna se ukládá samostatným endpointem a připojí neměnnou auditní událost. Odvolání je okamžité; původní znění a datum udělení zůstanou v historii.
- Pouhé přepsání `user_metadata` neudělí správce ani neobnoví odvolaný souhlas.
- Před rozesílkou znovu použij filtr aktivního souhlasu a potvrzené adresy. Starý export nesmí převážit novější odvolání. Pro skutečné rozesílání je potřeba samostatný poskytovatel a funkční odhlašovací odkaz; aplikace zatím žádnou marketingovou zprávu neposílá.
- Provozovatel Lukáš Citnar a kontakt infoseptanda@gmail.com jsou potvrzené. Veřejné informace se sestavují z client/SOUKROMI.md do public/soukromi.html. Při změně poskytovatelů nebo účelu uprav skutečný provoz i tento text.

## Vyřizování žádostí a uchování zpráv

Žádosti přicházejí do infoseptanda@gmail.com. Správce zaznamená datum přijetí, ověří vlastnictví účtu přiměřeným způsobem a žádost vyřídí zpravidla do měsíce. Nikdy nežádá heslo. Cloudový účet se ruší přes Supabase Authentication; navázané tabulky se odstraní kaskádově. Před výmazem je potřeba konkrétní žádost a potvrzení vlastníka, nikoli pouhá podobnost přezdívky.

Při kontrole doručených zpráv správce zároveň kontroluje dokončené případy: nejpozději šest měsíců po vyřízení odstraní zprávu z Netlify Forms i Gmailu, včetně nepotřebných kopií a příloh. Případný záznam potřebný pro probíhající spor oddělí a zaznamená důvod i okamžik další kontroly. Tato kontrola je provozní postup správce; aplikace neslibuje automatický výmaz po šesti měsících.

Záznamy souhlasu se uchovávají s účtem a po jeho zrušení se mažou kaskádově. Odvolání v profilu ihned vyloučí hráče z marketingového filtru. Neaktivita sama účet nemaže. Při obnovení celé databáze ze zálohy je potřeba znovu uplatnit dříve vyřízené výmazy a odvolání.

## Přenos starších účtů a postupu

Původní účty v Netlify Blobs používají odlišné heslové otisky. Nelze je nepozorovaně přenést do Supabase. Po zapnutí Supabase si starší hráč založí a potvrdí e-mailový účet; data a hesla původních účtů se nemažou. Místní postup může výslovně importovat do nového účtu. Jiný hráč na stejném zařízení musí mít oddělené úložiště a nesmí automaticky získat cizí historii.

Import starší `legacy.progress` části je povolen pouze na výslovné první přenesení původních devíti hádanek. Server si první přenos poznamená; předchozí prázdné uložení nebo rozehraná nová denní sada jej nezablokují. Klient nemůže záznam o importu vymazat ani podvrhnout. Opakovaný import nepřidá nové odměny do starší části. U historických dnů je akceptován výhradně původní kalendář před začátkem připravené stovky denních sad. Nové dny používají závazný shodný kalendář na klientu i serveru.

## Co se ukládá a jak se řeší souběh zařízení

Soukromá data obsahují e-mail, přezdívku, celý v6 postup, všechny uložené tipy, zakoupené nápovědy, rozluštěné i odhalené hádanky a rozepsaný tip. Každý tip má stálé označení. Shodné odeslání se nepočítá dvakrát; starší zařízení nemůže vymazat již uložené tipy, nákupy nebo výsledky. Při konfliktu rozepsaného tipu a právě otevřeného výroku vyhraje poslední úspěšné uložení. Výsledky a body se počítají na serveru stejným hodnoticím modulem jako ve hře.

Databáze zamkne řádek a porovná revizi; postup, statistiky i denní pořadí se zapisují v jedné transakci. Při souběhu server znovu načte aktuální verzi a sloučí obě historie. Dokončený výsledek je neměnný, odhalený výrok nikdy dodatečně nevydělá body.

Veřejný žebříček zveřejňuje pouze přezdívku, veřejné ID, ověřené denní body a souhrnné počty. Počátečních 100 bodů patří peněžence; nejsou přičtené do denního soutěžního skóre. Odpovědi, e-maily, souhlasy a tokeny se do žebříčku neposílají.

## Ochrana dat a praktické limity

Všechny privátní tabulky mají RLS a výslovné omezení práv. Přihlášený prohlížeč smí číst jen vlastní řádky a nemá přímé právo zapisovat skóre, souhlasy ani role. Server ověřuje bearer token dotazem na aktuálního uživatele v Supabase Auth; pouhé rozbalení JWT není autentizace. Tajný klíč je pouze v prostředí funkcí. Odpovědi s účtem a správou mají `no-store`.

Jedno uložení má limit 2 MiB a jeden výrok 500 tipů. Příliš velký požadavek skončí s výslovnou chybou, nevypouští potichu starou historii. Pro větší dlouhodobé objemy je vhodné rozdělit tipy do samostatných řádků a ukládat po dávkách.

Ověření bodů neznamená neprůstřelnou ochranu soutěže: statický web obsahuje odpovědi v katalogu a odhodlaný uživatel je může přečíst. Pro soutěže o hodnotné ceny by bylo potřeba doručovat otázky i odpovědi ze serveru, zavést silnější omezení automatizace a ochranu proti více účtům.

Mazání účtu přes Supabase Auth kaskádově odstraní soukromý postup, profil, souhlasy, auditní události a žebříček. Obnova záloh, provozní přístup administrátorů a doba uchování zůstávají odpovědností provozovatele projektu.

## Lokální ověření bez živých účtů

`backend/test.mjs` spouští skutečný PostgreSQL engine PGlite v paměti, vytváří oddělené zkušební role `anon`, `authenticated` a `service_role`, provede migraci a ověří izolaci řádků, nepřístupné zápisy, souhlasy, ověření tokenu, souběžné revize i přepočet bodů. Test nepřipojuje Supabase a nepoužívá žádné osobní údaje.

Testovací závislost PGlite 0.5.10 je vývojová, nikoli součást serverových funkcí. Po instalaci závislostí celého projektu stačí `node backend/test.mjs`. Samostatný záložní testovací manifest je v `backend/qa/package.json`. Jeho postup:

```sh
cd backend/qa
pnpm install --frozen-lockfile
cd ../..
node backend/test.mjs
```

Po připojení skutečné služby je nutné samostatně ověřit doručení a kliknutí na e-mail, přesměrování při obnově hesla, skutečnou synchronizaci dvou zařízení a RLS na cílovém projektu. Lokální test tyto externí konfigurace nepotvrzuje.

## Primární dokumentace

- https://supabase.com/docs/reference/javascript/auth-getuser
- https://supabase.com/docs/guides/auth/managing-user-data
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/redirect-urls
