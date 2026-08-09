"""Sort every locale file alphabetically, at every nesting level.

NOT this repo's convention -- read this before running it.

Q-Wallets' core.json is grouped by topic (`action`, `wallet`, `send`, `filters`,
`address_book_ui`, `app`, ...) with newer feature blocks appended at the end,
and the other locales mirror that order key for key. Running this script
reorders all 248 keys in all 11 files at once: a large, unreviewable diff that
buries whatever change it is bundled with. i18n_add_keys.py and
i18n_apply_translations.py therefore preserve key order on write.

Keep it for two cases:

  * `--check` in CI, *if* the project ever adopts alphabetical ordering
  * a deliberate, standalone "sort the locale files" commit with no other change

Usage:
    python3 .agents/skills/i18n/i18n_sort.py            # sort in place
    python3 .agents/skills/i18n/i18n_sort.py --check    # exit 1 if anything is unsorted

Sorting is key-order only: no key is added, removed or renamed, and no value is
touched. The script verifies that itself before writing.
"""

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
LOCALES = REPO_ROOT / 'src' / 'i18n' / 'locales'


def sort_node(node):
    """Recursively sort dict keys. Lists keep their order — it is meaningful."""
    if isinstance(node, dict):
        return {k: sort_node(node[k]) for k in sorted(node, key=str.lower)}
    if isinstance(node, list):
        return [sort_node(item) for item in node]
    return node


def flatten(node, prefix=''):
    flat = {}
    for key, value in node.items():
        full = f'{prefix}.{key}' if prefix else key
        if isinstance(value, dict):
            flat.update(flatten(value, full))
        else:
            flat[full] = value
    return flat


def dump(data):
    return json.dumps(data, ensure_ascii=False, indent=2) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument(
        '--check',
        action='store_true',
        help='report unsorted files and exit 1 instead of rewriting them',
    )
    args = parser.parse_args()

    paths = sorted(LOCALES.glob('*/*.json'))
    if not paths:
        sys.exit(f'no locale files found under {LOCALES}')

    unsorted_files = []
    for path in paths:
        original = json.loads(path.read_text(encoding='utf-8'))
        ordered = sort_node(original)

        # Sorting must be order-only: same keys, same values.
        before, after = flatten(original), flatten(ordered)
        if before != after:
            sys.exit(f'ABORT: {path} content would change — refusing to write')

        if dump(ordered) == path.read_text(encoding='utf-8'):
            continue

        unsorted_files.append(path.relative_to(REPO_ROOT))
        if not args.check:
            path.write_text(dump(ordered), encoding='utf-8')

    if args.check:
        if unsorted_files:
            print(f'{len(unsorted_files)} locale files are not sorted:')
            for f in unsorted_files:
                print(f'  {f}')
            print('\nThis is expected: Q-Wallets locale files are topic-grouped.')
            sys.exit(1)
        print('All locale files are sorted.')
    else:
        print(f'{len(unsorted_files)} files sorted' if unsorted_files else 'Already sorted.')


if __name__ == '__main__':
    main()
