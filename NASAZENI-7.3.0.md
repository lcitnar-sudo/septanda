# Šeptanda 7.3.0 — literární hra na hlavní adrese

- `/` je literární hra s jedním osobním úryvkem denně, portréty a knihovničkou.
- `/literatura`, `/literatura/` a `/literatura.html` se trvale přesměrují na `/`. Stejný původ, klíče úložiště, soukromé úložiště a obsah; žádný import či reset při přesunu.
- `/puvodni` obsahuje původní hru včetně účtů, administrace a historie. Body obou her zůstávají oddělené.
- `/ukazka`, `/vyzva`, `/procvicit` jsou nadále izolované režimy původní hry. Návraty míří do `/puvodni`.
- Obnova hesla funguje přímo na nové hlavní stránce, včetně dříve odeslaných odkazů s `account=recovery` a události Supabase PASSWORD_RECOVERY. Registrace nadále míří na kořen webu.
- Kontaktní formulář používá stejný název `septanda-contact` a stejné vstupní názvy jako dosavadní formulář. Automatický test ani browser QA neposílají provozní e-maily.
- Titulky a sdílení popisují literární hru. Kořen webu má kanonickou adresu a indexaci. Původní hra má noindex; sitemap obsahuje hlavní stránku a informace o soukromí.
- Zásoba má stále deset ověřených knižních ukázek. Denní příděl necyklí po vyčerpání. Volný prohlížeč celé banky není v hlavním menu; knihovnička zpřístupňuje již objevené knihy.

Kontroly: 21 sad testů včetně zachování historie, oddělení účtů, zdrojů portrétů, hlavní stránky, starší adresy a obnovy hesla v syntetickém transportu. Dále browser QA hosta, kontaktů a archivu; produkční kontrola přesměrování, CSP a obnovení skutečné relace bez herních zásahů.
