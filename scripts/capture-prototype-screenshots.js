const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const artifactDir = path.resolve('C:/Users/SHAFIULLA/.gemini/antigravity/brain/80371539-139e-4166-ad27-13b72eca1cc0');
const uiDir = path.resolve('student-enrollment-ui');
const port = 3021;
const cdpPort = 9228;

// Simple static file server for prototype
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(uiDir, reqPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, '127.0.0.1', async () => {
  console.log(`Prototype server running at http://127.0.0.1:${port}`);
  await runBrowserCapture();
});

async function runBrowserCapture() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProcess = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);

  try {
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

    const pagesToCapture = [
      { name: 'home', url: `http://127.0.0.1:${port}/index.html` },
      { name: 'courses', url: `http://127.0.0.1:${port}/courses.html` },
      { name: 'course_detail', url: `http://127.0.0.1:${port}/course-details.html?id=course-bib-101` },
      { name: 'registration', url: `http://127.0.0.1:${port}/registration.html` },
      { name: 'cart', url: `http://127.0.0.1:${port}/cart.html` },
      { name: 'checkout', url: `http://127.0.0.1:${port}/checkout.html` },
      { name: 'order_review', url: `http://127.0.0.1:${port}/order-review.html` },
      { name: 'payment_result', url: `http://127.0.0.1:${port}/payment-result.html?status=success&ref=BEREA-2026-89472` },
      { name: 'student_login', url: `http://127.0.0.1:${port}/student-login.html` },
      { name: 'student_dashboard', url: `http://127.0.0.1:${port}/student-dashboard.html` },
    ];

    for (const page of pagesToCapture) {
      console.log(`Capturing: ${page.name}...`);

      // 1. Desktop: 1440x1050
      await sendCommand('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 1050,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await sendCommand('Page.navigate', { url: page.url });
      await new Promise((r) => setTimeout(r, 2000));
      const desktopShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
      const desktopFile = path.join(artifactDir, `desktop_proto_${page.name}.png`);
      fs.writeFileSync(desktopFile, Buffer.from(desktopShot.data, 'base64'));
      console.log(`  Saved desktop_proto_${page.name}.png:`, fs.statSync(desktopFile).size, 'bytes');

      // 2. Mobile: 390x844
      await sendCommand('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true,
      });
      await sendCommand('Page.navigate', { url: page.url });
      await new Promise((r) => setTimeout(r, 1800));
      const mobileShot = await sendCommand('Page.captureScreenshot', { format: 'png' });
      const mobileFile = path.join(artifactDir, `mobile_proto_${page.name}.png`);
      fs.writeFileSync(mobileFile, Buffer.from(mobileShot.data, 'base64'));
      console.log(`  Saved mobile_proto_${page.name}.png:`, fs.statSync(mobileFile).size, 'bytes');
    }

    ws.close();
    console.log('\nAll prototype screenshots successfully captured!');
  } catch (err) {
    console.error('Error during screenshot capture:', err);
  } finally {
    chromeProcess.kill();
    server.close();
    process.exit(0);
  }
}

