# Šeptanda 6.2.0 — Šeptá se to po staletí.

Funkční web pro stávající Netlify projekt, dobrovolné e-mailové účty Supabase a vlastní denní trojici pro každého hráče.

## Okamžitý přechod na autory

Hlavní hra od této verze automaticky převede i dnešní starší rozehranou sadu: celou ji uloží do `archivedDays` se stejnými body, cenami, tipy a rozepsanými odpověďmi. Přidělí novou osobní autorskou trojici bez jediného starého ID. Jednorázově při změně konceptu může hráč hrát novou trojici navíc; další dny opět platí tři. Archiv je dostupný i bez účtu a synchronizuje se serverově bez nové SQL migrace.

## Co obsahuje

- Hra bez povinné registrace, tři navazující hádanky denně podle pražského času.
- Nové sady: skutečný výrok a psaná odpověď se jménem autora nebo lidovým původem. Stopy vedou přes oblast a pramen ke čtyřem volitelným odpovědím. Balíček stojí jednou 50 bodů; správný původ přidá 200 bodů.
- Viditelné tlačítko „Přeskočit výrok · −100 bodů“ přímo u odpovědi. Před platbou zobrazí potvrzení, přeskočí právě daný výrok a naváže dalším v denní trojici; nevytváří náhradní otázku ani odměnu.
- Procenta už hráče nenavádějí. Dosavadní pravidlový modul ověřuje přijímané podoby a drobné odchylky; jeho číselná pole zůstávají interně pro kompatibilitu historie. Ve hře neběží AI.
- Supabase registrace, potvrzování e-mailu, přihlášení, obnova hesla, synchronizace, profil a samostatný souhlas s novinkami.
- Soukromá správa hráčů a audit souhlasů; veřejný žebříček neukazuje e-maily ani odpovědi.
- Kontaktní formulář přes Netlify Forms se spamovou pastí a stavem odesílání.
- Redakční kontrola všech 500 nových položek: 126 nových a 9 původních je schváleno pro nové osobní sady, 374 čeká na přepracování. Celkem 509 identit i starý kalendář 100 sad zůstávají pro historii. Ve starém režimu 135 položek stačilo na 45 trojic. Nový ověřený výběr obsahuje 51 položek s osobností a 84 anonymních rčení, střídá dvě různé osobnosti a nejvýše jedno rčení denně. Současná zásoba umožňuje nejvýše 25 takových trojic, podle dřívější historie méně. Po vyčerpání se obsah neopakuje.
- Průvodce Šeptík má šest vlastních průhledných ilustrací podle dodané reference: základ, přemýšlení, radost, překvapení, další pokus a objevování dokumentu. Reaguje na hru a psaní tipů.
- Náhled sdíleného odkazu obsahuje Šeptíka z brand balíčku. Veřejný obrázek `assets/social/septik-share-v1.png` (1080 × 1080 px) je uvedený přímo v HTML přes Open Graph a Twitter metadata; nevyžaduje přihlášení ani spuštění skriptů.

## Veřejná ukázka nové hry

`/ukazka.html` zůstává samostatnou ukázkou se třemi stálými cvičnými výroky. Používá stejnou hru, stopy a vyhodnocování, vlastní místní úložiště `septanda.demo.authors.v1` a neobsahuje přihlašovací ani síťové moduly. Cvičné body se nepřičítají do účtu. Hlavní stránka už přechází na skutečnou osobní autorskou sadu automaticky; ukázku k přechodu nepotřebuje.

## Zapojení

Postup po jednotlivých obrazovkách je v [NASTAVENI.md](NASTAVENI.md). Detailní rozhraní a provoz jsou v [backend/API-CONTRACT.md](backend/API-CONTRACT.md) a [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md).

Aktualizuj obsah existujícího GitHub repozitáře; Netlify se sestaví automaticky. Nic v balíčku samo nevytváří Supabase projekt, nenahrává web ani neposílá e-maily. Serverové proměnné nastav až po databázové migraci. Původní hesla nejsou přenesena; starší účty si mohou exportovat místní postup a výslovně jej sloučit do nového e-mailového účtu.

## Místní spuštění a kontroly

Je potřeba Node.js 22.12 nebo novější a běžný balíčkovací nástroj.

```sh
npm install
npm run build
npm test
npm start
```

Místní náhled běží na http://127.0.0.1:8785/. Bez proměnných Supabase používá dosavadní účty a soukromý souborový archiv v `.local-data`. Netlify používá pro tento starý režim původní Blobs úložiště. Při testování kontaktního formuláře v místním náhledu se nic neodesílá.

`npm test` zahrnuje skutečné SQL/RLS testy v lokálním PostgreSQL prostředí PGlite, API bezpečnost, slučování dvou souběžných zařízení, klientské účty/souhlasy/importy/formuláře a kontrolu obsahu i výsledného HTML a jeho CSP. Neověřuje doručování ze skutečného SMTP ani živé Netlify/Supabase nastavení.

## Aktualizace zachovávají hráče a výsledky

Netlify zveřejňuje kód a grafiku; účty, body a historie zůstávají ve stejném Supabase projektu. Běžná aktualizace znovu nezakládá databázi ani nepouští úvodní SQL migraci. Neměň produkční projekt, trvalé klíče úložiště ani identifikátory vydaných výroků podle čísla verze aplikace.

`content/published-history.json` eviduje 509 stálých identifikátorů, původní přijímaná znění, 100 vydaných sad a formát uloženého postupu. Sestavení odmítne odstranění nebo přejmenování výroku, použití jeho ID pro jiný výrok, změnu vydaného plánu či reset úložiště. Texty nápověd, zkomoleniny, vysvětlení, vzhled a přijímané varianty lze upravovat se zachováním ID. Při opravě cílového textu ponech staré znění mezi variantami.

Nové hádanky a dny přidávej na konec zásoby. Před zapojením do nových her musí mít položka schválení a aktuální kontrolní otisk v `content/editorial-review.json`; sestavení odmítá chybějící rozhodnutí i změnu textu po kontrole. Poté spusť `npm run content:record` a zahrň rozšířený záznam do stejné aktualizace. Tento příkaz nejprve ověří staré položky a teprve potom připojí nové; nepoužívej jej k přepsání historie. Rozšíření formátu dat vyžaduje samostatně ověřený převod zachovávající staré záznamy.

`npm run build`, který používá Netlify, nyní spouští i všechny regresní testy. Kontrolují zachování vyhraných/odhalených kol, bodů, nákupů, rozepsaných tipů a evidence zobrazených výroků při změně hodnocení i při připojení staršího zařízení. Selhání zastaví nové nasazení; dosud publikovaná hra zůstane dostupná. Již serverem uznané výhry se při pozdější úpravě hodnoticího modulu neruší; nové výhry stále ověřuje server.

## Uspořádání

- `client/` — upravitelné HTML, styly a herní moduly.
- `content/` — archiv 509 identit, redakční schválení a původní pevný plán pro kompatibilitu.
- `scripts/` — sestavení a kontrola shodného hodnocení pro prohlížeč i server.
- `public/` — vygenerovaný web: vzhled, fonty a skripty uvnitř index.html, aby se neztratily při nahrávání.
- `backend/` a `netlify/functions/` — Supabase integrace pro Netlify.
- `supabase/migrations/` — SQL k jednorázovému nastavení nové databáze.
- `legacy-server/` — zachovaný původní přihlašovací server.
- `game.mjs` — automaticky generovaná společná herní logika; upravuj zdroj v client/content, poté sestav.

## Limity a redakce

Zobrazená shodná slova jsou přesnou slovní shodou s jednou přijímanou podobou, nikoli měřením porozumění. Nepotvrzují správné pořadí ani význam. Neobvyklou správnou parafrázi může pravidlový modul odmítnout. Zdroj a atribuce zůstávají po odhalení přístupné. Denní žebříček porovnává různé osobní sady a není standardizovanou zkouškou obtížnosti.

Žebříček ověřuje odpovědi na serveru a odmítá podvržené body. Veřejný statický obsah umožňuje dohledat i řešení; nejde o zabezpečení soutěže o ceny. Cloudový zápis má velikostní omezení 2 MiB a nejvýše 500 tipů na jednu hádanku; místní hraní není omezené počtem tipů. Při nedostupném cloudu místní postup zůstává v prohlížeči a lze jej exportovat.

Provozovatel Lukáš Citnar a kontakt infoseptanda@gmail.com jsou uvedení v informacích o soukromí. Čitelná stránka soukromi.html se sestavuje ze zdroje client/SOUKROMI.md. Data se třetím stranám neprodávají a v této verzi nejsou reklamní ani analytické měřicí skripty. Odesílání novinek není součástí balíčku.

## Osobní sady a zachování postupu

Od 19. 10. 2026 se nové dny vybírají z redakčně schválených ID podle identity hráče, data a historie. Přidělená sada se uloží a nemění při návratu, aktualizaci ani na jiném zařízení. Různí hráči mohou někdy potkat stejný výrok. Stejnému hráči se znovu nepřidělí ani neotevřená položka z jeho dřívější sady. Po vyčerpání zásoby se cyklus neopakuje.

Účet má identitu odvozenou z ověřeného Supabase uživatele. GET player nejprve rezervuje dnešní sadu přes existující databázovou revizi; souběžná zařízení dostanou stejný uložený výběr. Klient načte historii účtu před sloučením svých místních tipů. U již rozehraných dnů zůstává i výrok dočasně vyřazený z nového výběru. Aktualizace nemaže starší body ani nákupy.

Bez účtu existuje trvalá náhodná identita pouze v konkrétním prohlížeči. Po vymazání jeho dat nebo na jiném zařízení nelze hosta poznat. Místní hru lze do účtu přidat výslovným importem. Starý záložní režim bez Supabase ověřuje osobní výsledky, ale nesynchronizuje soukromé rozehrané tipy mezi zařízeními.

Shodné sady se slučují včetně pokusů, nejvyšší odemčené stopy a dokončení. Pokud dvě zařízení skutečně rozehrála odlišné pětice před připojením, serverem rozpracovaná sada zůstane hlavní; před nahrazením klient uloží všechny konfliktní snímky do soukromé místní zálohy dostupné v Můj účet. Místní zálohu je vhodné stáhnout před mazáním dat prohlížeče.

## Tři hádanky a přeskočení (5.2.1)

Nově přidělené osobní sady obsahují tři hádanky. U dříve uložených pětic zůstávají všechna ID, výsledky i rozepsané tipy v archivu, ale od 19. 10. se v aktuální hře nabízejí jen první tři položky. Dřívější práce z dalších dvou je v přehledu účtu pod Dřívější výsledky z dneška. Její body se neodebírají. Dosavadní archivní kalendář je beze změny.

Přeskočení nahradilo bezplatné odhalení aktuálního výroku. Po výslovném herním potvrzení strhne 100 bodů, uzavře hádanku bez odměny a přejde na další slot stejné sady. Nevytváří náhradní čtvrtou hádanku. Poslední přeskok dokončí sadu. Je potřeba mít alespoň 100 bodů; původní nákupy stop se nevracejí. Řešení zůstane v přehledu.

Účet provádí přeskok až po uložení rozpracovaného postupu a potvrzení serverem. CAS a serverový výpočet chrání proti dvojímu stržení a souběžnému utracení téhož zůstatku. Záznam je status `revealed` s příznakem `paidSkip:true`; cena se započte do výdajů i denního pořadí. Staré odhalené výsledky se nikdy zpětně nezpoplatňují. Bez účtu se přeskok ukládá v prohlížeči.

## Oprava zobrazení starých pětic (5.2.2)

`day.playLimit` je odvozené omezení na tři pro dny od 19. 10. 2026. `daily.playIds` určuje aktuální nabídku, odemykání i zobrazený postup. Původní `day.ids` a celý `progress` zůstávají v JSON nezkrácené; souhrnný účet a serverový bodový archiv nadále započítávají všechny již uložené výsledky. Také dnes už zobrazení nabídne tři, i když byla dříve vydána pětice. Dřívější dny před 19. 10. zůstávají plné archivní pětice.

## Postupné odkrývání předání (5.3.0)

Vedle balíčku redakčních stop je samostatná volba „Po stopách věty“. Každý klik za 50 bodů odhalí jedno dřívější předání v pořadí 4, 3, 2, 1. Poslední, páté předání je vidět od začátku. Originál není součástí nákupu a ukáže se až po rozluštění či přeskočení. Zakoupené kroky se ukládají do `chainLevel` (0–4), slučují podle nejvyšší dosažené úrovně a promítají do denního pořadí i celkového zůstatku.

Nová přeskočení stojí 100 bodů a mají `skipCharge:100`. Historická zaplacená přeskočení bez částky nadále znamenají původních 200 bodů; server je při dalším zápisu označí `skipCharge:200`. Nákupy ani výkony se zpětně nepřepočítávají. Neprovádí se žádný reset, změna identit výroků ani SQL migrace.

## Přechod na autory (6.0.0)

`content/authors.json` je samostatné redakční rozhodnutí s identitami osobností, schválenými variantami jmen, typem atribuce, stopami, zdroji a otiskem obsahu. Builder odmítne změnu bez nové kontroly. V původním katalogu se nepřepisuje žádné ID ani originální znění.

Nově přidělené osobní dny od 20. 10. 2026 mají `mode:"author-v1"`. Od verze 6.1.0 se dnešní existující den bez této značky přesune do archivu a nahradí osobní autorskou trojicí. Minulé dny zůstávají ve svém původním režimu. Původní pokusy se nikdy nepřehodnocují jako jména a původní výhry, nákupy a přeskočení se nikdy znovu neoceňují. Nepoužívá se nový účet, klíč úložiště ani reset. Nový režim vylučuje i všechna dříve přidělená ID starého režimu.

Po otevření třetí stopy jsou čtyři odpovědi; nejsou součástí výchozí otázky. Literární otázka hledá autora díla, s výslovnou výjimkou otázky na Sókrata v Platónově podání. Tradiční připsání Caesarovi, Konfuciovi a Lao-c’ je přiznané. U anonymních rčení přijímáme lidový původ, nikoli „nevím“.

Ověření nového režimu: `scripts/author-tests.mjs` a `client/author-game-tests.mjs` doplňují původních 10 sad testů o uznávání jmen, nejednoznačnosti, anonymní původ, čtyři možnosti, výběr bez opakování, souběžné ukládání a zachování původní i offline historie. SQL migrace není potřeba.

Pokyn pro anonymní původ výslovně nabízí „autor neznámý“, „lidové rčení“ a „pořekadlo“. Všechny tři odpovědi přijímá prohlížeč i server u anonymních rčení; konkrétním autorům se tím autorství nemění.

## Vodítka z autorských tipů (6.2.0)
Rozpoznané jméno se porovnává podle čtyř redakčních znaků: oboru, zaměření, kulturního prostředí a období tvorby nebo tradice. Počet shod je transparentní, nikoli procento sémantické správnosti. Další rozpoznaný odlišný tip dostane srovnání s předchozím; shodný počet není uměle rozlišován. Anonymní původ, nerozpoznané a nejednoznačné jméno nemají falešnou vzdálenost. U jedné otázky lze samostatně schválit doložené pozdější použití v relatedUses; nejde o globální alias autora. Bulánci jsou uznáni pouze u Co se vleče, neuteče, s vysvětlením odlišného oficiálního sloganu Kdo se vleče, neuteče a odkazem na oficiální web. ID, původní texty a staré výsledky se nemění.
