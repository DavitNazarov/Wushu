import http from 'k6/http';
import { check } from 'k6';

import { API, jsonHeaders } from './config.js';
import { unexpectedFailRate } from './metrics.js';
import { STATUS_POLICIES } from './policies.js';

function pathFromUrl(url) {
  return url.replace(API, '');
}

function buildParams(token = '', tagName = '') {
  const params = {
    headers: token ? authHeaders(token) : { ...jsonHeaders },
    tags: {
      name: tagName,
    },
  };

  return params;
}

function isAllowedStatus(status, allowedStatuses) {
  return allowedStatuses.includes(status);
}

function logUnexpectedResponse(method, url, status, allowedStatuses) {
  console.error(
    `[k6] Unexpected response for ${method} ${pathFromUrl(url)}: ` +
      `status=${status}, allowed=[${allowedStatuses.join(', ')}]`
  );
}

export function authHeaders(token) {
  return token
    ? {
        ...jsonHeaders,
        Authorization: `Bearer ${token}`,
      }
    : { ...jsonHeaders };
}

export function request(
  method,
  url,
  { token = '', body = null, allowedStatuses = STATUS_POLICIES.authenticatedRead, tagName = '' } = {}
) {
  const resolvedTagName = tagName || `${method} ${pathFromUrl(url)}`;
  const params = buildParams(token, resolvedTagName);
  const requestBody =
    method === 'GET' || method === 'DELETE'
      ? null
      : body
        ? JSON.stringify(body)
        : '{}';
  const response = http.request(method, url, requestBody, params);
  const ok = isAllowedStatus(response.status, allowedStatuses);

  unexpectedFailRate.add(!ok);

  check(response, {
    [`${method} ${pathFromUrl(url)} status ok`]: () => ok,
  });

  if (!ok) {
    logUnexpectedResponse(method, url, response.status, allowedStatuses);
  }

  return response;
}

export function get(url, { token = '', tagName = '', allowedStatuses = STATUS_POLICIES.authenticatedRead } = {}) {
  const resolvedTagName = tagName || `GET ${pathFromUrl(url)}`;
  return request('GET', url, {
    token,
    tagName: resolvedTagName,
    allowedStatuses,
  });
}

export function req(
  method,
  url,
  token = '',
  body = null,
  allowedStatuses = STATUS_POLICIES.mutation,
  tagName = ''
) {
  return request(method, url, {
    token,
    body,
    allowedStatuses,
    tagName,
  });
}
