#!/usr/bin/env node
// Read-only получение текста первоисточника. JSON сохраняется исполнителем
// вместе с исследованием; недоступность или PDF не превращаются в подтверждение.
import { createHash } from 'node:crypto';
import { auditSourceUrl } from './lib/sources.mjs';
import { isMain, parseArgs } from './lib/content.mjs';

export async function captureSource(url, { fetcher = fetch, now = new Date(), timeoutMs = 15000 } = {}) {
  const audit = auditSourceUrl(url);
  if (!audit.ok) throw new Error(audit.reason);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = url;
    let response;
    for (let i = 0; i <= 5; i++) {
      response = await fetcher(current, { redirect: 'manual', signal: controller.signal });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get('location');
      if (!location) throw new Error('редирект без адреса');
      current = new URL(location, current).href;
      if (!auditSourceUrl(current).ok) throw new Error('редирект за пределы пригодных первоисточников');
      if (i === 5) throw new Error('слишком много редиректов');
    }
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!/^(text\/|application\/json)/i.test(contentType)) throw new Error(`нужен текст документа, получен ${contentType || 'неизвестный формат'}`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > 8 * 1024 * 1024) throw new Error('документ больше 8 MiB');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8 * 1024 * 1024) { await reader.cancel(); throw new Error('документ больше 8 MiB'); }
      chunks.push(Buffer.from(value));
    }
    const charset = contentType.match(/charset=["']?([^;\s"']+)/i)?.[1] || 'utf-8';
    const raw = new TextDecoder(charset, { fatal: true }).decode(Buffer.concat(chunks));
    const text = /text\/html/i.test(contentType)
      ? raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()
      : raw.trim();
    if (text.length < 40) throw new Error('текст документа пуст или слишком короток');
    return { url, finalUrl: current, status: 200, contentType, fetchedAt: now.toISOString(), text, sha256: createHash('sha256').update(text).digest('hex') };
  } finally { clearTimeout(timer); }
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  try {
    if (!args.url) throw new Error('Использование: source-snapshot.mjs --url https://...');
    console.log(JSON.stringify(await captureSource(args.url), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
