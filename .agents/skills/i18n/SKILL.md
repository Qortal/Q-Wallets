---
name: i18n
description: Rules for user-visible text in Q-Wallets. Read BEFORE writing or editing any component, dialog, form, toast, tooltip, aria-label, placeholder, helper text, or error message. Every user-facing string must go through i18next in all 11 locales — never hardcode English. Triggers on any UI work, any new component, any string a user could read.
---

# i18n is mandatory for every user-visible string

Q-Wallets ships in **11 languages** (`ar de en es et fr it ja pt ru zh`) with a
**single namespace, `core`**. A hardcoded English literal is a bug, not a shortcut.
This applies to new code and to any line you touch in existing code.

Every locale currently holds the same 248 keys with real translations. Keep it that
way: a key added to `en` only is a key that renders as English to ten of eleven users.

## What counts as user-visible

Translate all of these — the last three are the ones most often missed:

- JSX text content, `Typography`, `Button`, `MenuItem` children
- `label`, `placeholder`, `title`, `helperText`, `alt`
- **`aria-label` and every other accessibility string**
- **Error and status messages**, including ones thrown from `utils/` and surfaced
  as `saveError` or snackbar text
- **Strings built in plain `.ts` helper modules** that end up on screen

Do NOT translate: `console.*` messages, `qortalRequest` action names, localStorage
keys, QDN identifiers, coin tickers and enum values (`Coin.BTC`), API field names,
`data-*` attributes, test fixtures.

## The pattern in components

```tsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation(['core']);

<Button>
  {t('core:address_book_save', { postProcess: 'capitalizeFirstChar' })}
</Button>;
```

`core` is the only namespace and also the default, but **always write the `core:`
prefix** — every existing call site does.

## The pattern outside components

There is no established `i18n.t()` call site outside React here, and adding one is a
trap: the i18n instance is initialized only as a **side effect** of
`useIframeListener.tsx` importing `supportedLanguages` from `../i18n/i18n`. Anything
importing the singleton earlier gets an uninitialized instance.

So for non-component code that produces display text, **take `t` as a parameter** or
**return a key plus params** and let the component render it:

```ts
// utils/…
export const validateNote = (value: string) =>
  value.length > ADDRESSBOOK_NOTE_LENGTH
    ? {
        key: 'core:address_book_note_max_length',
        params: { max_note: ADDRESSBOOK_NOTE_LENGTH },
      }
    : null;
```

Do not follow the existing anti-pattern in
[src/utils/addressBookStorage.ts](../../../src/utils/addressBookStorage.ts), which
`throw`s English sentences that
[AddressBookDialog.tsx](../../../src/components/AddressBook/AddressBookDialog.tsx)
then string-matches (`errorMessage === 'Address already exists in the address book'`)
to swap in a translated key. Every other thrown message reaches the user untranslated.

## Casing and post-processors

Two conventions coexist in `core.json`, split by age:

- **Legacy, lowercase source + `postProcess`** — the flat `address_book_*`,
  `action.*`, `message.*` keys. One key renders as `Close`, `CLOSE` or `close`
  depending on the call site.
- **Newer nested blocks written in natural Sentence case** and used with **no**
  post-processor — `wallet.*`, `send.*`, `filters.*`, `address_book_ui.*`, `app.*`,
  `common.*`.

**Match the block you are adding to.** Do not lowercase an existing natural-case
block or bolt a post-processor onto it. Never write `t(...).toUpperCase()` in JSX —
use a post-processor so other languages capitalize by their own rules.

| Processor                 | Effect                                 | Registered? |
| ------------------------- | -------------------------------------- | ----------- |
| `capitalizeFirstChar`     | `close` → `Close` — the default choice | yes         |
| `capitalizeFirstWord`     | first word uppercased entirely         | yes         |
| `capitalizeAll`           | ALL CAPS — pagination/stat labels      | yes         |
| `capitalizeEachFirstChar` | Title Case                             | **no**      |

`capitalizeEachFirstChar` is exported from
[src/i18n/processors.ts](../../../src/i18n/processors.ts) but **never passed to
`.use()`** in [src/i18n/i18n.ts](../../../src/i18n/i18n.ts) — asking for it does
nothing. Register it there first if you genuinely need Title Case.

## Key naming and file organisation

`core.json` is **grouped by topic, not sorted alphabetically**, and newer feature
blocks were appended at the end. All 11 locales mirror that order key for key.

- Add a key to the **nested block that owns the feature** (`wallet`, `send`,
  `filters`, `address_book_ui`, `app`, `message.error`, `action`, …). The flat
  top-level `address_book_*` keys are legacy — do not grow that list.
- `snake_case`, no abbreviations; name by meaning, not by the English wording, so the
  key survives a copy edit.
- Shapes already in use: `action.close`, `message.error.loading_balance`,
  `message.generic.validating`, `table_headers.<table>.<column>`.
- **Do not re-sort the files.** `i18n_add_keys.py` and `i18n_apply_translations.py`
  preserve key order on write (this differs from their Qortal Hub originals, which
  alphabetize). Sorting would reorder 248 keys across 11 files and bury your change.

## The scripts

All four live beside this file and run from the repo root with `--help`.

| Task                                 | Command                                                                      |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Find what needs migrating            | `python3 .agents/skills/i18n/i18n_scan_hardcoded.py <path>`                  |
| Seed new keys into all 11 locales    | `python3 .agents/skills/i18n/i18n_add_keys.py <patch.json>`                  |
| Apply the translations               | `python3 .agents/skills/i18n/i18n_apply_translations.py <translations.json>` |
| Check parity + leftover English      | `python3 .agents/skills/i18n/i18n_apply_translations.py --audit`             |
| Alphabetize (**not the convention**) | `python3 .agents/skills/i18n/i18n_sort.py`                                   |

**Never hand-edit 11 locale files.** That is how a key goes missing from one
language. The scripts write all locales in one pass and validate as they go.

`i18n_sort.py` is kept only for a future convention change or a deliberate
standalone sorting commit — read its docstring before running it.

## The workflow

### 1. Find the strings

```bash
python3 .agents/skills/i18n/i18n_scan_hardcoded.py src/components/AddressBook
python3 .agents/skills/i18n/i18n_scan_hardcoded.py --detail <file>
python3 .agents/skills/i18n/i18n_scan_hardcoded.py -o /tmp/hits.json src/
```

Hits are candidates, not confirmed defects — coin names (`Pirate Chain`), CSS values
and API fields show up too. Read them before acting. The scanner is line-based, so it
also **misses** template literals like `` `No ${visual.symbol} contacts yet` ``; scan
the file, then read it.

### 2. Seed the keys

Write a patch file mirroring the locale structure, values in English:

```json
{
  "address_book_ui": {
    "unnamed_contact": "Unnamed contact",
    "save_without_name": "Save without a registered name"
  }
}
```

```bash
python3 .agents/skills/i18n/i18n_add_keys.py /tmp/new-keys.json --dry-run
python3 .agents/skills/i18n/i18n_add_keys.py /tmp/new-keys.json
```

It never overwrites an existing value, so it is safe to re-run as the patch grows,
and it appends into the owning block in every locale. Nest by topic; match the casing
convention of the block you are extending.

At this point all 11 locales hold English. That is a deliberate, temporary state — it
keeps the key set complete so nothing falls back mid-task. Keep the list of keys you
added; step 4 needs it.

### 3. Migrate the components

Replace the literals with `t()` calls. Do not stop to translate — that fragments the
work and produces inconsistent wording across a feature.

### 4. Translate, in one batch, at the end

**Every value must be written in the language of its folder.** `de/core.json` holds
German, `ja/core.json` Japanese, `ar/core.json` Arabic. English sitting in a
non-English locale is an unfinished key, not a valid placeholder.

Translate the whole set in one pass, language by language — that is what keeps
terminology consistent. Write them as language → dotted key → value:

```json
{
  "de": { "address_book_ui.unnamed_contact": "Unbenannter Kontakt" },
  "fr": { "address_book_ui.unnamed_contact": "Contact sans nom" }
}
```

```bash
python3 .agents/skills/i18n/i18n_apply_translations.py /tmp/translations.json
```

It aborts before writing anything if a value drops or renames a `{{placeholder}}`, is
empty, or names a key that does not exist. Casing is not checked. The Hub's
`namespace → language → key` form is accepted too.

#### Translation rules

- Casing follows the English source's style for that key. Do not force lowercase on
  languages that capitalize by rule — German nouns, for instance.
- Preserve every `{{placeholder}}` name exactly; reorder them freely within the
  sentence. Both `{{ hash }}` and `{{coinType}}` spacing styles exist — copy the
  spacing of the `en` value.
- Leave proper nouns and protocol terms untranslated: `Qortal`, `QORT`, `QDN`,
  `Q-App`, `Q-Wallets`, and every coin name/ticker (`Bitcoin`, `BTC`, `Pirate Chain`,
  `ARRR`, …). The `coins.*` block is intentionally identical in all locales.
- `ar` is right-to-left; write natural Arabic and let the UI handle direction.
- For `ja` and `zh`, do not copy the English inter-word spacing.
- Match the register of neighbouring keys in that file rather than translating word
  for word — check a sibling key before inventing a term.

### 5. Verify

```bash
python3 .agents/skills/i18n/i18n_apply_translations.py --audit
python3 .agents/skills/i18n/i18n_apply_translations.py --audit --keys a.b,c.d
```

The audit reports two different things:

- **Key-set problems** (a key missing from a locale, or present in a locale but not
  in `en`) — always defects, and they set the exit code.
- **Values identical to English** — warnings. Proper nouns and genuine cognates
  legitimately match, so read them; do not auto-"fix" them.

`--keys` narrows it to just the keys you added, which is the useful form while the
pre-existing findings below are still outstanding.

Locale JSON is Prettier-formatted like the rest of the repo. The scripts already
write in that exact style, but confirm:

```bash
npx prettier --check src/i18n/locales
```

## Interpolation

```tsx
t('core:address_book_note_max_length', {
  max_note: ADDRESSBOOK_NOTE_LENGTH,
  postProcess: 'capitalizeFirstChar',
});
```

Never concatenate translated fragments to build a sentence — word order differs
across languages. Put the whole sentence in one key with placeholders.

## Tests

Component tests mock `react-i18next` so `t` returns the key itself; assertions match
on `core:...` strings (`screen.getByLabelText(/core:address_book_name/)`). When you
rename a key, the tests reference the key, not the English text.

The mocked `t` **must have a stable identity across renders** (define it outside the
`vi.mock` factory). An inline `t: (k) => k` makes every `t`-dependent effect re-run
forever and hangs the test run with no output. See the testing section of
[AGENTS.md](../../../AGENTS.md).

## Known gaps — do not imitate the neighbours

`i18n_scan_hardcoded.py` reports ~46 candidates across 15 files today. The confirmed
ones:

- **`WalletAddressBookPanel`** in
  [src/components/WalletWorkspace/index.tsx](../../../src/components/WalletWorkspace/index.tsx)
  is largely untranslated: `'No matching contacts found'`,
  `'Try a different name, address or note.'`, `'Copy address'`,
  `aria-label="copy address"`, `'Could not save contact.'`, plus template literals
  (`` `No ${visual.symbol} contacts yet` ``) the scanner cannot see.
- **English thrown from utils.** `addressBookStorage.ts` throws
  `Name must be 50 characters or less`, `Note must be …` and
  `Address already exists in the address book`; only the last is mapped to a key by
  the dialog.
- **Orphan key `message.generic.welcome`** exists in `ja`, `pt`, `ru` and `zh` but
  not in `en`, so it is unreachable — and it makes a repo-wide `--audit` exit 1
  today. Pre-existing; don't propagate it, and don't let it mask your own errors
  (use `--keys`).
- **Untranslated leftovers**, e.g. `ja` still holds English for
  `message.generic.no_address`, `message.generic.no_transactions`,
  `message.error.loading_address`, `message.error.loading_balance`; `fr` has 11.

"Match the surrounding code" does not apply to these. Use `t()` for the lines you
touch, and mention any remaining hardcoded strings you noticed rather than silently
leaving them.

## Before you finish

```bash
python3 .agents/skills/i18n/i18n_scan_hardcoded.py --detail <file>      # nothing user-readable left
python3 .agents/skills/i18n/i18n_apply_translations.py --audit --keys <your,new,keys>
npx prettier --check src/i18n/locales
npx tsc -b && npx eslint <changed files>
npx vitest run <affected dirs>
```

The task is not done while any non-English locale still holds English for a key you
introduced, or any string a user can read is still an English literal in `.tsx`.
