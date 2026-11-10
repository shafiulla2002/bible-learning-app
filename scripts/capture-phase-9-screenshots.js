const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');
const pg = require('pg');

const env = dotenv.parse(fs.readFileSync('apps/web/.env.local'));
const artifactDir = path.resolve('C:/Users/SHAFIULLA/.gemini/antigravity/brain/80371539-139e-4166-ad27-13b72eca1cc0');

function signJwt(payload, secret = env.JWT_SECRET) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${headerB64}.${payloadB64}`);
  const sig = hmac.digest('base64url');
  return `${headerB64}.${payloadB64}.${sig}`;
}

const teacherToken = signJwt({
  sub: 'a4a0f3b1-2466-45e6-9996-94837af05e6b', // Dr. John Mark
  role: 'TEACHER',
  instituteId: 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5',
});

async function resolveAssignedBatchId() {
  const dbUrl = (env.DATABASE_URL || '').replace(/\?sslmode=[^&]+&?/, '?').replace(/\?$/, '');
  const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    const res = await pool.query(
      `SELECT bt."batchId"
       FROM "BatchTeacher" bt
       JOIN "TeacherProfile" tp ON tp.id = bt."teacherProfileId"
       JOIN "Membership" m ON m.id = tp."membershipId"
       WHERE m."userId" = 'a4a0f3b1-2466-45e6-9996-94837af05e6b'
       LIMIT 1`
    );
    if (res.rows.length > 0) {
      return res.rows[0].batchId;
    }
    // Fallback to any batch in the institute
    const anyBatch = await pool.query(`SELECT id FROM "Batch" LIMIT 1`);
    return anyBatch.rows[0]?.id || '';
  } catch (err) {
    console.warn('Error resolving batch ID:', err.message);
    return '';
  } finally {
    await pool.end();
  }
}

const port = 3019;
console.log('Starting Next.js server on port', port);
const nextServer = spawn('node', ['../../node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: path.resolve('apps/web'),
  stdio: 'inherit',
  env: { ...process.env, PORT: String(port) },
});

function waitForServer(retries = 30) {
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/teacher/batches`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 304) resolve();
        else setTimeout(retry, 500);
      });
      req.on('error', () => setTimeout(retry, 500));
    };
    const retry = () => {
      retries--;
      if (retries > 0) check();
      else reject(new Error('Server did not start'));
    };
    check();
  });
}

async function run() {
  let chromeProcess = null;
  try {
    const batchId = await resolveAssignedBatchId();
    console.log('Resolved assigned batch ID:', batchId);

    await waitForServer();
    console.log('Next.js server ready!');

    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const cdpPort = 9227;
    chromeProcess = spawn(chromePath, [
      '--headless=new',
      `--remote-debugging-port=${cdpPort}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ]);

    // Wait for CDP port
    await new Promise((r) => setTimeout(r, 1500));

    // Get page WebSocket URL
    const newPageRes = await new Promise((resolve, reject) => {
      const req = http.request(`http://127.0.0.1:${cdpPort}/json/new`, { method: 'PUT' }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.end();
    });

    const pageWsUrl = newPageRes.webSocketDebuggerUrl;
    console.log('Page WebSocket URL:', pageWsUrl);

    const ws = new WebSocket(pageWsUrl);
    await new Promise((r) => (ws.onopen = r));

    let id = 1;
    function sendCommand(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = id++;
        const handler = (evt) => {
          const res = JSON.parse(evt.data);
          if (res.id === msgId) {
            ws.removeEventListener('message', handler);
            if (res.error) reject(res.error);
            else resolve(res.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    // Set auth cookie
    await sendCommand('Network.setCookie', {
      name: 'auth_token',
      value: teacherToken,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: false,
    });

    // ──────────────────────────────────────────────────────────
    // 1. TEACHER BATCHES DIRECTORY (Desktop: 1440x1050)
    // ──────────────────────────────────────────────────────────
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sendCommand('Page.navigate', { url: `http://127.0.0.1:${port}/teacher/batches` });
    await new Promise((r) => setTimeout(r, 3000));
    const dBatchesShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const dBatchesFile = path.join(artifactDir, 'desktop_teacher_batches.png');
    fs.writeFileSync(dBatchesFile, Buffer.from(dBatchesShot.data, 'base64'));
    console.log('Saved desktop_teacher_batches.png:', fs.statSync(dBatchesFile).size, 'bytes');

    // ──────────────────────────────────────────────────────────
    // 2. TEACHER BATCHES DIRECTORY (Mobile: 390x844)
    // ──────────────────────────────────────────────────────────
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sendCommand('Page.navigate', { url: `http://127.0.0.1:${port}/teacher/batches` });
    await new Promise((r) => setTimeout(r, 2500));
    const mBatchesShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const mBatchesFile = path.join(artifactDir, 'mobile_teacher_batches.png');
    fs.writeFileSync(mBatchesFile, Buffer.from(mBatchesShot.data, 'base64'));
    console.log('Saved mobile_teacher_batches.png:', fs.statSync(mBatchesFile).size, 'bytes');

    // ──────────────────────────────────────────────────────────
    // 3. COHORT DETAILS (Desktop: 1440x1050)
    // ──────────────────────────────────────────────────────────
    if (batchId) {
      await sendCommand('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 1050,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await sendCommand('Page.navigate', { url: `http://127.0.0.1:${port}/teacher/batches/${batchId}` });
      await new Promise((r) => setTimeout(r, 3000));
      const dDetailShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
      const dDetailFile = path.join(artifactDir, 'desktop_teacher_batch_detail.png');
      fs.writeFileSync(dDetailFile, Buffer.from(dDetailShot.data, 'base64'));
      console.log('Saved desktop_teacher_batch_detail.png:', fs.statSync(dDetailFile).size, 'bytes');

      // ──────────────────────────────────────────────────────────
      // 4. COHORT DETAILS (Mobile: 390x844)
      // ──────────────────────────────────────────────────────────
      await sendCommand('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await sendCommand('Page.navigate', { url: `http://127.0.0.1:${port}/teacher/batches/${batchId}` });
      await new Promise((r) => setTimeout(r, 2500));
      const mDetailShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
      const mDetailFile = path.join(artifactDir, 'mobile_teacher_batch_detail.png');
      fs.writeFileSync(mDetailFile, Buffer.from(mDetailShot.data, 'base64'));
      console.log('Saved mobile_teacher_batch_detail.png:', fs.statSync(mDetailFile).size, 'bytes');
    }

    // ──────────────────────────────────────────────────────────
    // 5. TEACHER PROFILE (Desktop: 1440x1050)
    // ──────────────────────────────────────────────────────────
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sendCommand('Page.navigate', { url: `http://127.0.0.1:${port}/teacher/profile` });
    await new Promise((r) => setTimeout(r, 3000));
    const dProfileShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const dProfileFile = path.join(artifactDir, 'desktop_teacher_profile.png');
    fs.writeFileSync(dProfileFile, Buffer.from(dProfileShot.data, 'base64'));
    console.log('Saved desktop_teacher_profile.png:', fs.statSync(dProfileFile).size, 'bytes');

    // ──────────────────────────────────────────────────────────
    // 6. TEACHER SETTINGS (Desktop: 1440x1050)
    // ──────────────────────────────────────────────────────────
    await sendCommand('Page.navigate', { url: `http://127.0.0.1:${port}/teacher/settings` });
    await new Promise((r) => setTimeout(r, 3000));
    const dSettingsShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const dSettingsFile = path.join(artifactDir, 'desktop_teacher_settings.png');
    fs.writeFileSync(dSettingsFile, Buffer.from(dSettingsShot.data, 'base64'));
    console.log('Saved desktop_teacher_settings.png:', fs.statSync(dSettingsFile).size, 'bytes');

    ws.close();
    console.log('\nAll Phase 9 screenshots successfully captured and saved to artifact directory!');
  } catch (err) {
    console.error('Screenshot capture error:', err);
  } finally {
    if (chromeProcess) chromeProcess.kill();
    nextServer.kill();
    process.exit(0);
  }
}

run();
