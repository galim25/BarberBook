/**
 * The server POSTs to whatever endpoint a subscription carries, so a customer
 * (not just the admin) registering one means the endpoint must be checked — an
 * arbitrary URL would make the server send requests to internal addresses.
 * Only the push services real browsers use are allowed: Chrome/Edge/Samsung/Opera
 * (FCM), Firefox (Mozilla autopush), Safari (Apple) and legacy Edge (WNS).
 */
const ALLOWED_PUSH_HOST_SUFFIXES = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
];

const MAX_ENDPOINT_LENGTH = 1024;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  if (endpoint.length > MAX_ENDPOINT_LENGTH) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  return ALLOWED_PUSH_HOST_SUFFIXES.some((suffix) => url.hostname === suffix || url.hostname.endsWith(`.${suffix}`));
}
