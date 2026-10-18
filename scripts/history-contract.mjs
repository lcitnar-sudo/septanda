import assert from 'node:assert/strict';

// Published identities are a compatibility contract, independent of the app release number.
const same = (value, expected, message) => assert.equal(JSON.stringify(value), JSON.stringify(expected), message);
const storageKey = (source, name) => source.match(new RegExp('\\b' + name + "\\s*=\\s*['\"]([^'\"]+)['\"]"))?.[1];
const dayIDs = day => Array.from(Array.isArray(day) ? day : day.ids);
export function historySnapshot({puzzles, calendar, daily, appSource, normalize}) {
  return {
    format: 1,
    stateVersion: daily.createState(null).version,
    guestStorageKey: storageKey(appSource, 'GUEST_KEY'),
    legacyStorageKey: storageKey(appSource, 'LEGACY_KEY'),
    legacyIds: Array.from(daily.legacyIDs),
    puzzles: puzzles.map(puzzle => ({id: puzzle.id, answer: normalize(puzzle.answer)})),
    calendar: {startDate: calendar.startDate, timeZone: calendar.timeZone, afterEnd: calendar.afterEnd, days: calendar.days.map(dayIDs)}
  };
}
export function assertHistoryContract({baseline, requireComplete = true, ...input}) {
  assert.equal(baseline?.format, 1, 'Chybí platný záznam vydané historie. Nezakládej hráčům nový archiv.');
  const current = historySnapshot(input), fail = ' Změna vyžaduje převod existující historie, nikoli její reset.';
  for (const key of ['stateVersion', 'guestStorageKey', 'legacyStorageKey', 'legacyIds'])
    same(current[key], baseline[key], 'Změnil se trvalý formát nebo klíč ' + key + '.' + fail);
  const catalog = new Map(input.puzzles.map(puzzle => [puzzle.id, puzzle]));
  for (const published of baseline.puzzles) {
    const puzzle = catalog.get(published.id);
    assert.ok(puzzle, 'Vydaný výrok nesmí zmizet ani dostat jiné ID: ' + published.id + '.' + fail);
    assert.ok([puzzle.answer, ...puzzle.variants].some(answer => input.normalize(answer) === published.answer),
      'ID nesmí označovat jiný výrok: ' + published.id + '. Při opravě originálu ponech dřívější znění mezi přijímanými variantami.');
  }
  for (const key of ['startDate', 'timeZone', 'afterEnd'])
    same(current.calendar[key], baseline.calendar[key], 'Změnil se vydaný kalendář: ' + key + '.' + fail);
  assert.ok(current.calendar.days.length >= baseline.calendar.days.length, 'Vydané denní sady nesmí být odebrané.');
  baseline.calendar.days.forEach((ids, index) => same(current.calendar.days[index], ids, 'Změnila se vydaná denní sada ' + (index + 1) + '.' + fail));
  if (requireComplete) {
    assert.equal(current.puzzles.length, baseline.puzzles.length, 'Nové výroky nejprve připoj příkazem npm run content:record.');
    assert.equal(current.calendar.days.length, baseline.calendar.days.length, 'Nové denní sady nejprve připoj příkazem npm run content:record.');
  }
  const published = new Map(baseline.puzzles.map(puzzle => [puzzle.id, puzzle]));
  return {...current, puzzles: current.puzzles.map(puzzle => published.get(puzzle.id) || puzzle)};
}
