import MarkdownIt from 'markdown-it';
import { load } from 'cheerio';

const md = new MarkdownIt({ html: true, breaks: true });

// Select parsed level-two sections, never line numbers or page positions.
export function renderResume(source, config) {
  const tokens = md.parse(source, {});
  const sections = new Map();
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== 'heading_open' || tokens[i].tag !== 'h2') continue;
    const name = tokens[i + 1].content;
    if (sections.has(name)) throw new Error(`Duplicate section: ${name}`);
    let end = i + 3;
    while (end < tokens.length && !(tokens[end].type === 'heading_open' && ['h1', 'h2'].includes(tokens[end].tag))) end++;
    sections.set(name, tokens.slice(i, end));
  }
  const section = (name) => {
    if (!sections.has(name)) throw new Error(`Missing section: ${name}`);
    return md.renderer.render(sections.get(name), md.options, {});
  };
  for (const key of ['sections', 'fields']) {
    if (!Array.isArray(config[key]) || !config[key].length || new Set(config[key]).size !== config[key].length) {
      throw new Error(`Invalid config: ${key}`);
    }
  }
  const titleIndex = tokens.findIndex(t => t.type === 'heading_open' && t.tag === 'h1');
  if (titleIndex < 0) throw new Error('Missing document title');
  const title = md.renderer.render(tokens.slice(titleIndex, titleIndex + 3), md.options, {});
  const info = load(section(config.basicInfoSection));
  const fields = new Map();
  info('tbody tr').each((_, row) => {
    const cells = info(row).find('td');
    const name = cells.eq(0).text().trim();
    if (fields.has(name)) throw new Error(`Duplicate basic information: ${name}`);
    fields.set(name, cells.eq(1).html());
  });
  const header = config.fields.map(name => {
    if (!fields.has(name)) throw new Error(`Missing basic information: ${name}`);
    return `<div><dt>${md.utils.escapeHtml(name)}</dt><dd>${fields.get(name)}</dd></div>`;
  }).join('');
  const $ = load(`<main><header>${title}<dl>${header}</dl></header>${config.sections.map(name => `<section>${section(name)}</section>`).join('')}</main>`);
  $('img, hr').remove();
  // The Markdown is repository-owned; reject active/unsupported HTML rather than execute it.
  const allowed = new Set('html head body main header section h1 h2 h3 h4 h5 h6 dl dt dd div p a strong em ul ol li table thead tbody tr th td br code pre blockquote s'.split(' '));
  $('*').each((_, el) => {
    if (!allowed.has(el.tagName)) throw new Error(`Unsupported HTML: ${el.tagName}`);
    for (const attribute of Object.keys(el.attribs)) {
      if (!['href', 'title', 'start'].includes(attribute)) $(el).removeAttr(attribute);
    }
  });
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || !/^https?:\/\//i.test(href)) throw new Error(`Use an absolute HTTP(S) link: ${href}`);
  });
  // Use document structure, not prose length, to keep metadata with what follows.
  $('p').each((_, el) => {
    const p = $(el);
    const first = p.children().first();
    if (first.is('strong') && (p.text().trim() === first.text().trim() || p.prev().is('h2,h3,h4,h5,h6'))) {
      p.addClass('lead-in');
    } else if (first.is('strong') && !p.find('br').length) {
      p.addClass('trailing-info');
    }
  });
  return { title: $("h1").text(), body: $('main').toString() };
}
