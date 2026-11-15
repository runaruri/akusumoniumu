"""Check local page and asset references. Python 3, no extra packages."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse,unquote
import re,json
root=Path(__file__).resolve().parents[1]
site=root/'dist' if (root/'dist').is_dir() else root
class Page(HTMLParser):
    def __init__(self):super().__init__();self.ids=[];self.refs=[];self.labels=[];self.h1=0;self.title=False
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if 'id' in d:self.ids.append(d['id'])
        for key in ['href','src']:
            if key in d:self.refs.append(d[key])
        if tag=='label' and 'for' in d:self.labels.append(d['for'])
        if tag=='h1':self.h1+=1
        if tag=='title':self.title=True
pages={}
for file in site.glob('*.html'):
    p=Page();p.feed(file.read_text());pages[file.name]=p
    assert len(p.ids)==len(set(p.ids)),f'Duplicate ID: {file.name}'
    assert p.h1==1 and p.title,f'Title/H1 issue: {file.name}'
    assert set(p.labels)<=set(p.ids),f'Label missing control: {file.name}'
for file,p in pages.items():
    for ref in p.refs:
        url=urlparse(ref)
        if url.scheme or ref=='#':continue
        target=unquote(url.path) or file
        assert (site/target).exists(),f'Missing file: {file} -> {ref}'
        if url.fragment and target in pages:assert url.fragment in pages[target].ids,f'Missing anchor: {file} -> {ref}'
# Dynamic navigational targets also need existing files and IDs.
for file in ['editorial.js']:
    for ref in re.findall(r"['\"]([a-z-]+\.html(?:#[a-z0-9-]+)?)['\"]",(site/file).read_text()):
        path,_,anchor=ref.partition('#')
        assert path in pages,f'Dynamic target missing: {ref}'
        if anchor:assert anchor in pages[path].ids,f'Dynamic anchor missing: {ref}'
raw=(site/'search-index.js').read_text().partition('=')[2].strip().rstrip(';')
index=json.loads(raw)
assert {i['url'] for i in index}==set(pages),'Search index pages do not match'
for file in site.glob('*.css'):
    css=file.read_text();assert css.count('{')==css.count('}'),f'Unbalanced CSS: {file}'
print(f'PASS: {len(pages)} pages; local files, anchors, labels, dynamic links, search coverage and CSS braces')
