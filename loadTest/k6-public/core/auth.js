import http from 'k6/http';

import { API, jsonHeaders } from './config.js';
import { getJson } from './helpers.js';

const ACCESS_COOKIE_NAME = 'gw_auth';

function getCookieValue(response, name) {
  return response.cookies?.[name]?.[0]?.value || '';
}

export function login(email, password) {
  if (!email || !password) {
    return '';
  }

  const response = http.post(
    `${API}/api/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: jsonHeaders,
      tags: { name: 'POST /api/auth/login' },
    }
  );

  const body = getJson(response, {});
  return (
    getCookieValue(response, ACCESS_COOKIE_NAME) ||
    body?.accessToken ||
    body?.token ||
    body?.data?.accessToken ||
    body?.data?.token ||
    ''
  );
}

export function requireLogin(roleLabel, email, password) {
  const token = login(email, password);

  if (!token) {
    throw new Error(`Login failed for ${roleLabel}${email ? ` (${email})` : ''}`);
  }

  return token;
}
