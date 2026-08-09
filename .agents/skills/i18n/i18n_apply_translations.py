"""Apply reviewed translations to the locale files, in one batch.

Counterpart to i18n_add_keys.py. That script seeds new keys into every locale
with English placeholders; this one replaces those placeholders with the real
translations once they have been written and reviewed. Only the keys named in
the input are touched, so existing reviewed translations are never clobbered.

Usage:
    python3 .agents/skills/i18n/i18n_apply_translations.py <translations.json>
    python3 .agents/skills/i18n/i18n_apply_translations.py --audit
    python3 .agents/skills/i18n/i18n_apply_translations.py --audit --keys a.b,c.d

Input format: language -> dotted key -> translated value.

    {
      "de": {
        "address_book_ui.unnamed_contact": "unbenannter kontakt",
        "address_book_address_invalid": "ungültiges {{coinType}}-adressformat"
      },
      "fr": {
        "address_book_ui.unnamed_contact": "contact sans nom"
      }
    }

The Qortal Hub form -- namespace -> language -> key -> value -- is also
accepted, since Q-Wallets has the single namespace `core`.

Values must keep every {{placeholder}} from the English source -- reordered
freely to suit the target language. That is enforced below; violations abort the
run before anything is written. Placeholders are matched with or without inner
spaces, because core.json contains both `{{coinType}}` and `{{ hash }}`.

Casing is NOT enforced. core.json mixes lowercase-plus-postProcess keys with
natural-case blocks, and some languages capitalize by rule regardless.

Key order is preserved on write -- see the note in i18n_add_keys.py.
"""

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
LOCALES = REPO_ROOT / 'src' / 'i18n' / 'locales'
NAMESPACE = 'core'
PLACEHOLDER = re.compile(r'{{\s*(\w+)\s*}}')

# Terms that legitimately read the same in English and the target language, so
# the audit does not flag them as untranslated. Coin names are deliberately
# identical in every locale.
COGNATE_ALLOWLIST = {
    'Bitcoin',
    'Digibyte',
    'Dogecoin',
    'Litecoin',
    'Pirate Chain',
    'Qortal',
    'Ravencoin',
    'Arbitrary',
}


def languages():
    return sorted(d.name for d in LOCALES.iterdir() if d.is_dir())


def sort_node(node):
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


def load(lang, namespace=NAMESPACE):
    return json.loads(
        (LOCALES / lang / f'{namespace}.json').read_text(encoding='utf-8')
    )


def put(node, dotted, value):
    parts = dotted.split('.')
    for part in parts[:-1]:
        node = node.setdefault(part, {})
    node[parts[-1]] = value


def normalize(payload):
    """Accept both `lang -> key -> value` and `namespace -> lang -> key -> value`."""
    langs = set(languages())
    if payload and set(payload) <= langs:
        return {NAMESPACE: payload}
    return payload


def apply_translations(path_arg, do_sort):
    payload = normalize(
        json.loads(Path(path_arg).read_text(encoding='utf-8'))
    )

    problems = []
    for namespace, by_lang in payload.items():
        english = flatten(load('en', namespace))
        for lang, entries in by_lang.items():
            for key, value in entries.items():
                if key not in english:
                    problems.append(f'{lang}/{namespace}: unknown key {key}')
                    continue
                expected = set(PLACEHOLDER.findall(english[key]))
                actual = set(PLACEHOLDER.findall(value))
                if expected != actual:
                    problems.append(
                        f'{lang}/{namespace}:{key} placeholder mismatch '
                        f'{sorted(expected)} -> {sorted(actual)}'
                    )
                if not str(value).strip():
                    problems.append(f'{lang}/{namespace}:{key} is empty')

    if problems:
        print('Refusing to write, fix these first:\n')
        print('\n'.join(f'  {p}' for p in problems))
        sys.exit(1)

    written = 0
    for namespace, by_lang in payload.items():
        for lang, entries in by_lang.items():
            path = LOCALES / lang / f'{namespace}.json'
            data = json.loads(path.read_text(encoding='utf-8'))
            for key, value in entries.items():
                put(data, key, value)
            out = sort_node(data) if do_sort else data
            path.write_text(
                json.dumps(out, ensure_ascii=False, indent=2) + '\n',
                encoding='utf-8',
            )
            written += len(entries)
            print(f'  {lang}/{namespace}.json: {len(entries)} keys')

    print(f'\n{written} translations applied')


def audit(only_keys):
    """Report key-set drift and values still identical to English.

    Key parity is checked first: a key missing from one locale renders as
    English there, and a key no locale's `en` defines is dead weight.
    """
    english = flatten(load('en'))
    wanted = (lambda k: k in only_keys) if only_keys else (lambda k: True)
    base_keys = [k for k in english if wanted(k)]

    if only_keys:
        unknown = sorted(k for k in only_keys if k not in english)
        if unknown:
            sys.exit(f'not present in en/{NAMESPACE}.json: {", ".join(unknown)}')

    drift = 0
    untranslated = 0

    for lang in languages():
        entries = flatten(load(lang))

        missing = [k for k in base_keys if k not in entries]
        orphan = [k for k in entries if wanted(k) and k not in english]
        if missing:
            drift += len(missing)
            print(f'{lang}/{NAMESPACE}.json: {len(missing)} missing: {", ".join(missing)}')
        if orphan:
            drift += len(orphan)
            print(f'{lang}/{NAMESPACE}.json: {len(orphan)} not in en: {", ".join(orphan)}')

        if lang == 'en':
            continue
        same = [
            key
            for key in base_keys
            if key in entries
            and entries[key] == english[key]
            and len(str(entries[key])) > 3
            and str(entries[key]) not in COGNATE_ALLOWLIST
        ]
        if same:
            untranslated += len(same)
            print(f'{lang}/{NAMESPACE}.json: {len(same)} untranslated: {", ".join(same)}')

    print(
        f'\n{drift} key-set problems, {untranslated} values still matching English.'
    )
    print('Key-set problems are always defects. Untranslated values may be')
    print('genuine cognates or proper nouns; confirm before "fixing" them.')
    return 1 if drift else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('translations', nargs='?', help='JSON file of translations')
    parser.add_argument(
        '--audit',
        action='store_true',
        help='check key parity and list values identical to English',
    )
    parser.add_argument(
        '--keys',
        help='comma-separated dotted keys to limit --audit to',
    )
    parser.add_argument(
        '--sort',
        action='store_true',
        help='alphabetize the whole file on write (NOT this repo\'s convention)',
    )
    args = parser.parse_args()

    if args.audit:
        only = {k.strip() for k in args.keys.split(',') if k.strip()} if args.keys else None
        sys.exit(audit(only))
    elif args.translations:
        apply_translations(args.translations, args.sort)
    else:
        parser.error('provide a translations file or --audit')


if __name__ == '__main__':
    main()
