'use strict';

// Backstage Technician Desk host server.
// Uses only Node.js built-ins; no npm install is required.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const APP_DIR = __dirname;
const DATA_DIR = path.resolve(process.env.THEATRE_DATA_DIR || path.join(APP_DIR, 'data'));
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const STATE_FILE = path.join(DATA_DIR, 'event-state.json');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const ACCESS_PASSWORD = process.env.THEATRE_PASSWORD || '';
const ALLOWED_ORIGINS = new Set((process.env.THEATRE_ALLOWED_ORIGINS || '')
  .split(',').map((origin) => origin.trim()).filter(Boolean));
const MAX_BODY_BYTES = 5 * 1024 * 1024;

function isLoopbackHost(host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

if (!isLoopbackHost(HOST) && ACCESS_PASSWORD.length < 12) {
  console.error('\nRefusing to expose Backstage to the network without a password of at least 12 characters.');
  console.error('Set THEATRE_PASSWORD to a strong, private password and start the server again.\n');
  process.exit(1);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(value));
}

function readCurrentState() {
  if (!fs.existsSync(STATE_FILE)) return null;
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function safeName(value) {
  return String(value || 'theatre-event')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'theatre-event';
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function writeJsonAtomically(destination, value) {
  const temporaryFile = `${destination}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryFile, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporaryFile, destination);
}

function archiveBeforeSaving(previousState, nextState) {
  if (!previousState) return;

  // Save one snapshot per calendar day before the first update that day.
  const date = new Date().toISOString().slice(0, 10);
  const dailyFile = path.join(BACKUP_DIR, `daily-${date}.json`);
  if (!fs.existsSync(dailyFile)) {
    writeJsonAtomically(dailyFile, previousState);
  }

  // Preserve the last event automatically when the operator starts another one.
  if (previousState.eventId && nextState.eventId && previousState.eventId !== nextState.eventId) {
    const eventName = safeName(previousState.event && previousState.event.name);
    const eventDate = safeName((previousState.event && previousState.event.date) || date);
    const archiveName = `${eventName}-${eventDate}-${timestampForFile()}.json`;
    writeJsonAtomically(path.join(BACKUP_DIR, archiveName), previousState);
  }
}

function isValidState(value) {
  return Boolean(
    value && value.version === 1 && value.event &&
    Array.isArray(value.handoffs) && Array.isArray(value.incidents) &&
    typeof value.checks === 'object' && value.checks !== null
  );
}

function passwordIsValid(provided) {
  if (!ACCESS_PASSWORD) return true;
  if (typeof provided !== 'string') return false;
  const expected = Buffer.from(ACCESS_PASSWORD);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let byteCount = 0;
    const chunks = [];

    request.on('data', (chunk) => {
      byteCount += chunk.length;
      if (byteCount > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body exceeds 5 MB.'), { statusCode: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (_) {
        reject(Object.assign(new Error('Request body must be valid JSON.'), { statusCode: 400 }));
      }
    });
    request.on('error', reject);
  });
}

const publicFiles = new Map([
  ['/', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/index.html', { file: 'index.html', type: 'text/html; charset=utf-8' }],
  ['/styles.css', { file: 'styles.css', type: 'text/css; charset=utf-8' }],
  ['/app.js', { file: 'app.js', type: 'text/javascript; charset=utf-8' }],
]);

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = requestUrl.pathname;

  if (pathname.startsWith('/api/')) {
    const origin = request.headers.origin || '';
    const originAllowed = Boolean(origin && ALLOWED_ORIGINS.has(origin));

    // Allow cross-origin access only from explicitly configured frontend origins.
    // The API remains unauthenticated by CORS alone; the shared password is still checked below.
    if (originAllowed) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Vary', 'Origin');
    }

    if (request.method === 'OPTIONS') {
      if (!originAllowed) {
        sendJson(response, 403, { error: 'This website origin is not allowed to use the theatre API.' });
        return;
      }
      const preflightHeaders = {
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Theatre-Password',
        'Access-Control-Max-Age': '600',
        'Cache-Control': 'no-store',
      };
      // Some Chromium browsers may request explicit permission for tailnet/private-network APIs.
      if (request.headers['access-control-request-private-network'] === 'true') {
        preflightHeaders['Access-Control-Allow-Private-Network'] = 'true';
      }
      response.writeHead(204, preflightHeaders);
      response.end();
      return;
    }

    if (!passwordIsValid(request.headers['x-theatre-password'])) {
      sendJson(response, 401, { error: 'Incorrect or missing theatre access password.' });
      return;
    }

    if (pathname === '/api/health' && request.method === 'GET') {
      sendJson(response, 200, { ok: true, storage: 'host-file', timestamp: Date.now() });
      return;
    }

    if (pathname === '/api/state' && request.method === 'GET') {
      try {
        sendJson(response, 200, readCurrentState());
      } catch (error) {
        console.error('Could not read the saved event file:', error);
        sendJson(response, 500, { error: 'Could not read the saved event data on the host.' });
      }
      return;
    }

    if (pathname === '/api/state' && request.method === 'PUT') {
      try {
        const nextState = await readRequestBody(request);
        if (!isValidState(nextState)) {
          sendJson(response, 400, { error: 'The submitted event record is not valid.' });
          return;
        }

        const previousState = readCurrentState();
        archiveBeforeSaving(previousState, nextState);
        writeJsonAtomically(STATE_FILE, nextState);
        sendJson(response, 200, { ok: true, savedAt: Date.now() });
      } catch (error) {
        const statusCode = error.statusCode || 500;
        console.error('Could not save event state:', error);
        sendJson(response, statusCode, { error: statusCode === 500 ? 'Could not save event data to the host.' : error.message });
      }
      return;
    }

    sendJson(response, 404, { error: 'API endpoint not found.' });
    return;
  }

  const publicFile = publicFiles.get(pathname);
  if (!publicFile || (request.method !== 'GET' && request.method !== 'HEAD')) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('Not found');
    return;
  }

  const filePath = path.join(APP_DIR, publicFile.file);
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Could not read app file. Check that all project files are present.');
      return;
    }
    response.writeHead(200, {
      'Content-Type': publicFile.type,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; connect-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
    });
    if (request.method === 'HEAD') response.end();
    else response.end(content);
  });
});

server.listen(PORT, HOST, () => {
  console.log('\nBackstage Technician Desk is running.');
  console.log(`This computer: http://localhost:${PORT}`);
  console.log(`Listening on:  ${HOST}:${PORT}`);
  console.log(`Data file:     ${STATE_FILE}`);
  console.log(`Backups:       ${BACKUP_DIR}`);
  if (isLoopbackHost(HOST)) {
    console.log('Mode:          This computer only');
    console.log('For LAN access, set HOST=0.0.0.0 and THEATRE_PASSWORD to a private password (12+ characters).');
    console.log('For a GitHub Pages frontend, set THEATRE_ALLOWED_ORIGINS to its exact HTTPS origin.');
  } else {
    console.log('Mode:          Local network (password required)');
    console.log('Other crew devices should use this computer’s local network IP and port.');
    console.log('Do not port-forward this server or expose it directly to the public internet.');
    if (ALLOWED_ORIGINS.size) console.log(`Allowed browser origins: ${[...ALLOWED_ORIGINS].join(', ')}`);
  }
  console.log('\nPress Ctrl+C to stop the server.\n');
});

server.on('error', (error) => {
  console.error(`Could not start server: ${error.message}`);
  if (error.code === 'EADDRINUSE') console.error(`Port ${PORT} is already in use. Set PORT to another number and try again.`);
  process.exitCode = 1;
});
