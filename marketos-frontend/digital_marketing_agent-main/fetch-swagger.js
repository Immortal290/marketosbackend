const fs = require('fs');

async function fetchSwagger() {
  const urls = [
    'http://localhost:3000/api-docs-json',
    'http://localhost:3000/api-docs/swagger.json',
    'http://localhost:3000/swagger.json',
    'http://localhost:3000/api-docs.json',
    'http://localhost:8000/api-docs-json',
    'http://localhost:8000/api-docs/swagger.json'
  ];

  for (const url of urls) {
    try {
      console.log(`Trying ${url}...`);
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        fs.writeFileSync('swagger-out.json', JSON.stringify(data, null, 2));
        console.log(`Success! Saved swagger from ${url}`);
        return;
      }
    } catch (e) {
      console.log(`Failed for ${url}: ${e.message}`);
    }
  }
  console.log('Could not fetch swagger from any url.');
}

fetchSwagger();
