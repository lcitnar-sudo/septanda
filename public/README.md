# Šeptanda 5.0 — denní vydání 5.0.9

Úvod: „Tichá pošta. Poznáš, co bylo na začátku?“ Prázdná historie už není vidět. Vpravo je dnešní žebříček a přihlášení hráčským účtem s přezdívkou a heslem.

**Tento ZIP pro Netlify Drop obsahuje statickou část. Účty a společné skóre vyžadují také serverovou funkci.** Kompletní projekt je v samostatném balíčku `septanda-5.0-ucty-a-zebricek.zip`, včetně návodu a kontrol. Samotné přetažení HTML do Netlify serverovou část neaktivuje. Pokud ji projekt nemá, pořadí oznámí nedostupnost a místní hra pokračuje.

Žebříček počítá dnešní přírůstek bodů (+200 za rozluštění, −50 za nápovědu), nikoliv starší zásobu na nápovědy. Přihlášené účty mají v jednom prohlížeči oddělené rozehrané hry. První účet převezme dosavadní postup. Body v žebříčku jsou sdílené přes server; kompletní místní historii, peněženku a rozepsané tipy účet mezi zařízeními nesynchronizuje. Pro veřejné nasazení zatím není zapojená obnova zapomenutého hesla.

## Pět výroků na den

- Každý pražský kalendářní den je připravena jedna sada **pěti různých výroků**. Datum se vyhodnocuje v časovém pásmu Europe/Prague, včetně letního času.
- Všichni hráči mají pro stejné datum stejný výběr. Sada se nyní vybírá z devíti připravených položek; mezi různými dny se tedy výroky opakují. Obsah se negeneruje AI.
- Výroky se odemykají postupně. Další otevře rozluštění nebo dobrovolné odhalení předchozího. Již dokončené lze znovu číst. Čísla 1–5 ukazují aktuální postup, zelená znamená rozluštění, tlumená odhalení bez odměny.
- Po dokončení pětice už tentýž den není další kolo. Nová sada přijde o půlnoci podle českého času; otevřená stránka to kontroluje každých 30 sekund a při návratu do okna. Body se přenášejí.
- Začínáš se 100 body, za rozluštění dostaneš jednou **+200 bodů za dané denní kolo**. Jedna jemná nápověda stojí **50 bodů** a kupuje se jednou za kolo. Odhalení nepřidává odměnu.
- Všechny tipy zůstávají v historii. Starší dny a tipy z předchozí verze najdeš přes tlačítko s body v části **Starší hry a tipy**.

**Limit je lokální pro prohlížeč a adresu webu.** Bez účtu a serveru nelze spolehlivě omezit jednoho člověka napříč zařízeními, jinými prohlížeči, anonymními okny nebo vymazáním dat. Datum vychází z hodin zařízení. Pro závazný limit na hráče by bylo potřeba přihlášení a ukládání na server. Ve hře není tlačítko pro reset dnešní sady.

## Přechod ze starší verze

Při aktualizaci na stejné adrese se původní postup z klíče `septanda.v5.progress` jednorázově převede do archivu a zachovají se body, tipy, rozepsané odpovědi i skutečně zaplacené starší nápovědy za 30/60 bodů. Původní záznam se nemaže. Denní režim začíná vlastní dnešní pěticí. Hra hosta se ukládá pod `septanda.v6.daily`, přihlášené účty mají vlastní klíče s příponou `.account.<id>`. Nový stav se ukládá v podobě denních sad a při dalším načtení se odměny nepřičítají znovu.

Na jiné doméně nebo portu má prohlížeč vlastní úložiště. Lokální náhled a nasazený web nesdílejí body. Když prohlížeč ukládání zakáže, stránka to oznámí; postup pak není trvalý a limit přes obnovení stránky nelze zachovat.

## Edukace a vyhodnocování

Po rozluštění nebo odhalení se zobrazí původní znění, krátký odstavec o autorovi, díle nebo původu a dohledatelný portrét, pokud existuje. **Původní zdroj** je viditelný přímo u textu; podrobná atribuce a licence obrázku jsou rozbalovací. Anonymním příslovím se autor ani portrét nevymýšlí. Formát podporuje historické citáty, přísloví, úryvky básní i knih; nynější obsah zahrnuje citáty, přísloví a veřejně volné verše.

Hodnocení běží pouze v prohlížeči, **nejde o AI**. Slovní shoda tvoří 60 % a pravidlový významový odhad 40 %. Hra pracuje s připravenými variantami, motivy, synonymy a několika rozpory. Neobvyklé parafráze, skloňování, negace a ironii může posoudit nepřesně. Procenta nejsou pravděpodobností správnosti. Známá znění získávají 100 %, poznané znění s drobnými překlepy, vynechanou spojkou či ojedinělou odchylkou získává 97 %; správný úryvek může být i součástí delší odpovědi; obecná parafráze výhru nezaručí. Bez přihlášení se tipy nikam neposílají. Po přihlášení se vítězné znění odesílá k ověření skóre pro žebříček; neúspěšné a rozepsané tipy zůstávají v prohlížeči. Hra neobsahuje emoji, analytiku ani vzdálené fonty či obrázky.

## Aktualizace existujícího Netlify projektu

1. Rozbal ZIP.
2. V Netlify otevři **existující projekt**, jehož adresu chceš zachovat, a sekci **Deploys**.
3. Do oblasti pro ruční nahrání přetáhni rozbalenou složku. Přímo v ní musí ležet `index.html` a `_headers`.
4. Po publikování obnov web. Patička ukazuje **5.0.9**. Pokud vidíš starou verzi, v Safari použij Option + Command + R.

Pro původní web vyber projekt s adresou [fascinating-babsousa-5b2ee7.netlify.app](https://fascinating-babsousa-5b2ee7.netlify.app). Obecná stránka Netlify Drop může založit nový projekt s jinou adresou, proto pro aktualizaci použij Deploys konkrétního projektu. Na pozdějším snímku byla adresa dazzling-kleicha-efa517.netlify.app; zvol projekt, který chceš skutečně aktualizovat. Automaticky se nic nenasazuje.

Oficiální postup: [Netlify — ruční nahrání a aktualizace](https://docs.netlify.com/manage/projects/add-new-project/#use-drag-and-drop-to-publish).

## Obsah balíčku

- **index.html**: celá hra, vzhled, pravidla, obrázky i prameny v jednom souboru. Lze otevřít i přímo z počítače; pro spolehlivé ukládání doporučujeme náhled přes HTTP nebo Netlify.
- **_headers**: nastavení pro Netlify včetně otisků vloženého kódu. Nahrávej současně s index.html.
- **ZDROJE.md**: prameny a atribuce.
- **README.md**: tento návod.

Při každé aktualizaci nahraj celý balíček. Ruční změna vloženého JavaScriptu vyžaduje přegenerování jeho otisků v `_headers`.

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
