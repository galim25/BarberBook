// Browser-only helpers for iPhone/iPad quirks. Call only on the client.

export function isIos() {
  const ua = window.navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  // iPadOS 13+ Safari reports itself as desktop Mac; a real Mac has no touch points.
  return /macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1;
}

// iOS's own (non-standard) flag for "launched from the home screen".
export function isIosStandalone() {
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// Where the share button sits depends on the browser: Safari has it in the bottom
// toolbar (top on iPad), Chrome/Edge/Firefox for iOS put it in the address bar.
export function iosShareHint() {
  const ua = window.navigator.userAgent;
  if (/crios|edgios|fxios/i.test(ua)) {
    return 'להתקנת האפליקציה: הקישו על כפתור השיתוף בשורת הכתובת למעלה ואז "הוסף למסך הבית"';
  }
  return 'להתקנת האפליקציה: הקישו על כפתור השיתוף (ריבוע עם חץ למעלה) ואז "הוסף למסך הבית"';
}
