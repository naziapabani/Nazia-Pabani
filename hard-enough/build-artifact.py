#!/usr/bin/env python3
"""Derive the Artifact copy from index.html.

index.html is the canonical source and a complete standalone document.
The Artifact tool wraps published files in its own <!doctype>/<head>/<body>
skeleton, so the copy it publishes must be content-only. Everything else --
CSS, markup, JS -- is byte-identical, so the two never drift.

Run after editing index.html:  python3 build-artifact.py
"""
import re
import pathlib

HERE = pathlib.Path(__file__).parent
src = (HERE / "index.html").read_text()

# Keep from <title> to the last </script>; the wrapper supplies the rest.
start = src.index("<title>")
end = src.rindex("</script>") + len("</script>")
body = src[start:end]

# charset and viewport come from the wrapper's own <head>.
body = re.sub(r'^<meta (charset|name="viewport")[^>]*>\n', "", body, flags=re.M)

(HERE / "artifact.html").write_text(body + "\n")
print(f"artifact.html written ({len(body)} bytes)")
