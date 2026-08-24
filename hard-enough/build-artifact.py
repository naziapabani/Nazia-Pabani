#!/usr/bin/env python3
"""Derive the Artifact copy from index.html.

index.html is the canonical source and a complete standalone document.
The Artifact tool wraps published files in its own <!doctype>/<head>/<body>
skeleton, so the copy it publishes must be content-only. Everything else --
CSS, markup, JS -- is byte-identical, so the two never drift.

If seed.json exists it is embedded as the artifact's starting state. That
matters because publishing replaces the whole document: without a seed the
page ships with `null` state and the live board resets to empty. Before
republishing over a board people are using, pull its current app-state into
seed.json first.

    python3 build-artifact.py
"""
import json
import pathlib
import re

HERE = pathlib.Path(__file__).parent
src = (HERE / "index.html").read_text()

# Keep from <title> to the last </script>; the wrapper supplies the rest.
start = src.index("<title>")
end = src.rindex("</script>") + len("</script>")
body = src[start:end]

# charset and viewport come from the wrapper's own <head>.
body = re.sub(r'^<meta (charset|name="viewport")[^>]*>\n', "", body, flags=re.M)

seed_path = HERE / "seed.json"
if seed_path.exists():
    seed = json.loads(seed_path.read_text())
    payload = json.dumps(seed, separators=(",", ":")).replace("<", "\\u003c")
    # Only the real tag matches: the copy inside renderDocument() holds
    # `' + json + '`, not `null`.
    body, n = re.subn(
        r'(<script id="app-state" type="application/json">)null(</script>)',
        lambda m: m.group(1) + payload + m.group(2), body, count=1)
    if n != 1:
        raise SystemExit("app-state placeholder not found -- refusing to publish unseeded")
    names = [m.get("name") for m in seed.get("members", [])]
    print(f"seeded with {len(names)} member(s): {', '.join(names) or '(none)'}")
else:
    print("no seed.json -- artifact will start empty")

(HERE / "artifact.html").write_text(body + "\n")
print(f"artifact.html written ({len(body)} bytes)")
