const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('==================================================');
console.log('          NeuroTunes LAN Sharing Bootstrapper     ');
console.log('==================================================\n');

// 1. Detect Local IP address
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      // Ignore loopback and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIp();
const backendUrl = `http://${localIp}:5000`;
const mlUrl = `http://${localIp}:8000`;
const frontendUrl = `http://${localIp}:3000`;

console.log(`[1/3] Detected Local IP Address: ${localIp}`);

// 2. Update Env Files
console.log('[2/3] Updating environment configuration files for LAN access...');
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

// 3. Launch Servers bound to 0.0.0.0
console.log('[3/3] Launching servers bound to 0.0.0.0 (all network interfaces)...');
console.log('\n----------------- LAN ACCESS LINKS -----------------');
console.log(`👉 Open this URL on any device connected to your Wi-Fi:`);
console.log(`   \x1b[32m${frontendUrl}\x1b[0m`);
console.log('----------------------------------------------------\n');

// Spawn backend, frontend, and ML directly with custom hosts
const backend = spawn('npm', ['run', 'dev', '--prefix', 'backend-node'], { shell: true, stdio: 'inherit' });
const frontend = spawn('npx', ['next', 'dev', '-H', '0.0.0.0', '-p', '3000'], { cwd: path.resolve(__dirname, 'frontend'), shell: true, stdio: 'inherit' });

// Spawn ML with host 0.0.0.0
const mlPath = path.resolve(__dirname, 'ml-service');
const ml = spawn('python', ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000', '--reload'], { cwd: mlPath, shell: true, stdio: 'inherit' });

const cleanup = () => {
  try { backend.kill(); } catch (e) {}
  try { frontend.kill(); } catch (e) {}
  try { ml.kill(); } catch (e) {}
};

process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit();
});
