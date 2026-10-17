# Šeptanda — Netlify a Supabase

Web zůstává v existujícím projektu Netlify. Supabase zajišťuje e-mailové účty a databázi. Nasazení tohoto balíčku samo nevytváří Supabase projekt ani nenastavuje e-mailovou službu.

## 1. Nový projekt Supabase

V organizaci Lukas Citnar vytvoř samostatný projekt `septanda`. Jiný existující projekt neměň. Zvol evropský region a ulož si vygenerované databázové heslo. Ponech Enable Data API, vypni Automatically expose new tables a zapni Enable automatic RLS. Databázové heslo patří do správce hesel; hra ho nepotřebuje.

V novém projektu otevři **SQL Editor → New query**. Vlož celý obsah souboru `supabase/migrations/202610160001_septanda_cloud.sql` a spusť jej jednou. Vytvoří tabulky, vlastní přístupová pravidla a procedury; žádné existující přihlašovací údaje nepřevádí. Pokud editor vrátí chybu, nepouštěj zkrácené části naslepo — celá migrace je v transakci.

## 2. Přihlašování e-mailem

V **Authentication → Sign In / Providers → Email** zapni e-mail a potvrzování adresy. Aplikace podporuje e-mail + heslo, potvrzovací odkaz a obnovu hesla. Google přihlášení není v této integraci nastavené.

V **Authentication → URL Configuration** nastav Site URL na skutečnou veřejnou adresu hry, například `https://dazzling-kleicha-efa517.netlify.app/`. Do Redirect URLs přidej stejnou adresu a `https://dazzling-kleicha-efa517.netlify.app/?account=recovery`. Pro místní ověření lze přidat `http://127.0.0.1:8785/` a `http://127.0.0.1:8785/?account=recovery`. Pokud používáš projekt `fascinating-babsousa-5b2ee7`, nahraď doménu jeho adresou; oba projekty současně bez záměru nepropojuj.

Pro registrace skutečných hráčů nastav v Supabase také **vlastní SMTP** a ověřenou odesílací adresu. Výchozí odesílání Supabase je určené pro testy a omezuje příjemce; samotné založení projektu nestačí pro doručování potvrzení všem hráčům. Přihlašovací e-maily neobsahují marketing a nevyžadují souhlas s novinkami. [Oficiální návod SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [nastavení návratových adres](https://supabase.com/docs/guides/auth/redirect-urls).

## 3. Tři proměnné v Netlify

V Supabase v dialogu **Connect** nebo v nastavení API najdi Project URL a publishable key. Pro server vezmi odpovídající secret / service role key ze stejného projektu. V Netlify otevři **svůj stávající projekt → Environment variables** a přidej:

| Název | Hodnota | Použití |
| --- | --- | --- |
| `SUPABASE_URL` | `https://TVUJ-PROJEKT.supabase.co` | Adresa projektu |
| `SUPABASE_PUBLISHABLE_KEY` | Klíč `sb_publishable_…` | Veřejný klientský klíč |
| `SUPABASE_SERVICE_ROLE_KEY` | Serverový secret / service role klíč | Pouze Netlify Functions; označ jako tajný |

Pokud má Netlify volbu **Scopes**, pro tyto hodnoty postačuje **Functions**. Nevkládej serverový klíč do HTML, GitHubu, obrázku ani chatu. Není to databázové heslo. Přístup k datům klienta omezuje RLS; server ověřuje přihlášení a přepočítává skóre. [Pravidla RLS v Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

Připravená aplikace se přepne na Supabase až se všemi třemi platnými hodnotami. Bez nich používá dosavadní přihlášení. Po změně proměnných spusť nové nasazení.

## 4. Aktualizace z GitHubu

Nahraj **obsah složky projektu**, nikoli ZIP jako jeden soubor, do kořene stávajícího repozitáře `lcitnar-sudo/septanda`. Zachovej složky `client`, `backend`, `supabase`, `netlify/functions`, `scripts` a `legacy-server`. Soubor `netlify.toml` nastavuje sestavení `npm run build`, publikovanou složku `public` a funkce `netlify/functions`.

Commit do propojené větve `main` spustí Netlify automaticky. V Netlify → Deploys počkej na **Published**. Další ruční Netlify Drop není potřeba. Tato verze s cloudovými účty potřebuje serverové funkce: přetažení samotného `index.html` přenese vzhled a místní hru, nikoli cloudové ukládání.

Stávající starší soubory v kořeni repozitáře nebudou automaticky smazané nahráním ZIPu. Balíček obsahuje v README seznam aktuálních souborů; nový build používá výše uvedené adresáře. Původní Blobs úložiště zůstává zachované.

## 5. Správce a marketing

Nejprve si v nové hře vytvoř účet a potvrď e-mail. V Supabase **Authentication → Users** zkopíruj vlastní UUID. V SQL Editoru spusť (nahraď pouze UUID):

```sql
insert into public.septanda_admins(user_id)
values ('SEM-PATRI-TVUJE-UUID'::uuid)
on conflict do nothing;
```

Po obnovení profilu se objeví **Správa hráčů**. Jsou zde filtry všech hráčů a aktivních marketingových souhlasů. Právo správce vzniká pouze tímto záznamem; přezdívka ani údaje vložené při registraci ho neudělí. Odebrání:

```sql
delete from public.septanda_admins where user_id='SEM-PATRI-TVUJE-UUID'::uuid;
```

Souhlas s novinkami je samostatný, nepovinný a při registraci prázdný. Databáze uchovává čas, přesné znění, verzi i změny. Uživatel ho odvolá v účtu; marketingový filtr zahrnuje jen potvrzené e-maily s aktuálně uděleným souhlasem. Balíček neodesílá marketingové kampaně.

## 6. Napište nám

V Netlify **Forms** zapni **form detection** a poté web znovu nasaď. Po zpracování má být vidět formulář `septanda-contact`. Zprávy jsou v jeho Submissions. Pokud je chceš i e-mailem, přidej v Netlify oznámení o novém podání na svou adresu. Formulář má skrytou spamovou past a používá filtrování Netlify. V místním náhledu se zprávy neposílají. [Nastavení Netlify Forms](https://docs.netlify.com/manage/forms/setup/).

## 7. Přechod dosavadních hráčů

Staré účty a hesla z vlastní přihlašovací služby nelze tiše převést na účty Supabase. Hráč založí nový e-mailový účet a potvrdí adresu. Místní postup se přidá pouze po jeho výslovném potvrzení. Staré účty se nespojují podle nepotvrzeného e-mailu; jejich data v Blobs se nemažou.

Před přepnutím lze v dosavadní hře pod původním účtem exportovat jeho místní postup (zůstává v prohlížeči). Po přepnutí stále používej stejnou doménu, aby byl tento prohlížečový archiv dostupný. Vlastní doménu přidávej přednostně před pozváním veřejnosti: prohlížečové úložiště je vázané na původ adresy. Cloudový účet po přihlášení mezi doménami a zařízeními sdílí serverová data; v Supabase současně uprav povolené návratové adresy.

## 8. Ověření po propojení

1. V anonymním okně lze hrát bez účtu; zůstatek bodů není v hlavičce.
2. Registrace projde bez souhlasu s novinkami a přijde potvrzovací e-mail.
3. Po potvrzení a přihlášení se uloží vyřešená hádanka i historie. Druhé zařízení ji po přihlášení načte.
4. Odvolání souhlasu okamžitě odebere účet z marketingového filtru. Běžný hráč neotevře seznam e-mailů.
5. Obnova hesla se vrátí na hru a dovolí nové heslo.
6. Podání kontaktu se objeví ve Forms. Zprávy ze zkoušky označ nebo smaž jako zkušební.

Lokální testy balíčku prověřují databázová pravidla a herní logiku. Doručování e-mailů a skutečnou synchronizaci mezi zařízeními je potřeba ověřit po připojení tvého projektu.
