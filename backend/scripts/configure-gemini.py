#!/usr/bin/env python3
"""Run on the VPS only. The key is entered without echo and never passed in shell history."""
from pathlib import Path
import getpass
import os
import tempfile

backend = Path(__file__).resolve().parent.parent
target = backend / '.env.gemini'
print('Use a dedicated Google AI Studio project showing Free tier, with billing disabled.')
print('This script cannot inspect or change Google billing. Do not use a paid-project key.')
key = getpass.getpass('Paste your Gemini API key (hidden): ').strip()
if len(key) < 20 or not all(c.isalnum() or c in '_-' for c in key):
    raise SystemExit('Key format looks invalid. Configuration was not changed.')
content = '\n'.join([
    'AI_PROVIDER=gemini', 'GEMINI_MODEL=gemini-2.5-flash-lite',
    'GEMINI_API_KEY=' + key, 'GEMINI_BILLING_TIER=free',
    'AI_GLOBAL_DAILY_LIMIT=20', 'AI_GLOBAL_MINUTE_LIMIT=4',
    'AI_DAILY_LIMIT=10', 'AI_MAX_CONCURRENT=1', 'AI_MAX_OUTPUT_TOKENS=1024', '',
])
fd, temp = tempfile.mkstemp(prefix='.gemini-', dir=backend)
try:
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, 'w') as handle:
        handle.write(content)
    os.replace(temp, target)
finally:
    if os.path.exists(temp):
        os.unlink(temp)
print('Gemini configuration saved privately. Free-tier pilot: 10 requests per user, 20 total per rolling 24 hours; 4 total per minute.')
print('No service was restarted. Run check-gemini.cjs --live before activation.')
