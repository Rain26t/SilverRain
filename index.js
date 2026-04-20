require('dotenv').config();

const http = require('http');

const PORT = Number(process.env.PORT || 3000);

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'SilverRain', mode: 'n8n-managed' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('SilverRain is now a lightweight handoff service for n8n.');
});

server.listen(PORT, () => {
  console.log(`SilverRain listening on port ${PORT}`);
  console.log('Discord bot behavior has been removed. Use n8n for workflows and automation.');
});
