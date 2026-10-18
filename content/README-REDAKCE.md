# Šeptanda: 100 denních sad / 500 nových hádanek

Připraveno pro současnou hru. Katalog je oddělený od původních devíti hádanek, aby jejich identifikátory a uložená historie mohly dál fungovat.

- **Období:** 17.10.2026–24.1.2027, 100 po sobě jdoucích dnů v časovém pásmu Europe/Prague.
- **Denní složení:** dvě lidová přísloví, jeden historický výrok, jeden úryvek poezie a jeden úryvek prózy. Pořadí kategorií se střídá.
- **Obsah:** 200 přísloví, 100 historických výroků, 100 básnických a 100 prozaických úryvků. Žádný cílový text se v této stovce dnů neopakuje; přesné znění původních devíti hádanek není znovu zařazeno.
- **Po skončení:** plán výslovně předepisuje opakování této stovky dnů. Není to neomezený přísun nového obsahu. Další sezonu lze vyměnit redakčním vydáním.
- **Před začátkem:** aplikace má zachovat výběr původních devíti hádanek a původní způsob výpočtu jejich denních sad. Obsahový balík sám nemění dřívější uživatelskou historii.

## Soubory pro zapojení

`new-puzzles.json` obsahuje 500 položek v dosavadním schématu aplikace (`id`, `category`, `answer`, `variants`, `concepts`, `paraphrases`, `contradictions`, `hint`, `chain`, `author`, `origin`, `context`, `meaning`, `attribution`, `sources`, `education`). Identifikátory jsou stabilní a používají ASCII. Řetězec má vždy pět předání; hráči se zobrazuje poslední.

`schedule.json` obsahuje `startDate`, `endDate`, `timeZone` a `days`, v nichž je přesné datum a pět ID. Jediný autor poezie a prózy se ve stejném dni neopakuje. Stejný katalog a plán musí používat klient i server při ověřování bodů.

`redakcni-prehled-500.csv` je tabulka s datem, pořadím, originálem, autorem, dílem, významem, nápovědou, všemi pěti předáními, pramenem, atribucí a přijímanými variantami. Soubor je UTF-8 s BOM pro pohodlné otevření v tabulkových editorech. `denni-plan-100.csv` je menší rozpis samotných ID.

`build-catalog.py` opakovatelně sestaví katalog a plán z redakčních podkladů. Nepřepisujte ručně vygenerovaný JSON a současně jeho podklady; příští sestavení by takovou změnu přepsalo. Při opravě již publikovaného znění zachovejte ID ručně, aby se neodpojila historie. Nové ID je vhodné až pro novou hádanku.

## Obtížnost a férovost

Poslední předání nepoužívá pouhou výměnu několika slov. Přenáší děj do jiného prostředí, obrazu nebo role a mění větnou stavbu, ale zachovává vztah mezi jednajícími, důsledek nebo ústřední kontrast. V první stovce přísloví a v 56 prozaických položkách proběhla dodatečná úprava, která odstraňuje snadné přímé nápovědy a opakované kancelářské formulace.

Nápověda stojí na obecném myšlenkovém směru; nevyzrazuje přímo autora ani úplný obrat. Více podob původního znění se přijímá samostatně. U všech 100 historických položek jsou připraveny alternativní české formulace; u některých i klasické latinské znění. U přísloví se připouštějí běžné pravopisné a ustálené dnešní varianty, například „Pečení holubi nelétají do huby“ vedle staršího zapsaného znění.

Pětistovka zahrnuje také méně známé části knih a básní. Nejde o tvrzení, že každý úryvek patří k všeobecně známým citátům. Před ostrým soutěžním hodnocením doporučujeme hráčský pilot: neznámý text může být těžký kvůli kulturní znalosti, i když je obraz přiměřený. Nízká slovní shoda není sama o sobě měřítkem dobré hádanky.

Lokální vyhodnocení je pravidlové. Přijímané formulace testuje přesně a toleruje několik drobných odchylek, význam však jen odhaduje pomocí kořenů slov a vybraných parafrází. Neumí spolehlivě pochopit libovolnou novou metaforu, děj ani překlad. Obsahový balík tuto hranici neskrývá a nepředstírá AI posouzení. Budoucí úpravy nápověd a variant jsou možné bez přepsání dosavadních pokusů.

## Prameny a autorství

Každá položka nese přímý odkaz na svůj pramen, autora nebo poctivě označenou anonymní tradici, původ a poznámku k atribuci. V katalogu je 144 různých odkazovaných pramenů.

**Přísloví:** anonymní lidová tradice. Karel Hrubý, František Bartoš a František Ladislav Čelakovský jsou označováni jako sběratelé či sestavovatelé, nikoli jako původní autoři. Znění je kontrolováno v těchto veřejně volných dobových pramenech:

- [Karel Hrubý: Sbírka přísloví, pořekadel a průpovědí (1880), Přísloví hospodářská vůbec, s.17–39](https://cs.wikisource.org/wiki/Sb%C3%ADrka_p%C5%99%C3%ADslov%C3%AD,_po%C5%99ekadel_a_pr%C5%AFpov%C4%9Bd%C3%AD,_kter%C3%BDch_u%C5%BE%C3%ADv%C3%A1_n%C3%A1%C5%A1_lid_rolnick%C3%BD/P%C5%99%C3%ADslov%C3%AD_hospod%C3%A1%C5%99sk%C3%A1_v%C5%AFbec).
- [František Bartoš: Česká čítanka pro druhou třídu škol středních (1883)](https://cs.wikisource.org/wiki/%C4%8Cesk%C3%A1_%C4%8D%C3%ADtanka_pro_druhou_t%C5%99%C3%ADdu_%C5%A1kol_st%C5%99edn%C3%ADch), oddíly s příslovími o opatrnosti, domově, právu a svědomí, zdraví a českými pořekadly.

Dobové přísloví o zdraví není odborné doporučení. Výklad tyto texty zasazuje do lidové tradice a nepřevádí jejich obrazné sliby na záruku zdraví či délky života.

**Poezie:** původní české texty Karla Jaromíra Erbena, Jana Nerudy, Jiřího Wolkera, Vítězslava Hálka, Františka Ladislava Čelakovského a Jaroslava Vrchlického. Použity jsou krátké úryvky veřejně volných děl; každý odkazuje na konkrétní báseň. Zalomení a interpunkce se ve hře nevyžadují.

**Próza:** Božena Němcová, Jan Amos Komenský, Jan Neruda, Karel Poláček, Karel Čapek, Alois Jirásek a Jaroslav Hašek. Přehled titulů, použitých přepisů a výběru je v `prose-sources.md`. Jiráskovy postavy a jejich promluvy jsou literární podání; nejsou vydávány za ověřený stenografický záznam slov praotce Čecha, Libuše nebo dalších postav pověstí.

**Historické výroky:** antické a raně novověké texty a několik veřejně volných filozofických děl 19.století. České cílové texty jsou naše krátké překlady či převyprávění z pojmenovaného pramene. Nejde o citace z moderního chráněného českého překladu ani o tvrzení o jediné kanonické české podobě. U Konfucia a Epiktéta je přiznáno zprostředkování žáky, u Sókrata Platónovým literárním podáním a u Lao-c’ tradiční, historicky nejisté autorství. Úplné detaily má každá položka.

Nově napsané herní řetězce, nápovědy a výklady jsou redakční adaptace Šeptandy. Databáze nepřenáší volnou licenci webové navigace na podkladové moderní překlady; vybírá původní texty a historické překlady, jejichž autoři jsou více než 70 let po smrti.

## Kontroly

Spusťte `python3 work/content-100days/validate-content.py` z kořene projektu a `node work/content-100days/test-content.cjs` pro kontrolu proti aktuálnímu místnímu hodnoticímu modulu.

Výstupy `validation-report.json` a `scoring-report.json` zachycují:

- 500 různých nových cílových textů a 500 unikátních ID v přesně 100 pětičlenných sadách.
- 400 shod citovaného českého znění s jeho konkrétním uloženým pramenem:200 přísloví,100 básnických a 100 prozaických úryvků. Při kontrole se ignoruje typografie, mezery, interpunkce a HTML entity.
- U všech 100 historických položek uvedený pramen a alternativní překladové formulace. Mechanická kontrola proti kanonickému českému překladu se na ně nevztahuje, protože jde o vlastní převody.
- 769 cílových nebo přijímaných formulací uznaných stávajícím místním vyhodnocováním na 100%.
- Žádné z 500 posledních předání samo o sobě nevyřeší hádanku. Nejvyšší zjištěné výsledné skóre po opsání zobrazené zkomoleniny je 62%.

Tyto kontroly neověřují lidskou obtížnost ani dokonalou interpretaci každého tipovaného znění. Živý server i sestavený klient je potřeba následně otestovat se stejným katalogem a plánem; samotná přítomnost těchto souborů aplikaci ještě nepřepíná.

## Rozšíření časových období ve verzi 5.1.1

Dvacet budoucích historických položek nahrazuje opakující se autory doplněním Boëthia, Danta, Husa, Petrarky, renesančních autorů, vědecké revoluce, osvícenství a 19.–20. století. Zahrnuta jsou témata víry, svobody, poznání, lásky, nerovnosti, vědy a demokracie. Nejde o úplné pokrytí všech období a kultur; nejmladší doplněný pramen je z roku 1935. Poezie a próza zůstávají převážně české 19.–počátku 20. století. Rok vydání sbírky přísloví neoznačuje vznik lidového výroku. Změny zachycuje coverage-replacements.json.

Zdroj pravdy pro sestavení aplikace je new-puzzles.json a schedule.json. Historické pracovní generátory z redakčního balíku se na nové nahrazené položky nepouštějí bez zapojení coverage-replacements.json.
