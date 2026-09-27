import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { load } from 'cheerio';
import MarkdownIt from 'markdown-it';
import { renderResume } from '../scripts/resume-html.mjs';

const source = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const updatedLine = source.match(/^\*最終更新日：.+\*$/m)[0];
const config = JSON.parse(await readFile(new URL('../pdf/config.json', import.meta.url), 'utf8'));

test('real manuscript: configured order, header fields, exclusions and clickable URLs', () => {
  const { body } = renderResume(source, config);
  const $ = load(body);
  assert.deepEqual($('h2').map((_, el) => $(el).text()).get(), [
    '自己PR・志向性', '技術スタック', '職歴・プロジェクト経験', '技術研鑽・個人開発',
    '技術発信', '開発で大切にしていること', 'この先やりたいこと', '働く環境に求めること',
  ]);
  assert.deepEqual($('dt').map((_, el) => $(el).text()).get(), ['名前', 'GitHub', 'Zenn', 'Qiita']);
  assert.equal($('img').length, 2);
  assert.equal($('.image-row').length, 1);
  assert.ok($('main > p:last-child').text().includes(updatedLine.slice(1, -1)));
  assert.ok($('img').toArray().every(el => $(el).attr('src').startsWith('data:image/jpeg;base64,')));
  for (const text of ['English version', 'Codexで自動翻訳', 'LinkedIn', 'X (Twitter)']) {
    assert.ok(!$.text().includes(text), text);
  }
  assert.equal($('header a').length, 3);
  assert.equal($('a[href="https://github.com/umi-kappa/peak-rm"]').text(), 'PeakRM');
  assert.ok($.text().includes('第3刷、累計3,600部'));
});

test('missing, duplicate and unregistered sections or duplicate fields fail visibly', () => {
  assert.throws(() => renderResume(source.replace('## 自己PR・志向性', '## 改名'), config), /Missing section/);
  assert.throws(() => renderResume(`${source}\n## 自己PR・志向性\n本文`, config), /Duplicate section/);
  assert.throws(() => renderResume(source.replace('| Qiita |', '| GitHub |'), config), /Duplicate basic information/);
  assert.throws(() => renderResume(`${source}\n## 新セクション\n本文`, config), /Unregistered section: 新セクション/);
  assert.throws(() => renderResume(source, { ...config, excludedBasicInfoFields: ['未登録'] }), /Unknown excluded basic information/);
  assert.throws(() => renderResume(source, { ...config, sections: [...config.sections, config.sections[0]] }), /Invalid config/);
});

test('config controls order without rewriting selected prose', () => {
  const $ = load(renderResume(source, { ...config, sections: [...config.sections].reverse() }).body);
  assert.deepEqual($('h2').map((_, el) => $(el).text()).get(), [...config.sections].reverse());
  const normal = load(renderResume(source, config).body);
  assert.deepEqual($('section').map((_, el) => $(el).text()).get().reverse(), normal('section').map((_, el) => normal(el).text()).get());
});

test('future long prose, nested lists, tables, and inline formatting survive selection', () => {
  const long = '文章の追加・修正に対応する検証です。'.repeat(300);
  const extra = `\n### 追加した見出し\n\n${long}\n\n- 親項目\n  - **子項目**と[参照](https://example.com/)\n\n| 列A | 列B |\n|---|---|\n| 値A | 値B |\n`;
  const changed = source.replace('## 職歴・プロジェクト経験', `${extra}\n## 職歴・プロジェクト経験`);
  const $ = load(renderResume(changed, config).body);
  assert.ok($.text().includes(long));
  assert.ok($('li li strong').toArray().some(el => $(el).text() === '子項目'));
  assert.ok($('td').toArray().some(el => $(el).text() === '値B'));
});

test('active HTML and local links cannot reach the PDF browser', () => {
  assert.throws(() => renderResume(source.replace('## 職歴・プロジェクト経験', '<script>alert(1)</script>\n\n## 職歴・プロジェクト経験'), config), /Unsupported HTML/);
  assert.throws(() => renderResume(source.replace('https://github.com/umi-kappa)', './local-file)'), config), /absolute HTTP/);
});

test('all manuscript text, links and image descriptions survive, except the English notice and excluded account rows', () => {
  const original = load(new MarkdownIt({ html: true, breaks: true }).render(source));
  original('p').filter((_, el) => original(el).find('a[href="./README.en.md"]').length).remove();
  original('h2').filter((_, el) => original(el).text() === config.basicInfoSection).remove();
  original('table').first().find('thead').remove();
  original('table').first().find('tbody tr').filter((_, el) =>
    ['LinkedIn', 'X (Twitter)'].includes(original(el).children('td').first().text())
  ).remove();
  const rendered = load(renderResume(source, config).body);
  const textParts = $ => $('body').text().split(/\s+/).filter(Boolean).sort();
  assert.deepEqual(textParts(rendered), textParts(original));
  const links = $ => $('a').map((_, el) => $(el).attr('href')).get().sort();
  assert.deepEqual(links(rendered), links(original));
  assert.deepEqual(rendered('img').map((_, el) => rendered(el).attr('alt')).get(), original('img').map((_, el) => original(el).attr('alt')).get());
});

test('new basic information fields and accompanying prose are automatically included', () => {
  const changed = source.replace('| Qiita |', '| 新項目 | 新しい値 |\n| Qiita |').replace('## 自己PR・志向性', '基本情報の補足。\n\n## 自己PR・志向性');
  const $ = load(renderResume(changed, config).body);
  assert.ok($('dt').filter((_, el) => $(el).text() === '新項目').next('dd').text() === '新しい値');
  assert.ok($('header').text().includes('基本情報の補足。'));
});

test('missing dates, unhandled preamble and unsafe or missing image references fail', () => {
  assert.throws(() => renderResume(source.replace(updatedLine, ''), config), /last-updated/);
  assert.throws(() => renderResume(source.replace('## 基本情報', '掲載すべき前書き\n\n## 基本情報'), config), /Unexpected content/);
  for (const src of ['https://example.com/a.jpg', 'file:///tmp/a.jpg', './images/../README.md', 'data:image/png;base64,AA==', './images/book-ja.svg']) {
    assert.throws(() => renderResume(source.replace('./images/book-ja.jpg', src), config), /Invalid local image/);
  }
  assert.throws(() => renderResume(source.replace('./images/book-ja.jpg', './images/missing.jpg'), config), /Cannot read local image/);
  assert.throws(() => renderResume(`${source}\n\n${updatedLine}`, config), /last-updated/);
  const $ = load(renderResume(source.replace('width="400"', 'onerror="alert(1)" srcset="https://example.com/a.jpg" style="display:none"'), config).body);
  assert.equal($('img[onerror], img[srcset], img[style]').length, 0);
});

test('metadata lists and standalone labels connect to following content without wrapping sections', () => {
  const $ = load(renderResume(source, config).body);
  const expected = (source.match(/^- \*\*期間：/gm) ?? []).length;
  assert.ok(expected > 0);
  assert.equal($('ul.project-metadata').length, expected);
  $('.project-metadata').each((_, el) => {
    assert.ok($(el).prev().is('h4'));
    assert.ok($(el).next().hasClass('label-content'));
    assert.equal($(el).next().children().first().text(), '概要');
    assert.ok($(el).next().children().first().hasClass('lead-in'));
  });
  for (const label of ['概要', '課題と取り組み', '成果']) {
    $('p').filter((_, el) => $(el).text() === label).each((_, el) => assert.ok($(el).hasClass('lead-in')));
  }
  assert.equal($('section[class]').length, 0);
});


test('Markdown image blocks preserve image data and remain grouped', () => {
  const changed = source.replace(/<img src="([^\"]+)" alt="([^\"]+)" width="400">/g, '![$2]($1)');
  const $ = load(renderResume(changed, config).body);
  assert.equal($('.image-row').length, 1);
  assert.equal($('.image-row img').length, 2);
  assert.equal($('.image-row .image-row').length, 0);
});
