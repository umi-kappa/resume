import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { load } from 'cheerio';
import { renderResume } from '../scripts/resume-html.mjs';

const source = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const config = JSON.parse(await readFile(new URL('../pdf/config.json', import.meta.url), 'utf8'));

test('real manuscript: configured order, header fields, exclusions and clickable URLs', () => {
  const { body } = renderResume(source, config);
  const $ = load(body);
  assert.deepEqual($('h2').map((_, el) => $(el).text()).get(), config.sections);
  assert.deepEqual($('dt').map((_, el) => $(el).text()).get(), config.fields);
  assert.equal($('img').length, 0);
  for (const text of ['English version', 'LinkedIn', 'Twitter', 'この先やりたいこと', '最終更新日']) {
    assert.ok(!$.text().includes(text), text);
  }
  assert.equal($('header a').length, 3);
  assert.equal($('a[href="https://github.com/umi-kappa/peak-rm"]').text(), 'PeakRM');
  assert.ok($.text().includes('第3刷、累計3,600部'));
});

test('missing/duplicate sections and missing fields fail visibly', () => {
  assert.throws(() => renderResume(source.replace('## 自己PR・志向性', '## 改名'), config), /Missing section/);
  assert.throws(() => renderResume(`${source}\n## 自己PR・志向性\n本文`, config), /Duplicate section/);
  assert.throws(() => renderResume(source.replace('| Qiita |', '| 別名 |'), config), /Missing basic information/);
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
