var WO_TYPES = ['Run','Walk','Hike','Lift','Strength','Ride','Cycling','Spin','Swim','Row','Yoga','Pilates','Barre',
  'HIIT','CrossFit','Elliptical','Stair','Boxing','Dance','Tennis','Basketball','Soccer','Golf','Climb',
  'Core','Stretch','Mobility','Functional','Treadmill','Sport','Other'];

function parseWorkoutText(txt) {
  var out = { min: 0, kcal: 0, hr: 0, type: '' };
  if (!txt) return out;
  var t = String(txt)
    .replace(/[–—]/g, '-')          // en/em dash -> hyphen
    .replace(/[·•]/g, ' ')          // bullets -> space
    .replace(/,/g, '');

  /* ---- duration, most specific first ----
     The traps: a status-bar clock, a start-end range, and per-zone
     durations that all look like MM:SS. Only accept a bare MM:SS as a
     last resort, and only when it is unambiguous. */
  var m;
  if ((m = t.match(/(\d{1,2}):([0-5]\d):([0-5]\d)(?!\d)/)))                       // 00:42:30
    out.min = Math.round(Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 60);

  if (!out.min && (m = t.match(/(\d{1,3}):([0-5]\d)\s*(?:m|min|mins|minutes)\b/i))) // 54:15 m
    out.min = Math.round(Number(m[1]) + Number(m[2]) / 60);

  if (!out.min && (m = t.match(/(\d{1,2}):([0-5]\d)\s*([AaPp])\.?[Mm]\.?\s*-\s*(\d{1,2}):([0-5]\d)\s*([AaPp])\.?[Mm]/))) {
    var s = (Number(m[1]) % 12) * 60 + Number(m[2]) + (/p/i.test(m[3]) ? 720 : 0);
    var e = (Number(m[4]) % 12) * 60 + Number(m[5]) + (/p/i.test(m[6]) ? 720 : 0);
    if (e < s) e += 1440;
    out.min = e - s;
  }

  if (!out.min) {
    var h = t.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
    var mm = t.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i);
    if (h) out.min += Math.round(Number(h[1]) * 60);
    if (mm) out.min += Number(mm[1]);
  }

  if (!out.min) {                                    // bare MM:SS, only if unambiguous
    // no lookbehind: a bad regex literal is a parse error, not a runtime
    // one, and would blank the page on older Safari.
    var all = [], bare = /(^|[^\d:])(\d{1,3}):([0-5]\d)(?![\d:])/g, b;
    while ((b = bare.exec(t))) all.push(b[2] + ':' + b[3]);
    var lab = t.match(/(?:duration|elapsed|total\s*time|moving\s*time)\D{0,8}(\d{1,3}):([0-5]\d)/i);
    if (lab) out.min = Math.round(Number(lab[1]) + Number(lab[2]) / 60);
    else if (all.length === 1) {
      var p = all[0].split(':');
      out.min = Math.round(Number(p[0]) + Number(p[1]) / 60);
    }
  }

  /* ---- calories ---- */
  var cal = t.match(/(\d{2,5})\s*k?cal(?:ories)?\b/i) ||
            t.match(/(?:total\s*)?(?:calories|energy)[^\d\n]{0,12}(\d{2,5})/i);
  if (cal) out.kcal = Math.round(Number(cal[1]));

  /* ---- heart rate ----
     A number labelled AVERAGE wins. Never take one labelled MAX, and
     never a zone bound (those sit next to < > or a hyphen range). */
  var avg = t.match(/(\d{2,3})\s*bpm\s*(?:average|avg)/i) ||
            t.match(/(?:average|avg)\.?\s*(?:heart\s*rate|hr|bpm)?[^\d\n]{0,10}?(\d{2,3})/i);
  if (avg) out.hr = Number(avg[1]);
  if (!out.hr) {
    var re = /(?:^|[^\d<>\-])(\d{2,3})\s*bpm(?!\s*(?:max|maximum))/gi, hit;
    while ((hit = re.exec(t))) {
      var before = t.slice(Math.max(0, hit.index - 14), hit.index);
      if (/max|maximum|zone|resting/i.test(before)) continue;
      if (/[<>\-]\s*$/.test(before)) continue;
      out.hr = Number(hit[1]); break;
    }
  }

  /* ---- activity type ---- */
  for (var i = 0; i < WO_TYPES.length; i++) {
    if (new RegExp('\\b' + WO_TYPES[i] + '\\b', 'i').test(t)) { out.type = WO_TYPES[i]; break; }
  }
  if (!out.type && /cycl|bike/i.test(t)) out.type = 'Ride';
  if (!out.type && /weight/i.test(t)) out.type = 'Lift';
  return out;
}

/* ---------------- tests against real app output ---------------- */
var CASES = [
  { name: 'Ultrahuman Pilates (from the screenshot)',
    txt: '6:59\nSun, 2 Aug\n5:58 PM-6:52 PM • 54:15 m\nPilates\n126BPM AVERAGE HR\n172 BPM MAX HR\n342 KCAL TOTAL CALORIES\nWorkout Zones\nZone 1 <108 BPM • 13:58\nZone 2 108-120 BPM • 03:58\nZone 3 121-145 BPM • 26:47\nZone 4 146-171 BPM • 09:21\nZone 5 >171 BPM • 00:01\nSimple HR Karvonen\nCalories\nTotal Calories\n342 kcal',
    want: { min: 54, kcal: 342, hr: 126, type: 'Pilates' } },
  { name: 'Apple Fitness run',
    txt: 'Outdoor Run\nDuration 00:42:30\nActive Energy 388 CAL\nTotal Energy 455 CAL\nAvg. Heart Rate 152 BPM',
    want: { min: 43, kcal: 388, hr: 152, type: 'Run' } },
  { name: 'Ultrahuman strength, no range',
    txt: 'Strength\n45:00 m\n118BPM AVERAGE HR\n165 BPM MAX HR\n286 KCAL TOTAL CALORIES',
    want: { min: 45, kcal: 286, hr: 118, type: 'Strength' } },
  { name: 'Strava-ish',
    txt: 'Morning Ride\nMoving Time 1:12:40\n612 kcal\nAvg HR 141 bpm',
    want: { min: 73, kcal: 612, hr: 141, type: 'Ride' } },
  { name: 'plain english',
    txt: 'went for a 30 min walk, burned about 140 calories',
    want: { min: 30, kcal: 140, hr: 0, type: 'Walk' } },
  { name: 'zone list only, no avg label',
    txt: 'Yoga\n32:10 m\nZone 2 108-120 BPM • 12:00\n145 BPM MAX HR\n98 KCAL',
    want: { min: 32, kcal: 98, hr: 0, type: 'Yoga' } }
];

var fail = 0;
CASES.forEach(function (c) {
  var got = parseWorkoutText(c.txt);
  var ok = ['min','kcal','hr','type'].every(function (k) { return got[k] === c.want[k]; });
  if (!ok) fail++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + c.name);
  if (!ok) console.log('        want ' + JSON.stringify(c.want) + '\n         got ' + JSON.stringify(got));
});
console.log(fail ? '\n' + fail + ' failing' : '\nall ' + CASES.length + ' passing');
