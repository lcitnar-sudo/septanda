# Šeptanda 5.1.1 — archiv slov

Funkční web pro stávající Netlify projekt, dobrovolné e-mailové účty Supabase a 100 připravených denních sad.

## Co obsahuje

- Hra bez povinné registrace, pět navazujících hádanek denně podle pražského času.
- Jedna nápověda za 50 bodů, odměna 200 bodů, úspěch od 97 %, všechny místní tipy v historii.
- Pravidlové hodnocení: slovní shoda 60 %, odhad významu 40 %. Ve hře neběží AI.
- Supabase registrace, potvrzování e-mailu, přihlášení, obnova hesla, synchronizace, profil a samostatný souhlas s novinkami.
- Soukromá správa hráčů a audit souhlasů; veřejný žebříček neukazuje e-maily ani odpovědi.
- Kontaktní formulář přes Netlify Forms se spamovou pastí a stavem odesílání.
- 500 nových hádanek v sadách od 17. 10. 2026 do 24. 1. 2027. Po tomto období se cyklus opakuje. Devět původních hádanek zůstává pro starší historii.
- Průvodce Šeptík má šest vlastních průhledných ilustrací podle dodané reference: základ, přemýšlení, radost, překvapení, další pokus a objevování dokumentu. Reaguje na hru a psaní tipů.

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

## Uspořádání

- `client/` — upravitelné HTML, styly a herní moduly.
- `content/` — původní obsah, 500 nových záznamů a pevný plán sad.
- `scripts/` — sestavení a kontrola shodného hodnocení pro prohlížeč i server.
- `public/` — vygenerovaný web: vzhled, fonty a skripty uvnitř index.html, aby se neztratily při nahrávání.
- `backend/` a `netlify/functions/` — Supabase integrace pro Netlify.
- `supabase/migrations/` — SQL k jednorázovému nastavení nové databáze.
- `legacy-server/` — zachovaný původní přihlašovací server.
- `game.mjs` — automaticky generovaná společná herní logika; upravuj zdroj v client/content, poté sestav.

## Limity a redakce

Místní procenta nejsou měřením skutečného porozumění. Neobvyklou správnou parafrázi může hra podhodnotit, ironii či některé zápory nepoznat. U vlastních převyprávění antických pramenů jsou přijímané varianty součástí záznamu. Zdroj a atribuce zůstávají po odhalení přístupné.

Žebříček ověřuje odpovědi na serveru a odmítá podvržené body. Veřejný statický obsah umožňuje dohledat i řešení; nejde o zabezpečení soutěže o ceny. Cloudový zápis má velikostní omezení 2 MiB a nejvýše 500 tipů na jednu hádanku; místní hraní není omezené počtem tipů. Při nedostupném cloudu místní postup zůstává v prohlížeči a lze jej exportovat.

Provozovatel Lukáš Citnar a kontakt infoseptanda@gmail.com jsou uvedení v informacích o soukromí. Čitelná stránka soukromi.html se sestavuje ze zdroje client/SOUKROMI.md. Data se třetím stranám neprodávají a v této verzi nejsou reklamní ani analytické měřicí skripty. Odesílání novinek není součástí balíčku.
