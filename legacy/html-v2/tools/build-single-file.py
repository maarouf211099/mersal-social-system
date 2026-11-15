"""Builds dist/social-system.html: one self-contained file (CSS + JS inlined).
Use it to open the system by double-click, or to publish it as a claude.ai page."""
import pathlib, re
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'assets/app.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="assets/app.css">', '<style>\n' + css + '\n</style>')
for js in ('store.js', 'app.js'):
    code = (root / 'assets' / js).read_text(encoding='utf-8')
    html = html.replace(f'<script src="assets/{js}"></script>', '<script>\n' + code + '\n</script>')
import base64
for name in ('logo.png', 'logo-white.png'):
    data = base64.b64encode((root / 'assets/brand' / name).read_bytes()).decode()
    html = html.replace('assets/brand/' + name, 'data:image/png;base64,' + data)
(root / 'dist').mkdir(exist_ok=True)
(root / 'dist/social-system.html').write_text(html, encoding='utf-8')
# claude.ai artifact version: page content only (the publisher adds doctype/head/body)
body = html.split('<body>', 1)[1].rsplit('</body>', 1)[0]
head = html.split('<head>', 1)[1].split('</head>', 1)[0]
head = re.sub(r'<meta charset[^>]*>\n?|<meta name="viewport"[^>]*>\n?', '', head)
title = re.search(r'<title>.*?</title>', head).group(0)
head = head.replace(title + '\n', '')
(root / 'dist/artifact.html').write_text(title + '\n' + head + body, encoding='utf-8')
print('built dist/social-system.html and dist/artifact.html')
