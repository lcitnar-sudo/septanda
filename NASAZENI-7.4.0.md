# Šeptanda 7.4.0 — Kniha ve třech znacích

Denní emoji bonus je přímo na hlavní stránce, v přepínači vedle Denního úryvku. Přímý odkaz pro testery: https://septanda.com/#emoji.

- Deset ručně připravených trojic s ověřeným autorstvím a prameny. Hledá se název knihy; přijímají se uvedené varianty názvů, diakritika, interpunkce i drobný překlep.
- Jedna osobní hádanka denně, stabilní přidělení, bez opakování po vyčerpání. Datum přihlášené hry určuje server v Europe/Prague.
- Dvě bezplatné stopy (kontext a autor), nejnovější nahoře. Bezplatné odhalení. Bonus má vlastní výsledky a nemění literární ani původní body.
- Po odhalení název, autor, redakční představení knihy, vysvětlení symbolů a odkaz na původní text nebo oficiální zdroj.
- Hlášení sporné trojice předvyplní existující kontaktní formulář, odešle ho až hráč. Sdílení kopíruje veřejný odkaz bez odpovědi.
- Společné přihlášení Supabase, samostatné soukromé úložiště Netlify Blobs septanda-emoji-v1. Endpoint emoji-player ověřuje vlastníka i odpovědi. Literární a původní herní záznamy nemění.
- Nový místní klíč septanda.emoji.v1. Samostatné účty a jejich cache, obnova rozepsaných tipů při chybě spojení, import hosta pouze výslovnou volbou s novým ověřením odpovědí.
- Doplněná pravidla a informace o soukromí. Žádné nové služby, přístupy, placené prostředky ani e-maily.

Kontroly: 24 sad testů včetně denního přidělení, neopakování, souběžných stop, oddělení vlastníků, bezpečného importu, sdílené relace a chyby spojení. Browser QA hosta: alternativní název Moby-Dick, obnovení výsledku, dvě stopy v pořadí 2→1, odhalení, přepínač a mobilní šířka 390 px. Skutečné čtení ani skóre hráčů se při testování nemění.
