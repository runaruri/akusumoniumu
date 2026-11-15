"""Build the portable VS Code ZIP without credentials or hosting identity."""
from pathlib import Path
import re, zipfile
root=Path(__file__).resolve().parents[1]
site=root/'dist'
if not site.is_dir():
    raise SystemExit('Run from the source repository, which contains dist/.')
out=site/'source.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(site.rglob('*')):
        if not file.is_file() or file==out: continue
        target='acousmonium/'+file.relative_to(site).as_posix()
        if file.suffix=='.html':
            text=re.sub(r'<a\b[^>]*href="source\.zip"[^>]*>.*?</a\s*>','',file.read_text(),flags=re.S)
            archive.writestr(target,text)
        else: archive.write(file,target)
    for path in [root/'README.md',root/'docs',root/'tools',root/'templates']:
        for file in ([path] if path.is_file() else sorted(path.rglob('*'))):
            if file.is_file() and '__pycache__' not in file.parts:
                archive.write(file,'acousmonium/'+file.relative_to(root).as_posix())
print(f'Created {out.name}: {out.stat().st_size:,} bytes')
