// backend/server.js
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const axios = require('axios');
const cors = require('cors');
const { config } = require('dotenv');
config({ path: require('path').resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let tradesCache = []; // In-memory local cache

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(JSON.stringify(data));
  });
}

// Background async ingestion worker
async function startIngestion() {
  const BSE_URL = process.env.BSE_API_URL || 'http://localhost:4000/getTrades';
  let offset = 0;
  const totalDuration = parseInt(process.env.TOTAL_PULL_DURATION_MS, 10);
  const totalRecords = parseInt(process.env.TOTAL_RECORDS, 10);

// auto-calc safe limit
  const maxLimit = Math.floor((30000 * totalRecords) / totalDuration);
  const limit = Math.min(parseInt(process.env.LIMIT || maxLimit, 10), maxLimit);

  let hasMore = true;

  console.log('Ingestion started...');
  console.log(`Using limit: ${limit}, totalDuration: ${totalDuration}ms, totalRecords: ${totalRecords}`);

  while (hasMore) {
    try {
      const response = await axios.get(`${BSE_URL}?offset=${offset}&limit=${limit}`,{
        timeout: 30000, // 30 seconds timeout
      });
      const { trades, isFinished } = response.data;

      if (trades && trades.length > 0) {
        tradesCache.push(...trades);
        broadcast({ event: 'NEW_TRADES', data: trades });
        offset += trades.length;
      }

      if (isFinished || !trades || trades.length === 0) {
        hasMore = false;
         broadcast({ event: 'INGESTION_COMPLETED'});
        console.log('Ingestion completed successfully.');
      }

      // Small delay between chunk pulls to simulate continuous streaming
      await new Promise((r) => setTimeout(r,process.env.PULL_INTERVAL_MS || 2000));
    } catch (err) {
      console.error('Ingestion error, retrying in 3s:', err.message);
      await new Promise((r) => setTimeout(r,process.env.RETRY_DELAY_MS || 3000));
    }
  }
}

// REST endpoint for instant dashboard loading
app.get('/api/trades', (req, res) => {
  res.json(tradesCache);
});

app.get('/',(req,res)=>{
    res.send('Backend server is running. Use /api/trades to fetch trades.');
});
    
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`Backend live on port ${PORT}`);
  startIngestion();
});