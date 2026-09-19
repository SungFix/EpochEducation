from pathlib import Path
import base64, mimetypes, re

root = Path(__file__).resolve().parents[1]
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'styles.css').read_text(encoding='utf-8')
content = (root / 'content-data.js').read_text(encoding='utf-8')
app = (root / 'app.js').read_text(encoding='utf-8')
platform = (root / 'platform-features.js').read_text(encoding='utf-8')
bootstrap = (root / 'bootstrap.js').read_text(encoding='utf-8')

# Mark standalone mode so service-worker/PWA code knows not to register local files.
html = re.sub(r'<html lang="pt-BR" data-theme="dark"[^>]*>', '<html lang="pt-BR" data-theme="dark" data-standalone-file="true" data-build="54">', html, count=1)

# Convert all branding images referenced by the document (including paths inside inline theme bootstrap scripts) to data URIs.
branding = root / 'assets' / 'branding'
for path in branding.iterdir():
    if not path.is_file():
        continue
    rel = f'assets/branding/{path.name}'
    if rel not in html:
        continue
    mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    data = base64.b64encode(path.read_bytes()).decode('ascii')
    data_uri = f'data:{mime};base64,{data}'
    # Replace the complete asset URL, including cache-busting query strings.
    # Leaving `?v=...` after a data URI makes the embedded image invalid.
    html = re.sub(re.escape(rel) + r'(?:\?v=\d+)?', lambda _m, uri=data_uri: uri, html)

# Standalone files cannot install a PWA manifest from a sibling file.
html = re.sub(r'\s*<link rel="manifest"[^>]*>\s*', '\n', html, count=1)

style_link = re.compile(r'<link rel="stylesheet" href="styles\.css\?v=\d+"\s*/?>')
html, count = style_link.subn('<style>\n' + css + '\n</style>', html, count=1)
if count != 1:
    raise SystemExit('stylesheet link not found')

scripts = [
    ('content-data.js', content),
    ('app.js', app),
    ('platform-features.js', platform),
    ('bootstrap.js', bootstrap),
]
for filename, source in scripts:
    pattern = re.compile(rf'<script src="{re.escape(filename)}\?v=\d+"></script>')
    replacement = '<script>\n' + source.replace('</script>', '<\\/script>') + '\n</script>'
    html, count = pattern.subn(lambda m, r=replacement: r, html, count=1)
    if count != 1:
        raise SystemExit(f'script tag not found: {filename}')

# No remaining local stylesheet/script/image dependencies should be required to open the file.
output = root / 'Epoch-Education.html'
output.write_text(html, encoding='utf-8')
(root / 'index-standalone-preview.html').write_text(html, encoding='utf-8')
print(output)
