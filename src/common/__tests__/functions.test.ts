import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  epochToAgo,
  epochToDateTime,
  secondsToDhms,
  cropString,
  humanFileSize,
} from '../functions';

describe('common/functions', () => {
  describe('epochToAgo', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    const freezeNow = (iso: string) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(iso));
    };

    it('returns "-" for non-finite or invalid input', () => {
      expect(epochToAgo(Number.NaN)).toBe('-');
      expect(epochToAgo(Number.POSITIVE_INFINITY)).toBe('-');
    });

    it('returns "just now" for less than a minute ago', () => {
      freezeNow('2026-06-06T12:00:00Z');
      expect(epochToAgo(Date.now() - 30_000)).toBe('just now');
    });

    it('clamps future timestamps to "just now"', () => {
      freezeNow('2026-06-06T12:00:00Z');
      expect(epochToAgo(Date.now() + 60_000)).toBe('just now');
    });

    it('uses singular/plural minutes correctly', () => {
      freezeNow('2026-06-06T12:00:00Z');
      expect(epochToAgo(Date.now() - 60_000)).toBe('1 minute ago');
      expect(epochToAgo(Date.now() - 5 * 60_000)).toBe('5 minutes ago');
    });

    it('reports hours within the same day', () => {
      freezeNow('2026-06-06T12:00:00Z');
      expect(epochToAgo(Date.now() - 60 * 60_000)).toBe('1 hour ago');
      expect(epochToAgo(Date.now() - 3 * 60 * 60_000)).toBe('3 hours ago');
    });

    it('formats dates older than a day as dd/mm/yy (local time)', () => {
      freezeNow('2026-06-06T12:00:00Z');
      const epoch = Date.now() - 5 * 24 * 60 * 60_000;
      const d = new Date(epoch);
      const expected = `${String(d.getDate()).padStart(2, '0')}/${String(
        d.getMonth() + 1
      ).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
      expect(epochToAgo(epoch)).toBe(expected);
    });
  });

  describe('epochToDateTime', () => {
    it('returns "-" for non-finite or invalid input', () => {
      expect(epochToDateTime(Number.NaN)).toBe('-');
      expect(epochToDateTime(Number.POSITIVE_INFINITY)).toBe('-');
    });

    it('formats as dd/mm/yyyy hh:mm:ss (local time)', () => {
      const epoch = new Date(2026, 8, 5, 7, 4, 3).getTime();
      expect(epochToDateTime(epoch)).toBe('05/09/2026 07:04:03');
    });

    it('agrees with epochToAgo about the day/month order', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 8, 20, 12, 0, 0));
      const epoch = new Date(2026, 8, 5, 7, 4, 3).getTime();
      expect(epochToAgo(epoch)).toBe('05/09/26');
      expect(epochToDateTime(epoch).startsWith('05/09/2026')).toBe(true);
      vi.useRealTimers();
    });
  });

  describe('secondsToDhms', () => {
    it('returns an empty string for zero', () => {
      expect(secondsToDhms(0)).toBe('');
    });

    it('formats minutes and seconds', () => {
      expect(secondsToDhms(90)).toBe('1m 30s');
    });

    it('formats hours, minutes and seconds', () => {
      expect(secondsToDhms(3661)).toBe('1h 1m 1s');
    });

    it('formats whole days (omitting zeroed lower units)', () => {
      expect(secondsToDhms(86_400)).toBe('1d ');
    });

    it('coerces string input via Number()', () => {
      expect(secondsToDhms('120' as unknown as number)).toBe('2m ');
    });
  });

  describe('cropString', () => {
    it('returns the string unchanged when within the limit', () => {
      expect(cropString('short')).toBe('short');
    });

    it('keeps the string when exactly at the limit', () => {
      const s = 'a'.repeat(24);
      expect(cropString(s)).toBe(s);
    });

    it('crops the middle of a long string with the default length', () => {
      const s = '1234567890ABCDEFGHIJ1234567890XYZ'; // length 33 > 24
      // one_third = 24 / 3 = 8
      expect(cropString(s)).toBe(
        `${s.substring(0, 8)}...${s.substring(s.length - 8)}`
      );
    });

    it('honours a custom max length', () => {
      const s = 'a'.repeat(40);
      expect(cropString(s, 12)).toBe(
        `${s.substring(0, 4)}...${s.substring(s.length - 4)}`
      );
    });
  });

  describe('humanFileSize', () => {
    it('reports raw bytes below the threshold', () => {
      expect(humanFileSize(0)).toBe('0 B');
      expect(humanFileSize(500)).toBe('500 B');
    });

    it('uses binary units by default', () => {
      expect(humanFileSize(1024)).toBe('1.0 KiB');
      expect(humanFileSize(1536)).toBe('1.5 KiB');
      expect(humanFileSize(1024 * 1024)).toBe('1.0 MiB');
    });

    it('uses SI units when si=true', () => {
      expect(humanFileSize(1000, true)).toBe('1.0 kB');
      expect(humanFileSize(1_000_000, true)).toBe('1.0 MB');
    });

    it('respects the decimal-places argument', () => {
      expect(humanFileSize(1536, false, 2)).toBe('1.50 KiB');
    });
  });
});
