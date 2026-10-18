# Šeptík — podklad pro ilustrace a další využití

Šeptík navazuje na referenční list dodaný uživatelem16.10.2026. Vytvořených je šest samostatných průhledných ilustrací se shodnou tváří a oblečením. Zdrojové PNG a prompty jsou v samostatném balíku SEPTIK-ILUSTRACE.zip. Web používá úsporné WebP, vložené i přímo do index.html.

## Vizuální zadání

Originální, zvídavý a sympatický historický badatel s lehce rošťáckým výrazem. Klobouk, brašna, staré mapy, knihy a archeologické předměty; tlumené teplé barvy sladěné s papírovou, zelenou a cihlovou paletou hry. Stylizovaná kresba, silueta čitelná v malé velikosti. Bez podobnosti s konkrétním filmovým hercem, bez kopie kostýmu Indiana Jonese, bez klasických emoji a bez textu v obrázku.

## Šest stavů

| Klíč | Ilustrace | Událost ve hře |
| --- | --- | --- |
| idle | Základní postava s mapou a brašnou | Uvítání a nová hádanka |
| thinking | Přemýšlení nad mapou nebo poznámkou | Psaní tipu |
| success | Radost z rozluštění | Uznaný tip od97 % |
| surprise | Překvapení nad souvislostí | Blízký, dosud neuznaný tip |
| retry | Neúspěšný pokus, povzbudivý výraz | Vzdálenější tip |
| discovery | Objevování historického dokumentu | Odhalený původ výroku |

Pro každý stav uchovat shodnou tvář, proporce, oděv a barevnost. Přednost má jeden jasně čitelný výraz a gesto. Doporučené dodání: průhledné PNG v alespoň1024 px a úsporné webové varianty. Negenerovat šest různých postav.

## Zapojení

Modul `client/mascot.js` reaguje na existující herní události. Obrázky načítá z `globalThis.SEPTANDA_MASCOT_ASSETS`; bez skutečného souboru se průvodce skryje, aby nezůstalo prázdné místo nebo rozbitý obrázek.

Ilustrace jsou v `client/assets/septik/`. Přehled všech šesti stavů lze otevřít na `assets/septik/prehled.html`. Manifest `client/mascot-assets.js` se načítá před `mascot.js`:

```js
globalThis.SEPTANDA_MASCOT_ASSETS = {
  idle: 'assets/septik/idle.webp',
  thinking: 'assets/septik/thinking.webp',
  success: 'assets/septik/success.webp',
  surprise: 'assets/septik/surprise.webp',
  retry: 'assets/septik/retry.webp',
  discovery: 'assets/septik/discovery.webp'
};
```

Stejné názvy stavů lze později napojit na animace, video nebo sdílecí kartičky. Zdrojové obrázky a zadání ilustrací se uchovají odděleně od úsporných webových souborů. Tato verze nedělá marketingové příspěvky, nerozesílá zprávy a nevytváří sběratelské varianty.
