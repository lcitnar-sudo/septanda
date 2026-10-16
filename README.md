# Šeptanda 5.0.9 — účty a žebříček

Úvod zní „Tichá pošta. Poznáš, co bylo na začátku?“ Prázdná historie se nezobrazuje. V pravém sloupci je dnešní žebříček, pořadí všech hráčů a přihlášení účtem s přezdívkou a heslem. Nejsou tu předvyplnění falešní soupeři.

## Co funguje

- Založení účtu, přihlášení, odhlášení a přihlášení stejným účtem na jiném zařízení. Přezdívka je veřejná a jedinečná bez ohledu na velikost písmen. Heslo má 10 až 128 znaků.
- Po přihlášení se zapíší dnešní výsledky z tohoto prohlížeče a při dalších změnách se průběžně aktualizují. Pořadí se řadí od nejvíce bodů; shodné body znamenají sdílené místo.
- Body v žebříčku jsou **dnešní přírůstek**: +200 za rozluštění a −50 za nápovědu. Počátečních 100 bodů ani starší zásoba bodů se do denního pořadí nepočítá. Nejvýše pět výroků za český kalendářní den. Datum určuje server.
- Server sám znovu vyhodnotí vítězné znění. Nepřebírá klientem navržený počet bodů. Opakované odeslání nepřidá další odměnu, dříve zaznamenanou nápovědu nelze odstranit a odhalený výrok nelze dodatečně proměnit ve výhru. Souběžné zápisy používají podmíněné zápisy podle ETag.
- Hesla jsou uložená pouze jako scrypt otisk s náhodnou solí. Přihlášení používá náhodnou session v HttpOnly cookie; na HTTPS je cookie Secure. Server ukládá jen otisk session tokenu. Platnost je 30 dnů. Přihlášení je omezené počtem pokusů.
- Veřejné API vrací pouze přezdívku, identifikátor, dnešní skóre, pořadí a počty dokončených/rozluštěných výroků. Vítězné odpovědi se používají k ověření a neukládají se. Neúspěšné tipy a rozepsané odpovědi se neodesílají.
- Pětice se mění o půlnoci v Europe/Prague. Původní body a historie se zachovají v místní hře. Edukace s portréty, původními zdroji a atribucí zůstává.

## Otevření místně

Vyžaduje Node.js 22 nebo novější. Ve složce projektu spusť:

```
npm install
npm start
```

Otevři http://127.0.0.1:8785/. Místní účty a skóre se ukládají do neveřejné složky `.local-data`, která není součástí dodaného ZIPu. V náhledu je uvedeno „Lokální pořadí pro zkoušení“. Tyto účty se neposílají na Netlify a po publikování tam nebude místní testovací pořadí.

Volitelné argumenty serveru: `node server.mjs public 8785 .local-data`. Statické soubory se servírují výhradně z `public`; databáze ani serverový kód nejsou veřejné. Kontroly spustí `npm test` a používají oddělená dočasná data.

## Zapojení do stávajícího Netlify projektu

**Tento balíček obsahuje serverovou část. Samotné nahrání statické složky `public` účty a společné skóre neaktivuje.** Níže je popsané nasazení celého projektu přes propojený Git repozitář nebo Netlify CLI. Netlify nově u přihlášených uživatelů uvádí také sestavení zdrojového projektu přes Drop; tento konkrétní postup pro zdejší serverový balíček nebyl online ověřen. Pokud projekt nemá nasazenou funkci, přihlášení a žebříček oznámí nedostupnost a místní hra dál funguje. [Oficiální možnosti ručního nahrání](https://docs.netlify.com/deploy/create-deploys/#drag-and-drop).

1. Použij existující projekt pro fascinating-babsousa-5b2ee7.netlify.app (nebo svůj aktuální zvolený projekt), aby zůstala adresa.
2. Ulož celý obsah tohoto balíčku do zdrojového repozitáře projektu. Netlify přečte `netlify.toml`: publikovaná složka `public`, funkce `netlify/functions`, Node 22. Závislosti jsou uvedené v `package.json` a uzamčené v `pnpm-lock.yaml`.
3. Při nasazení přes CLI se v kořenové složce přihlas ke svému Netlify účtu a pomocí `netlify link` vyber **stávající** projekt. Po instalaci závislostí spusť `netlify deploy --dir=public --functions=netlify/functions` pro kontrolní nasazení. Produkční nasazení se provede až výslovně pomocí `netlify deploy --prod --dir=public --functions=netlify/functions`.
4. Netlify Function používá Netlify Blobs. Přístupové údaje pro Blobs dodá Netlify do funkce automaticky. Do HTML ani prohlížeče se žádný administrační token nevkládá. Data se ukládají do site-wide úložiště `septanda-players-v1` v regionu eu-central-1 a přežijí běžné aktualizace webu.
5. Pro testovací/preview nasazení nastav ve funkcích jinou hodnotu proměnné `SEPTANDA_STORE`, například `septanda-players-test`, aby se testovací účty nedostaly do produkčního pořadí. Nezapínej produkční úložiště u nedůvěryhodných preview větví.
6. Ověř založení vlastního účtu a přihlášení ve dvou prohlížečích. Verze v patičce má být 5.0.9. Místní nasazení ani testy nepotvrzují stav online webu.

Oficiální podklady: [nasazení Netlify Functions](https://docs.netlify.com/build/functions/get-started/), [Netlify Blobs a podmíněné zápisy](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), [Netlify CLI deploy](https://cli.netlify.com/commands/deploy/).

Nic nebylo automaticky publikováno. Před nasazením ověř limity a účtování svého Netlify projektu.

## Rozsah a limity této verze

Toto je funkční prototyp pro menší hru. Účet sdílí umístění a ověřené skóre, **nesynchronizuje kompletní místní herní stav, peněženku, rozepsané tipy ani historii mezi zařízeními**. V jednom prohlížeči jsou rozehrané hry účtů oddělené. První přihlášený účet si může převzít dosavadní místní postup; další nový účet začíná vlastní hru. Po odhlášení se znovu otevře původní hra hosta. Server zajišťuje nejvýše jednu bodovou odměnu za daný výrok na účet a den.

Obnova zapomenutého hesla, ověření e-mailu, přihlášení přes Google, správa účtů a moderace přezdívek zatím zapojené nejsou. Registrace nepoužívá e-mail. Veřejně nevkládej do přezdívky osobní údaje. Přihlášení nevylučuje více účtů jednoho člověka. Otázky i odpovědi jsou obsažené ve statickém HTML, proto nejde o systém chránící soutěž proti cílenému podvádění. Pro placenou soutěž by bylo nutné přesunout obsah a celý průběh hry na server, doplnit ochranu proti zneužití, správu účtů a obnovu hesel.

Úložiště se čte v dávkách a veřejně vrací prvních 100 hráčů plus přihlášeného hráče, pokud je níže. Pro velký počet hráčů je vhodná databáze s indexovaným pořadím. Staré session ztrácejí platnost podle uloženého času; tento prototyp je automaticky fyzicky nepročišťuje.

Vyhodnocování je stejné místní pravidlové skórování jako dříve: slovní shoda 60 %, významový odhad 40 %, úspěch od 97 %. Nejde o AI; neobvyklé parafráze, negace a ironii může posoudit nepřesně. Statická sbírka má devět položek, takže se výroky mezi dny opakují. Všechny obrázky jsou přímo v HTML; prameny uvádí `public/ZDROJE.md` a hra.

Při úpravě herního obsahu nebo hodnocení je potřeba udržet shodný katalog a pravidla v `public/index.html` a `game.mjs`. Při změně vloženého JavaScriptu přepočítej CSP otisky v `public/_headers`.

## Tolerantnější vyhodnocování v 5.0.7

Odstraněný podtitulek pod hlavním nadpisem se již nezobrazuje. Hra nově hledá původní úryvek uvnitř odpovědi, takže pokračování básně navíc nesnižuje jeho rozpoznání. Toleruje drobné překlepy včetně přehozených sousedních písmen, vynechané spojky „a“/„i“ a omezené odchylky v delším znění. Drobně pozměněné rozpoznané znění získá 97 % (slovní složka 95 %, význam 100 %); přesná známá varianta i jako část delšího textu získá 100 %. Jde o práh rozpoznání pravidlovou kontrolou, nikoli o statistickou pravděpodobnost.

Příklad „zemřela matak do hrobu dána, siroty po ní zůstaly“ projde za 97 %. Projde i správně poznaný úryvek s dalšími verši. Samotná první polovina úryvku, obecná parafráze, zpřeházená slova nebo změna záporu dál k výhře nestačí. Nejde o volné jazykové porozumění; některé správné alternativní formulace zůstávají mimo připravená pravidla.

Stejná pravidla používá prohlížeč i ověřování bodů na serveru. Při aktualizaci se starší tipy znovu vyhodnotí a všechny zůstanou v historii. Pokud dřívější tip u rozehrané hádanky nyní projde, hra ji uzná a připíše jednu odměnu; při dalším obnovení se nepřičte znovu. Dříve dobrovolně odhalené hádanky zůstávají bez odměny. V přehledu rozluštěné hádanky je zvýrazněný uznaný tip.

## Industriálnější typografie v 5.0.8

Nadpisy a značka používají Barlow Condensed, delší texty, výroky a ovládání Barlow. Technická čísla využívají systémové neproporcionální písmo. Kurzíva v hlavním nadpisu byla odstraněna. Rozložení a zelená paleta zůstaly zachované; herní vyhodnocování se nezměnilo.

WOFF2 písma včetně českých znaků jsou přímo v `index.html`; pro hraní nejsou potřeba externí fontové služby. Licence a autorství jsou v přehledu zdrojů ve hře i v souboru `FONTY-LICENCE.txt` (u kompletního projektu ve složce `public`). Tento soubor je nově součástí ZIPu.

## Industriál a archiv v 5.0.9

Vzhled spojuje kartotéční list s industriální typografií: teplý papírový podklad s jemnou sítí, tmavý tisk, ostré rámečky a střídmé rezavě červené akcenty. Dnešní datum v razítku vychází ze stejného českého dne jako herní sada. Záložka na herní kartě otevírá skutečný seznam dnešních výroků. Čísla postupu mají podobu rejstříkových polí, vstup pro tip připomíná linkovaný formulář a boční přehled i dialogy používají stejné linky a sazbu.

Odhalení autora má podobu evidenční karty s černobílým zobrazením existujícího portrétu. Původní zdroje a licence zůstávají dostupné. Na telefonu se vedlejší panely skládají pod hru; razítko se schová, aby zůstala priorita zprávě a tipu. Všechny nové detaily tvoří přímo HTML/CSS, bez stahování obrázků zvenku.

Jde o změnu vzhledu. Herní pravidla, tolerance tipů, body, nápovědy, účty, dnešní pořadí a místní historie se nemění. Uložený postup zůstává zachovaný. Pro tento vzhled nahraj opět celý aktuální balíček včetně `_headers`; změnilo se i vložené zobrazení data, proto jsou aktualizované otisky skriptů.
