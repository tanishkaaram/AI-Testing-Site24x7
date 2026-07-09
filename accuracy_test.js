const fs = require('fs');
const readline = require('readline');
const http = require('http');

async function main() {
  console.log('Loading dataset and compact mapping...');
  const compactData = JSON.parse(fs.readFileSync('site24x7_compact.json', 'utf8'));
  
  // Create mapping from endpoint+method to API ID
  const endpointToId = new Map();
  for (const api of compactData.apis) {
    const key = `${api.method.toUpperCase()} ${api.endpoint}`;
    if (!endpointToId.has(key)) {
      endpointToId.set(key, api.id);
    }
  }

  const queries = [];
  const fileStream = fs.createReadStream('site24x7_Dataset.csv');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isHeader = true;
  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue; }
    // CSV parse
    const parts = line.split(',');
    if (parts.length < 3) continue;
    
    // Some queries might have commas in quotes, but the dataset is simple.
    // Actually, looking at the dataset, some have quotes. Let's just use a simple regex split for CSV.
    const row = line.match(/(?:\"([^\"]*)\"|([^,]+))/g).map(s => {
      if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
      if (s === ',') return '';
      if (s.endsWith(',')) return s.slice(0, -1);
      return s;
    });
    
    // query, endpoint, method
    const q = row[0];
    const endpoint = row[1];
    let method = row[2];
    if (method && method.endsWith(',')) method = method.slice(0, -1);

    if (q && endpoint && method) {
      queries.push({ query: q, endpoint, method });
    }
  }
  
  console.log(`Loaded ${queries.length} queries to test.`);

  let totalTested = 0;
  let top1Hits = 0;
  let top5Hits = 0;
  let top10Hits = 0;

  // Test a random sample of 200 queries to make it fast but statistically significant
  const sampleSize = Math.min(200, queries.length);
  const sample = [];
  for (let i = 0; i < sampleSize; i++) {
    sample.push(queries[Math.floor(Math.random() * queries.length)]);
  }

  console.log(`Testing accuracy on a random sample of ${sampleSize} queries...`);

  for (const item of sample) {
    const expectedKey = `${item.method.toUpperCase()} ${item.endpoint}`;
    const expectedId = endpointToId.get(expectedKey);
    
    if (!expectedId) {
      // Endpoint not found in compact JSON, skip
      continue;
    }

    try {
      const results = await search(item.query);
      totalTested++;
      
      const ids = results.map(r => r.id);
      if (ids[0] === expectedId) top1Hits++;
      if (ids.slice(0, 5).includes(expectedId)) top5Hits++;
      if (ids.slice(0, 10).includes(expectedId)) top10Hits++;
      
      if (totalTested % 50 === 0) {
        console.log(`Tested ${totalTested}/${sampleSize}... (Current Top 5 Accuracy: ${((top5Hits/totalTested)*100).toFixed(2)}%)`);
      }
    } catch (err) {
      console.error(`Error querying "${item.query}":`, err.message);
    }
  }

  console.log('\n========================================');
  console.log('RESULTS:');
  console.log(`Top 1 Accuracy:  ${((top1Hits / totalTested) * 100).toFixed(2)}%`);
  console.log(`Top 5 Accuracy:  ${((top5Hits / totalTested) * 100).toFixed(2)}%`);
  console.log(`Top 10 Accuracy: ${((top10Hits / totalTested) * 100).toFixed(2)}%`);
  console.log('========================================');
}

function search(query) {
  return new Promise((resolve, reject) => {
    const q = encodeURIComponent(query);
    http.get(`http://localhost:3334/semantic_search?q=${q}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

main().catch(console.error);
