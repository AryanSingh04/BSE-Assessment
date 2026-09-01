//mock-base-api
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { config } = require('dotenv');
config({ path: path.resolve(__dirname, '../.env') });

const app=express();
app.use(cors());

const trades=JSON.parse(fs.readFileSync(path.join(__dirname,'trades.json'),'utf-8'));

app.get('/getTrades',(req,res)=>{
    const offset=parseInt(req.query.offset)||0;
    const limit=parseInt(req.query.limit)||200;
    const totalDuration = parseInt(process.env.TOTAL_PULL_DURATION_MS, 10);
    const totalRecords = parseInt(process.env.TOTAL_RECORDS, 10);

// auto-calc safe limit
    const maxLimit = Math.floor((30000 * totalRecords) / totalDuration);
    

    const delayPerChunk = (totalDuration / totalRecords) * limit;
    const chunk=trades.slice(offset,offset+limit);
    const isFinished=offset+limit>=trades.length;
    
    setTimeout(()=>{
        res.json({trades:chunk,isFinished})
        console.log(`Served trades chunk: offset=${offset}, limit=${limit}, isFinished=${isFinished}`)
    },  28000) 

})

app.listen(4000,()=>{
    console.log('Mock API server is running on http://localhost:4000');
})