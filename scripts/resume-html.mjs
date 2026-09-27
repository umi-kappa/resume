import MarkdownIt from 'markdown-it';
import { load } from 'cheerio';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const md = new MarkdownIt({ html: true, breaks: true });
const imageRoot = fileURLToPath(new URL('../images/', import.meta.url));

function imageData(src) {
  if (!/^(?:\.\/)?images\/[\w/-]+\.(?:jpg|jpeg|png)$/i.test(src ?? '')) {
    throw new Error(`Invalid local image reference: ${src}`);
  }
  const filename = path.resolve(imageRoot, src.replace(/^(?:\.\/)?images\//, ''));
  let bytes;
  try {
    if (!realpathSync(filename).startsWith(realpathSync(imageRoot) + path.sep)) throw new Error('outside images directory');
    bytes = readFileSync(filename);
  } catch (error) {
    throw new Error(`Cannot read local image: ${src}`, { cause: error });
  }
  const png = /\.png$/i.test(src);
  const signature = png ? Buffer.from('89504e470d0a1a0a', 'hex') : Buffer.from('ffd8ff', 'hex');
  if (!bytes.subarray(0, signature.length).equals(signature)) throw new Error(`Invalid image format: ${src}`);
  return `data:image/${png ? 'png' : 'jpeg'};base64,${bytes.toString('base64')}`;
}

// The configuration orders all level-two sections; it never selects a subset.
export function renderResume(source, config) {
  if (!Array.isArray(config.sections) || !config.sections.length ||
      new Set(config.sections).size !== config.sections.length ||
      config.sections.includes(config.basicInfoSection)) throw new Error('Invalid config: sections');
  const tokens = md.parse(source, {});
  const sections = new Map();
  const headings = tokens.flatMap((t, i) => t.type === 'heading_open' && ['h1', 'h2'].includes(t.tag) ? [i] : []);
  if (headings[0] !== 0 || tokens[0].tag !== 'h1' || headings.slice(1).some(i => tokens[i].tag === 'h1')) {
    throw new Error('Expected one document title followed by level-two sections');
  }
  for (let n = 1; n < headings.length; n++) {
    const i = headings[n];
    const name = tokens[i + 1].content;
    if (sections.has(name)) throw new Error(`Duplicate section: ${name}`);
    sections.set(name, tokens.slice(i, headings[n + 1] ?? tokens.length));
  }
  const render = list => md.renderer.render(list, md.options, {});
  const section = name => {
    if (!sections.has(name)) throw new Error(`Missing section: ${name}`);
    return render(sections.get(name));
  };
  for (const name of [config.basicInfoSection, ...config.sections]) section(name);
  for (const name of sections.keys()) {
    if (name !== config.basicInfoSection && !config.sections.includes(name)) {
      throw new Error(`Unregistered section: ${name}; update pdf/config.json`);
    }
  }
  const preamble = load(render(tokens.slice(3, headings[1])));
  preamble('p').filter((_, el) => {
    const p = preamble(el);
    return p.find('a').length === 1 && p.find('a').attr('href') === './README.en.md' &&
      /^English version\s*(?:\(.*で自動翻訳\))?$/.test(p.text().trim());
  }).remove();
  preamble('hr').remove();
  if (preamble('body').html().trim()) throw new Error('Unexpected content before basic information; review PDF handling');

  const info = load(section(config.basicInfoSection));
  info('h2, hr').remove();
  if (info('table').length !== 1) throw new Error('Expected one basic information table');
  const excludedFields = config.excludedBasicInfoFields ?? [];
  if (!Array.isArray(excludedFields) || excludedFields.some(name => typeof name !== 'string') ||
      new Set(excludedFields).size !== excludedFields.length) throw new Error('Invalid config: excludedBasicInfoFields');
  const fields = new Set();
  const header = info('tbody tr').map((_, row) => {
    const cells = info(row).children('td');
    const name = cells.eq(0).text().trim();
    if (cells.length !== 2 || !name) throw new Error('Invalid basic information row');
    if (fields.has(name)) throw new Error(`Duplicate basic information: ${name}`);
    fields.add(name);
    if (excludedFields.includes(name)) return '';
    return `<div><dt>${cells.eq(0).html()}</dt>\n<dd>${cells.eq(1).html()}</dd></div>\n`;
  }).get().join('');
  for (const name of excludedFields) {
    if (!fields.has(name)) throw new Error(`Unknown excluded basic information: ${name}`);
  }
  if (!fields.size) throw new Error('Missing basic information');
  info('table').replaceWith(`<dl>${header}</dl>`);
  const $ = load(`<main><header>${render(tokens.slice(0, 3))}${info('body').html()}</header>${config.sections.map(name => `<section>${section(name)}</section>`).join('')}</main>`);
  $('hr').remove();
  const updates = $('p').filter((_, el) => /^最終更新日：/.test($(el).text().trim()));
  if (updates.length !== 1) throw new Error('Expected one last-updated paragraph');
  $('main').append(updates);
  // Reject unsupported HTML; only images receive src/alt, never arbitrary resource attributes.
  const allowed = new Set('html head body main header section h1 h2 h3 h4 h5 h6 dl dt dd div p a strong em ul ol li table thead tbody tr th td br code pre blockquote s img'.split(' '));
  $('*').each((_, el) => {
    if (!allowed.has(el.tagName)) throw new Error(`Unsupported HTML: ${el.tagName}`);
    const attrs = el.tagName === 'img' ? ['src', 'alt', 'title'] : ['href', 'title', 'start'];
    for (const attribute of Object.keys(el.attribs)) {
      if (!attrs.includes(attribute)) $(el).removeAttr(attribute);
    }
  });
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || !/^https?:\/\//i.test(href)) throw new Error(`Use an absolute HTTP(S) link: ${href}`);
  });
  $('img').each((_, el) => $(el).attr('src', imageData($(el).attr('src'))));
  // Group consecutive image-only blocks at their original manuscript position.
  $('img').each((_, el) => {
    const img = $(el);
    if (img.closest('.image-row').length) return;
    const block = img.parent().is('p') && img.parent().children().length === 1 && !img.parent().text().trim() ? img.parent() : img;
    block.wrap('<div class="image-row"></div>');
    const row = block.parent();
    while (row.next().is('img, p') && (row.next().is('img') ||
      (row.next().children().length === 1 && row.next().children().is('img') && !row.next().text().trim()))) {
      row.append(row.next());
    }
    row.prev('ul,ol,p').addClass('before-images');
  });
  $('p').each((_, el) => {
    const p = $(el);
    const first = p.children().first();
    if (first.is('strong') && (p.text().trim() === first.text().trim() || p.prev().is('h2,h3,h4,h5,h6'))) {
      p.addClass('lead-in');
    } else if (first.is('strong') && !p.find('br').length) {
      p.addClass('trailing-info');
    }
  });
  $('ul').each((_, el) => {
    const list = $(el);
    const items = list.children('li');
    if (items.length && items.toArray().every(li => /^(期間|役割)[：:]$/.test($(li).children('strong').first().text().trim()))) {
      list.addClass('project-metadata');
    }
  });
  // Chromium may break after a standalone label despite break-after: avoid.
  // Keep only that label and its next paragraph together, never a whole project/list.
  $('p.lead-in').each((_, el) => {
    const label = $(el);
    if (label.text().trim() !== label.children('strong').first().text().trim() || !label.next().is('p')) return;
    const paragraph = label.next();
    label.wrap('<div class="label-content"></div>');
    label.parent().append('\n', paragraph);
  });
  updates.addClass('last-updated');
  return { title: $('h1').text(), body: $('main').toString() };
}
