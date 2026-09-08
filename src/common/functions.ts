import { EMPTY_STRING, ONE_SPACE } from './constants';

export function epochToAgo(epoch: number) {
  const date = new Date(epoch);
  if (!Number.isFinite(epoch) || Number.isNaN(date.getTime())) {
    return '-';
  }

  const minute = 60000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const timeDifference = Math.max(0, Date.now() - epoch);

  if (timeDifference < minute) {
    return 'just now';
  }

  if (timeDifference < hour) {
    const minutes = Math.floor(timeDifference / minute);
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  if (timeDifference < day) {
    const hours = Math.floor(timeDifference / hour);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const dayOfMonth = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${dayOfMonth}/${month}/${year}`;
}

/**
 * Full timestamp in the same day-first order `epochToAgo` uses for older
 * entries (`DD/MM/YYYY HH:mm:ss`), so a row and its tooltip never disagree
 * about which number is the day and which is the month.
 */
export function epochToDateTime(epoch: number) {
  const date = new Date(epoch);
  if (!Number.isFinite(epoch) || Number.isNaN(date.getTime())) {
    return '-';
  }

  const dayOfMonth = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${dayOfMonth}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export function secondsToDhms(seconds: number) {
  seconds = Number(seconds);

  var d = Math.floor(seconds / (3600 * 24));
  var h = Math.floor((seconds % (3600 * 24)) / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  var s = Math.floor(seconds % 60);

  var dDisplay = d > 0 ? d + (d == 1 ? 'd ' : 'd ') : EMPTY_STRING;
  var hDisplay = h > 0 ? h + (h == 1 ? 'h ' : 'h ') : EMPTY_STRING;
  var mDisplay = m > 0 ? m + (m == 1 ? 'm ' : 'm ') : EMPTY_STRING;
  var sDisplay = s > 0 ? s + (s == 1 ? 's' : 's') : EMPTY_STRING;

  return dDisplay + hDisplay + mDisplay + sDisplay;
}

export function timeoutDelay(delay: number) {
  return new Promise((res) => setTimeout(res, delay));
}

export function cropString(str: string, max_length: number = 24) {
  let one_third: number = max_length / 3;
  return str.length > max_length
    ? str.substring(0, one_third) +
        '...' +
        str.substring(str.length - one_third)
    : str;
}

export function humanFileSize(
  bytes: number,
  si: boolean = false,
  dp: number = 1
): string {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return bytes.toFixed(dp) + ONE_SPACE + units[u];
}

export async function copyToClipboard(text: string): Promise<void> {
  // Try modern clipboard API first
  let processed: boolean = false;
  try {
    await navigator.clipboard.writeText(text);
    processed = true;
  } catch (error) {
    console.error(error);
  }
  if (processed) return;

  console.info('Using clipboard legacy fallback');

  // Fallback for older browsers or non-HTTPS contexts
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    if (!successful) {
      throw new Error('execCommand copy failed');
    }
  } catch (error) {
    console.error(error);
  } finally {
    document.body.removeChild(textArea);
  }
}
