"""Merge new translation keys into every locale file.

Adds a nested patch of keys to all locales under src/i18n/locales/ so no locale
is ever left with a missing key. Existing values are never overwritten, so this
is safe to re-run.

The English text is written into every locale as a temporary placeholder. Those
placeholders must then be translated -- see i18n_apply_translations.py. A key
still holding English in a non-English locale is unfinished work, not a valid
default.

Usage:
    python3 .agents/skills/i18n/i18n_add_keys.py <patch.json>
    python3 .agents/skills/i18n/i18n_add_keys.py /tmp/new-keys.json --dry-run

The patch file mirrors the locale file structure, with values in English:

    {
      "address_book_ui": {
        "unnamed_contact": "unnamed contact",
        "save_without_name": "save without a registered name"
      }
    }

Key order is preserved: new keys are appended to the end of the block that owns
them, which is how core.json has always grown. The file is topic-grouped rather
than alphabetical, so this script does NOT re-sort on write (unlike its Qortal
Hub original). Pass --sort only if the project deliberately switches convention.
"""

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
LOCALES = REPO_ROOT / 'src' / 'i18n' / 'locales'
NAMESPACE = 'core'


def languages():
    """Every locale directory that exists, so a new language needs no edit here."""
    return sorted(d.name for d in LOCALES.iterdir() if d.is_dir())


def sort_node(node):
    if isinstance(node, dict):
        return {k: sort_node(node[k]) for k in sorted(node, key=str.lower)}
    if isinstance(node, list):
        return [sort_node(item) for item in node]
    return node


def merge(dst, src, added, path=''):
    """Deep-merge src into dst without overwriting. Records added key paths."""
    for key, value in src.items():
        full = f'{path}.{key}' if path else key
        if isinstance(value, dict):
            if not isinstance(dst.get(key), dict):
                dst[key] = {}
            merge(dst[key], value, added, full)
        elif key not in dst:
            dst[key] = value
            added.append(full)


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('patch', help='JSON file of new keys, values in English')
    parser.add_argument(
        '--namespace',
        default=NAMESPACE,
        help=f'locale file to patch, without .json (default: {NAMESPACE})',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='report what would change without writing',
    )
    parser.add_argument(
        '--sort',
        action='store_true',
        help='alphabetize the whole file on write (NOT this repo\'s convention)',
    )
    args = parser.parse_args()

    patch = json.loads(Path(args.patch).read_text(encoding='utf-8'))
    langs = languages()

    added_en = []
    for lang in langs:
        path = LOCALES / lang / f'{args.namespace}.json'
        if not path.exists():
            sys.exit(f'missing locale file: {path}')

        data = json.loads(path.read_text(encoding='utf-8'))
        added = []
        merge(data, patch, added)

        if lang == 'en':
            added_en = added
        if added and not args.dry_run:
            out = sort_node(data) if args.sort else data
            path.write_text(
                json.dumps(out, ensure_ascii=False, indent=2) + '\n',
                encoding='utf-8',
            )

    for key in added_en:
        print(f'  + {args.namespace}:{key}')

    verb = 'would be added' if args.dry_run else 'added'
    print(
        f'\n{len(added_en)} keys {verb} to {args.namespace}.json '
        f'across {len(langs)} locales'
    )
    if added_en and not args.dry_run:
        print('Next: translate them with i18n_apply_translations.py')


if __name__ == '__main__':
    main()
