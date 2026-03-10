function parseEnvFile(contents) {
  const values = {};
  const lines = contents.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalizedLine = line.startsWith('export ')
      ? line.slice('export '.length).trim()
      : line;
    const separatorIndex = normalizedLine.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    let value = normalizedLine.slice(separatorIndex + 1).trim();

    if (!key) {
      continue;
    }

    const isWrappedInDoubleQuotes =
      value.startsWith('"') && value.endsWith('"');
    const isWrappedInSingleQuotes =
      value.startsWith("'") && value.endsWith("'");

    if (isWrappedInDoubleQuotes || isWrappedInSingleQuotes) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function loadFileEnv() {
  try {
    return parseEnvFile(open('./.env'));
  } catch {
    return {};
  }
}

function normalize(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return String(value);
}

const fileEnv = loadFileEnv();

export function readEnv(key, fallback = '') {
  if (Object.prototype.hasOwnProperty.call(__ENV, key)) {
    return String(__ENV[key]);
  }

  return normalize(fileEnv[key]) ?? fallback;
}
