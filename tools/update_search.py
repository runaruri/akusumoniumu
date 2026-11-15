"""Update the offline search index after editing HTML. Requires only Python 3."""
from pathlib import Path
from html.parser import HTMLParser
import json

root = Path(__file__).resolve().parents[1]
site = root / 'dist' if (root / 'dist').is_dir() else root
class Text(HTMLParser):
    def __init__(self):
        super().__init__(); self.title=[]; self.parts=[]; self.in_title=False; self.in_main=False; self.description=''
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if tag=='title': self.in_title=True
        if tag=='main': self.in_main=True
        if tag=='meta' and d.get('name')=='description': self.description=d.get('content','')
    def handle_endtag(self,tag):
        if tag=='title': self.in_title=False
        if tag=='main': self.in_main=False
    def handle_data(self,data):
        if self.in_title:self.title.append(data)
        if self.in_main:self.parts.append(data)
entries=[]
files=sorted(site.glob('*.html'),key=lambda p:(p.name!='index.html',p.name))
for path in files:
    p=Text();p.feed(path.read_text())
    entries.append({'url':path.name,'title':''.join(p.title).split(' | ')[0],'description':p.description,'text':' '.join(' '.join(p.parts).split())})
(site/'search-index.js').write_text('const SITE_SEARCH_INDEX = '+json.dumps(entries,ensure_ascii=False,indent=2)+';\n')
print(f'Updated search index: {len(entries)} pages')
