"""Replace bundled narration: python tools/embed_audio.py chapter1.mp3 chapter2.mp3."""
from pathlib import Path
import base64
import json
import sys

if len(sys.argv) != 3:
    raise SystemExit('Usage: python tools/embed_audio.py chapter1.mp3 chapter2.mp3')
root = Path(__file__).resolve().parents[1]
site = root / 'dist' if (root / 'dist').exists() else root
paths = [Path(value).resolve() for value in sys.argv[1:]]
for path in paths:
    if not path.is_file():
        raise SystemExit(f'Audio file not found: {path}')
    if path.stat().st_size > 10 * 1024 * 1024:
        raise SystemExit(f'Use audio under 10 MB per chapter: {path}')
encoded = [base64.b64encode(path.read_bytes()).decode('ascii') for path in paths]
(site / 'audio-data.js').write_text('const NARRATION_AUDIO = ' + json.dumps(encoded) + ';\n')
print('Updated audio-data.js. Also update the transcript in lab.js and story.html.')
