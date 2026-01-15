async function main() {
  const url = 'https://4all.digital/preflight-tests.html';

  console.log(`Fetching ${url}...`);
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'ReleasePass-Bot/1.0',
      'Accept': 'text/html',
    },
  });

  const html = await response.text();

  // Simple regex to find iframes
  const iframeRegex = /<iframe[^>]*>/gi;
  const matches = html.match(iframeRegex);

  console.log('\n=== Iframes found in HTML ===');
  if (matches) {
    matches.forEach((match, i) => {
      console.log(`${i + 1}: ${match}`);

      // Extract src
      const srcMatch = match.match(/src=["']([^"']+)["']/i);
      if (srcMatch) {
        console.log(`   src: ${srcMatch[1]}`);
        console.log(`   isHttp: ${srcMatch[1].toLowerCase().startsWith('http:')}`);
      }
    });
  } else {
    console.log('No iframes found!');
  }
}

main();