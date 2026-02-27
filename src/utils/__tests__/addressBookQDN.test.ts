import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncAllAddressBooksOnStartup } from '../addressBookQDN';
import type { AddressBookEntry } from '../Types';

// Override the global qapp-core mock (from setup.ts) to include the functions
// used by addressBookQDN.ts that are absent from the baseline mock.
vi.mock('qapp-core', () => ({
  Coin: {
    BTC: 'BTC',
    DOGE: 'DOGE',
    LTC: 'LTC',
    RVN: 'RVN',
    DGB: 'DGB',
    QORT: 'QORT',
    ARRR: 'ARRR',
  },
  objectToBase64: vi.fn().mockResolvedValue('mock-base64'),
  base64ToObject: vi.fn(),
  useGlobal: vi.fn(() => [null, vi.fn()]),
  RequestQueueWithPromise: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTRY_ALICE: AddressBookEntry = {
  id: 'entry-alice',
  name: 'Alice',
  address: 'Qj9aLrdK2FLQY6YssRQUkDmXNJCko2zF7e',
  note: '',
  coinType: 'QORT' as any,
  createdAt: 1000,
};

const ENTRY_BOB: AddressBookEntry = {
  id: 'entry-bob',
  name: 'Bob',
  address: 'Qj9aLrdK2FLQY6YssRQUkDmXNJCko2zABC',
  note: '',
  coinType: 'QORT' as any,
  createdAt: 2000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'q-wallets-addressbook-QORT';

function setLocalStorage(
  entries: AddressBookEntry[],
  lastUpdated: number,
  coinType = 'QORT'
) {
  localStorage.setItem(
    `q-wallets-addressbook-${coinType}`,
    JSON.stringify({ entries, lastUpdated })
  );
}

function getStoredData(coinType = 'QORT') {
  const raw = localStorage.getItem(`q-wallets-addressbook-${coinType}`);
  return raw ? JSON.parse(raw) : null;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('syncAllAddressBooksOnStartup', () => {
  let mockQortalRequest: ReturnType<typeof vi.fn>;

  // The QDN data returned by DECRYPT_DATA for QORT (null = 404 / no resource).
  let qdnDataForQort: Record<string, unknown> | null;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    qdnDataForQort = null;

    // qortalRequest is a Qortal-provided global; simulate it here.
    mockQortalRequest = vi.fn(async (request: Record<string, unknown>) => {
      switch (request.action) {
        case 'GET_USER_ACCOUNT':
          return { name: 'TestUser' };

        case 'FETCH_QDN_RESOURCE':
          // Return mock encrypted data only when QDN data has been set for QORT.
          if (
            request.identifier === STORAGE_KEY &&
            qdnDataForQort !== null
          ) {
            return 'mock-encrypted-data';
          }
          // Simulate "resource not found" for every other coin / unset QORT.
          throw { error: 1401, message: '404 Not Found' };

        case 'DECRYPT_DATA':
          // Return the QDN object directly; fetchFromQDN handles the
          // `typeof === 'object' && .entries` shortcut path.
          return qdnDataForQort;

        case 'ENCRYPT_DATA':
          return 'mock-encrypted-publish-data';

        case 'PUBLISH_QDN_RESOURCE':
          return { success: true };

        default:
          throw new Error(`Unexpected qortalRequest action: ${request.action}`);
      }
    });

    (global as any).qortalRequest = mockQortalRequest;
  });

  afterEach(() => {
    delete (global as any).qortalRequest;
  });

  // Predicate: was PUBLISH_QDN_RESOURCE called for the QORT address book?
  const wasQortPublished = () =>
    mockQortalRequest.mock.calls.some(
      ([req]) =>
        req.action === 'PUBLISH_QDN_RESOURCE' &&
        req.identifier === STORAGE_KEY
    );

  // -------------------------------------------------------------------------
  // BUG FIX: skip publish when timestamps diverge but content is unchanged
  // -------------------------------------------------------------------------

  describe('BUG FIX — local timestamp newer than QDN, same content → no publish', () => {
    it('does NOT trigger the permission dialog when content is identical', async () => {
      // Local is 3000, QDN is 1000, but both carry the same entry.
      setLocalStorage([ENTRY_ALICE], 3000);
      qdnDataForQort = { entries: [ENTRY_ALICE], lastUpdated: 1000 };

      await syncAllAddressBooksOnStartup('TestUser');

      expect(wasQortPublished()).toBe(false);
    });

    it('re-aligns the local timestamp to the QDN timestamp to prevent repeat divergence', async () => {
      setLocalStorage([ENTRY_ALICE], 3000);
      qdnDataForQort = { entries: [ENTRY_ALICE], lastUpdated: 1000 };

      await syncAllAddressBooksOnStartup('TestUser');

      // Local timestamp must now match QDN so future logins see equal timestamps.
      expect(getStoredData().lastUpdated).toBe(1000);
    });

    it('preserves the existing local entries during re-alignment', async () => {
      setLocalStorage([ENTRY_ALICE], 3000);
      qdnDataForQort = { entries: [ENTRY_ALICE], lastUpdated: 1000 };

      await syncAllAddressBooksOnStartup('TestUser');

      const stored = getStoredData();
      expect(stored.entries).toHaveLength(1);
      expect(stored.entries[0].id).toBe(ENTRY_ALICE.id);
    });

    it('still works when QDN data has no pre-computed hash field', async () => {
      // Regression: the code must fall back to computing the hash from
      // qdnData.entries when qdnData.hash is absent.
      setLocalStorage([ENTRY_ALICE], 5000);
      qdnDataForQort = { entries: [ENTRY_ALICE], lastUpdated: 2000 };
      // Deliberately omitting the `hash` field.

      await syncAllAddressBooksOnStartup('TestUser');

      expect(wasQortPublished()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // BUG FIX: publish AND sync local timestamp when content genuinely differs
  // -------------------------------------------------------------------------

  describe('BUG FIX — local timestamp newer than QDN, different content → publish', () => {
    it('publishes when local has entries that are not present in QDN', async () => {
      setLocalStorage([ENTRY_BOB], 3000);
      qdnDataForQort = { entries: [ENTRY_ALICE], lastUpdated: 1000 };

      await syncAllAddressBooksOnStartup('TestUser');

      expect(wasQortPublished()).toBe(true);
    });

    it('updates the local timestamp after a startup-triggered publish', async () => {
      setLocalStorage([ENTRY_BOB], 3000);
      qdnDataForQort = { entries: [ENTRY_ALICE], lastUpdated: 1000 };

      const before = Date.now();
      await syncAllAddressBooksOnStartup('TestUser');
      const after = Date.now();

      // The local timestamp must be advanced to ~publishedAt so the next login
      // sees equal timestamps and goes straight to the hash-comparison path.
      const newTimestamp = getStoredData().lastUpdated;
      expect(newTimestamp).toBeGreaterThanOrEqual(before);
      expect(newTimestamp).toBeLessThanOrEqual(after);
    });
  });

  // -------------------------------------------------------------------------
  // Existing behaviour: QDN is newer
  // -------------------------------------------------------------------------

  describe('QDN timestamp newer than local → update localStorage, no publish', () => {
    it('does not publish', async () => {
      setLocalStorage([ENTRY_ALICE], 1000);
      qdnDataForQort = { entries: [ENTRY_ALICE], lastUpdated: 5000 };

      await syncAllAddressBooksOnStartup('TestUser');

      expect(wasQortPublished()).toBe(false);
    });

    it('overwrites localStorage with the QDN timestamp', async () => {
      setLocalStorage([ENTRY_ALICE], 1000);
      qdnDataForQort = { entries: [ENTRY_ALICE], lastUpdated: 5000 };

      await syncAllAddressBooksOnStartup('TestUser');

      expect(getStoredData().lastUpdated).toBe(5000);
    });

    it('overwrites localStorage with the QDN entries', async () => {
      setLocalStorage([ENTRY_ALICE], 1000);
      qdnDataForQort = { entries: [ENTRY_ALICE, ENTRY_BOB], lastUpdated: 5000 };

      await syncAllAddressBooksOnStartup('TestUser');

      const stored = getStoredData();
      expect(stored.entries).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Existing behaviour: timestamps are equal
  // -------------------------------------------------------------------------

  describe('Equal timestamps → hash-based decision', () => {
    it('does not publish when hash matches (content unchanged)', async () => {
      setLocalStorage([ENTRY_ALICE], 3000);
      // Same entries → same computed hash.
      qdnDataForQort = { entries: [ENTRY_ALICE], lastUpdated: 3000 };

      await syncAllAddressBooksOnStartup('TestUser');

      expect(wasQortPublished()).toBe(false);
    });

    it('updates localStorage from QDN when stored hash does not match local content', async () => {
      setLocalStorage([ENTRY_ALICE], 3000);
      // QDN carries ENTRY_BOB with a hash value that cannot match ENTRY_ALICE.
      qdnDataForQort = {
        entries: [ENTRY_BOB],
        lastUpdated: 3000,
        hash: 'intentionally-wrong-hash',
      };

      await syncAllAddressBooksOnStartup('TestUser');

      // No publish — QDN data is authoritative when timestamps are equal.
      expect(wasQortPublished()).toBe(false);
      // Local must be updated with QDN's entries.
      const stored = getStoredData();
      expect(stored.entries[0].id).toBe(ENTRY_BOB.id);
    });
  });

  // -------------------------------------------------------------------------
  // Existing behaviour: no QDN data
  // -------------------------------------------------------------------------

  describe('No QDN data exists', () => {
    it('publishes local entries so they are backed up to QDN', async () => {
      setLocalStorage([ENTRY_ALICE], 1000);
      // qdnDataForQort stays null → FETCH_QDN_RESOURCE throws 404.

      await syncAllAddressBooksOnStartup('TestUser');

      expect(wasQortPublished()).toBe(true);
    });

    it('does not publish when there are no local entries either', async () => {
      // Both local and QDN are empty → nothing to publish.
      await syncAllAddressBooksOnStartup('TestUser');

      expect(wasQortPublished()).toBe(false);
    });
  });
});
