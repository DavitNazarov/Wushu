export function rand(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function getJson(response, fallback = null) {
  try {
    return response.json();
  } catch {
    return fallback;
  }
}

export function toList(value) {
  return Array.isArray(value) ? value : value?.items || value?.data || [];
}

export function maybeId(item) {
  if (!item || typeof item !== 'object') {
    return '';
  }

  return item.id || item._id || '';
}

export function maybeSlug(item) {
  if (!item || typeof item !== 'object') {
    return '';
  }

  return item.slug || '';
}
