import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { renderResume } from './resume-html.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFile(path.join(root, name), 'utf8');

// Embed the pinned font files so neither installed system fonts nor a CDN affect layout.
async function fontCss() {
  const directory = path.join(root, 'node_modules/@fontsource/noto-sans-jp');
  let css = '';
  for (const weight of [400, 700]) {
    const source = await readFile(path.join(directory, `${weight}.css`), 'utf8');
    for (const block of source.matchAll(/@font-face\s*\{[^}]+\}/g)) {
      let rule = block[0];
      for (const match of rule.matchAll(/url\(([^)]+)\)/g)) {
        const filename = match[1].replace(/['"]/g, '');
        const bytes = await readFile(path.join(directory, filename));
        rule = rule.replace(match[0], `url(data:font/woff2;base64,${bytes.toString('base64')})`);
      }
      css += rule;
    }
  }
  return css;
}

export async function generatePdf(source, outputDirectory) {
  const config = JSON.parse(await read('pdf/config.json'));
  const { title, body } = renderResume(source, config);
  const css = await read('pdf/print.css');
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${title}</title><style>${await fontCss()}\n${css}</style></head><body>${body}</body></html>`;
  await mkdir(outputDirectory, { recursive: true });
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', request => request.url().startsWith('data:') ? request.continue() : request.abort());
    await page.setContent(html, { waitUntil: 'load' });
    await page.emulateMediaType('print');
    await page.evaluate(() => document.fonts.ready);
    if (!await page.evaluate(() => document.fonts.check('10pt "Noto Sans JP"', '職務経歴書'))) {
      throw new Error('Japanese font failed to load');
    }
    await page.pdf({
      path: path.join(outputDirectory, 'resume.pdf'),
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="width:100%;text-align:center;font-size:8px;color:#666"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      tagged: true,
    });
    await writeFile(path.join(outputDirectory, 'resume.html'), html);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generatePdf(await read('README.md'), path.join(root, 'output/pdf'));
  console.log('Generated output/pdf/resume.pdf and resume.html');
}
