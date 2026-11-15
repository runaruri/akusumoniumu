"""Apply shared header/footer templates to every static HTML page (Python 3)."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
site=root/'dist' if (root/'dist').is_dir() else root
for file in site.glob('*.html'):
    text=file.read_text()
    for tag,name in [('header','header'),('footer','footer')]:
        pattern=rf'<{tag} class="{("masthead" if tag=="header" else "site-footer")}">.*?</{tag}>'
        content=(root/'templates'/f'{name}.html').read_text().strip()
        # Portable downloads do not recursively contain their own source ZIP.
        if not (site/'source.zip').exists():
            content=re.sub(r'<a\b[^>]*href="source\.zip"[^>]*>.*?</a\s*>','',content,flags=re.S)
        text,count=re.subn(pattern,lambda m:content,text,flags=re.S)
        assert count==1,f'{file.name}: expected exactly one {tag}'
    file.write_text(text)
print('Shared header and footer synchronized.')
