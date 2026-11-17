// Renders resume/resume.html to assets/Jordan_Jenkins_Resume.pdf with an installed Chrome or Edge.
// Usage: npm run resume   (then npm run build to copy it into docs/)
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const browser = candidates.find(existsSync);
if (!browser) { console.error('No Chrome or Edge found. Set CHROME_PATH to its executable.'); process.exit(1); }

const source = pathToFileURL(resolve('resume/resume.html')).href;
const output = resolve('assets/Jordan_Jenkins_Resume.pdf');
execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${output}`, source], { stdio: 'ignore' });
console.log(`Wrote ${output}`);
