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

const studentToken = signJwt({
  sub: '0b1dd816-4c77-4a7a-9837-22c3627d0bdc', // Shaik Shafiulla
  role: 'STUDENT',
  instituteId: 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5',
});

// Ensure realistic visual demo notifications exist in dev DB
async function seedVisualNotifications() {
  const dbUrl = (env.DATABASE_URL || '').replace(/\?sslmode=[^&]+&?/, '?').replace(/\?$/, '');
  const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  try {
    const instId = 'fef8c1d5-53d5-45ac-9f94-bb0be5cb39d5';
    const teacherUserId = 'a4a0f3b1-2466-45e6-9996-94837af05e6b';
    const studentUserId = '0b1dd816-4c77-4a7a-9837-22c3627d0bdc';

    // Check teacher notifications
    const tCount = await pool.query(
      `SELECT COUNT(*)::int as count FROM "Notification" WHERE "instituteId" = $1 AND "userId" = $2`,
      [instId, teacherUserId]
    );

    if (tCount.rows[0].count < 3) {
      await pool.query(
        `INSERT INTO "Notification" (id, "instituteId", "userId", title, body, link, "readAt", "createdAt")
         VALUES
         (gen_random_uuid()::text, $1, $2, 'New Student Submission: Pauline Epistles Essay', 'Shaik Shafiulla submitted their essay for Theological Analysis.', '/teacher/assignments#cat=ACADEMIC&evt=SUBMISSION_RECEIVED&ref=sub-01', NULL, NOW() - INTERVAL '15 minutes'),
         (gen_random_uuid()::text, $1, $2, 'Live Session Reminder: Hermeneutics Lecture', 'Your scheduled live class for Morning Batch begins in 30 minutes.', '/teacher/live-classes#cat=ACADEMIC&evt=LIVE_CLASS_REMINDER&ref=live-01', NULL, NOW() - INTERVAL '45 minutes'),
         (gen_random_uuid()::text, $1, $2, 'Attendance Review Required: Church History', '3 students marked absent in today''s morning session.', '/teacher/attendance#cat=ATTENDANCE&evt=ATTENDANCE_ALERT&ref=att-01', NULL, NOW() - INTERVAL '2 hours'),
         (gen_random_uuid()::text, $1, $2, 'Faculty Notice: Mid-Term Examination Schedule', 'The academic committee has published the Q2 examination guidelines.', '/teacher/notifications#cat=ADMIN&evt=ANNOUNCEMENT_POSTED&ref=ann-01', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day')
         ON CONFLICT DO NOTHING`,
        [instId, teacherUserId]
      );
    }

    // Check student notifications
    const sCount = await pool.query(
      `SELECT COUNT(*)::int as count FROM "Notification" WHERE "instituteId" = $1 AND "userId" = $2`,
      [instId, studentUserId]
    );

    if (sCount.rows[0].count < 3) {
      await pool.query(
        `INSERT INTO "Notification" (id, "instituteId", "userId", title, body, link, "readAt", "createdAt")
         VALUES
         (gen_random_uuid()::text, $1, $2, 'Live Class Scheduled: New Testament Greek Exegesis', 'Interactive live session scheduled for Wednesday at 10:00 AM.', '/student/classes#cat=ACADEMIC&evt=LIVE_CLASS_SCHEDULED&ref=live-st-01', NULL, NOW() - INTERVAL '20 minutes'),
         (gen_random_uuid()::text, $1, $2, 'Assignment Graded: Old Testament Survey Final Paper', 'Your paper was evaluated: 92/100 marks. Excellent exegesis!', '/student/assignments#cat=ACADEMIC&evt=ASSIGNMENT_GRADED&ref=asgn-st-01', NULL, NOW() - INTERVAL '1 hour'),
         (gen_random_uuid()::text, $1, $2, 'Online Examination Published: Systematic Theology', 'Mid-Term Examination is now open. Duration: 60 mins.', '/student/exams#cat=ACADEMIC&evt=EXAM_PUBLISHED&ref=exam-st-01', NULL, NOW() - INTERVAL '3 hours'),
         (gen_random_uuid()::text, $1, $2, 'Institute Announcement: Annual Convocation Dates', 'Registration is now open for the 2026 theological conferment ceremony.', '/student/notifications#cat=ADMIN&evt=ANNOUNCEMENT_POSTED&ref=ann-st-01', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')
         ON CONFLICT DO NOTHING`,
        [instId, studentUserId]
      );
    }
  } catch (err) {
    console.warn('Could not seed visual demo notifications (continuing):', err.message);
  } finally {
    await pool.end();
  }
}

const port = 3018;
console.log('Starting Next.js server on port', port);
const nextServer = spawn('node', ['../../node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'], {
  cwd: path.resolve('apps/web'),
  stdio: 'inherit',
  env: { ...process.env, PORT: String(port) },
});

function waitForServer(retries = 30) {
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/teacher/notifications`, (res) => {
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
    await seedVisualNotifications();
    await waitForServer();
    console.log('Next.js server ready!');

    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const cdpPort = 9226;
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

    // ──────────────────────────────────────────────────────────
    // 1. TEACHER NOTIFICATION CENTER (Desktop: 1440x1050)
    // ──────────────────────────────────────────────────────────
    await sendCommand('Network.setCookie', {
      name: 'auth_token',
      value: teacherToken,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: false,
    });

    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sendCommand('Page.navigate', { url: `http://127.0.0.1:${port}/teacher/notifications` });
    await new Promise((r) => setTimeout(r, 3000));
    const dTeacherShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const dTeacherFile = path.join(artifactDir, 'desktop_teacher_notifications.png');
    fs.writeFileSync(dTeacherFile, Buffer.from(dTeacherShot.data, 'base64'));
    console.log('Saved desktop_teacher_notifications.png:', fs.statSync(dTeacherFile).size, 'bytes');

    // ──────────────────────────────────────────────────────────
    // 2. TEACHER NOTIFICATION CENTER (Mobile: 390x844)
    // ──────────────────────────────────────────────────────────
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sendCommand('Page.navigate', { url: `http://127.0.0.1:${port}/teacher/notifications` });
    await new Promise((r) => setTimeout(r, 2500));
    const mTeacherShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const mTeacherFile = path.join(artifactDir, 'mobile_teacher_notifications.png');
    fs.writeFileSync(mTeacherFile, Buffer.from(mTeacherShot.data, 'base64'));
    console.log('Saved mobile_teacher_notifications.png:', fs.statSync(mTeacherFile).size, 'bytes');

    // ──────────────────────────────────────────────────────────
    // 3. STUDENT NOTIFICATION CENTER (Desktop: 1440x1050)
    // ──────────────────────────────────────────────────────────
    await sendCommand('Network.setCookie', {
      name: 'auth_token',
      value: studentToken,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: false,
    });

    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1050,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sendCommand('Page.navigate', { url: `http://127.0.0.1:${port}/student/notifications` });
    await new Promise((r) => setTimeout(r, 3000));
    const dStudentShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const dStudentFile = path.join(artifactDir, 'desktop_student_notifications.png');
    fs.writeFileSync(dStudentFile, Buffer.from(dStudentShot.data, 'base64'));
    console.log('Saved desktop_student_notifications.png:', fs.statSync(dStudentFile).size, 'bytes');

    // ──────────────────────────────────────────────────────────
    // 4. STUDENT NOTIFICATION CENTER (Mobile: 390x844)
    // ──────────────────────────────────────────────────────────
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sendCommand('Page.navigate', { url: `http://127.0.0.1:${port}/student/notifications` });
    await new Promise((r) => setTimeout(r, 2500));
    const mStudentShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const mStudentFile = path.join(artifactDir, 'mobile_student_notifications.png');
    fs.writeFileSync(mStudentFile, Buffer.from(mStudentShot.data, 'base64'));
    console.log('Saved mobile_student_notifications.png:', fs.statSync(mStudentFile).size, 'bytes');

    ws.close();
    console.log('\nAll 4 Phase 8 screenshots successfully captured and saved to artifact directory!');
  } catch (err) {
    console.error('Screenshot capture error:', err);
  } finally {
    if (chromeProcess) chromeProcess.kill();
    nextServer.kill();
    process.exit(0);
  }
}

run();
