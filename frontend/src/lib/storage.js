const KEY = "fantasy-ipl-auction-session";

export function loadSession() {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function saveSession(value) {
  window.localStorage.setItem(KEY, JSON.stringify(value));
}

export function clearSession() {
  window.localStorage.removeItem(KEY);
}
