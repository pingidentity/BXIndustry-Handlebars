// Small helper to fetch and cache a CSRF token for use on POST/PUT requests.
// The server issues the token (and the paired _csrf cookie) via GET /csrf-token.
// See @fastify/csrf-protection usage in routes/*.js.

let cachedTokenPromise = null;

export async function getCsrfToken() {
  if (!cachedTokenPromise) {
    cachedTokenPromise = fetch('/csrf-token')
      .then((response) => response.json())
      .then((data) => data.token);
  }

  return cachedTokenPromise;
}
