// Dev keepalive worker
console.log('🛠️  ChoreBlimey Worker started');
setInterval(() => console.log(`[heartbeat] ${new Date().toISOString()}`), 60_000);
