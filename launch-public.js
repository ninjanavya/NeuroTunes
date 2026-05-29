const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('==================================================');
console.log('       NeuroTunes Public Tunnel Bootstrapper      ');
console.log('==================================================\n');

// Clear old logs
const logFiles = ['tunnel-backend.log', 'tunnel-ml.log', 'tunnel-frontend.log'];
logFiles.forEach(file => {
  if (fs.existsSync(file)) {
    try {
      fs.unlinkSync(file);
    } catch (e) {}
  }
});

console.log('[1/4] Starting Cloudflare Tunnels in background...');

const backendTunnel = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:5000'], { shell: true });
const mlTunnel = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:8000'], { shell: true });
const frontendTunnel = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:3000'], { shell: true });

const backendLog = fs.createWriteStream('tunnel-backend.log');
const mlLog = fs.createWriteStream('tunnel-ml.log');
const frontendLog = fs.createWriteStream('tunnel-frontend.log');

backendTunnel.stdout.pipe(backendLog);
backendTunnel.stderr.pipe(backendLog);
mlTunnel.stdout.pipe(mlLog);
mlTunnel.stderr.pipe(mlLog);
frontendTunnel.stdout.pipe(frontendLog);
frontendTunnel.stderr.pipe(frontendLog);

// Clean up processes on exit
const cleanup = () => {
  try { backendTunnel.kill(); } catch (e) {}
  try { mlTunnel.kill(); } catch (e) {}
  try { frontendTunnel.kill(); } catch (e) {}
};

process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit();
});

let backendUrl = null;
let mlUrl = null;
let frontendUrl = null;

function scanLogs() {
  if (!backendUrl && fs.existsSync('tunnel-backend.log')) {
    const data = fs.readFileSync('tunnel-backend.log', 'utf8');
    const match = data.match(/https:\/\/[a-z0-9.-]+\.trycloudflare\.com/);
    if (match) backendUrl = match[0];
  }
  if (!mlUrl && fs.existsSync('tunnel-ml.log')) {
    const data = fs.readFileSync('tunnel-ml.log', 'utf8');
    const match = data.match(/https:\/\/[a-z0-9.-]+\.trycloudflare\.com/);
    if (match) mlUrl = match[0];
  }
  if (!frontendUrl && fs.existsSync('tunnel-frontend.log')) {
    const data = fs.readFileSync('tunnel-frontend.log', 'utf8');
    const match = data.match(/https:\/\/[a-z0-9.-]+\.trycloudflare\.com/);
    if (match) frontendUrl = match[0];
  }

  if (backendUrl && mlUrl && frontendUrl) {
    console.log('[2/4] Cloudflare Tunnels online!');
    console.log(`      Frontend: ${frontendUrl}`);
    console.log(`      Backend:  ${backendUrl}`);
    console.log(`      ML:       ${mlUrl}\n`);
    updateEnvFiles();
  } else {
    setTimeout(scanLogs, 1000);
  }
}

console.log('[2/4] Waiting for public URLs to register...');
scanLogs();

function updateEnvFiles() {
  console.log('[3/4] Updating environment configuration files...');
  
  const envPath = path.resolve(__dirname, '.env');
  const frontendEnvPath = path.resolve(__dirname, 'frontend/.env.local');

  if (fs.existsSync(envPath)) {
    let content = fs.readFileSync(envPath, 'utf8');
    content = content.replace(/NEXT_PUBLIC_API_URL=.*/, `NEXT_PUBLIC_API_URL=${backendUrl}`);
    content = content.replace(/NEXT_PUBLIC_ML_URL=.*/, `NEXT_PUBLIC_ML_URL=${mlUrl}`);
    fs.writeFileSync(envPath, content, 'utf8');
  }

  if (fs.existsSync(frontendEnvPath)) {
    let content = fs.readFileSync(frontendEnvPath, 'utf8');
    content = content.replace(/NEXT_PUBLIC_API_URL=.*/, `NEXT_PUBLIC_API_URL=${backendUrl}`);
    content = content.replace(/NEXT_PUBLIC_ML_URL=.*/, `NEXT_PUBLIC_ML_URL=${mlUrl}`);
    fs.writeFileSync(frontendEnvPath, content, 'utf8');
  }

  console.log('[4/4] Starting local servers concurrently (Next.js, Node, FastAPI)...');
  console.log('\n----------------- PLATFORM LINKS -----------------');
  console.log(`👉 Open this URL on any device to test:`);
  console.log(`   \x1b[36m${frontendUrl}\x1b[0m`);
  console.log('--------------------------------------------------\n');
  console.log('Press Ctrl+C to shutdown tunnels and dev servers.\n');

  const devServer = spawn('npm', ['run', 'dev'], { shell: true, stdio: 'inherit' });
  
  devServer.on('close', () => {
    cleanup();
    process.exit();
  });
}
