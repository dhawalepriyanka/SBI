import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { imagePlacementMap } from '../imagePlacementMap.js';

let cachedFontBytes = null;
async function getHandwritingFontBytes() {
  if (cachedFontBytes) return cachedFontBytes;
  try {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const fontPath = join(currentDir, '../../server/private/handwriting.ttf');
    cachedFontBytes = await readFile(fontPath);
    return cachedFontBytes;
  } catch {
    return null;
  }
}

function sanitizeWinAnsi(text) {
  if (!text) return '';
  return String(text)
    .replace(/\u20B9/g, 'Rs. ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '*')
    .replace(/\s+/g, ' ')
    .replace(/[^\x00-\xFF]/g, '');
}

function dataUrlBytes(dataUrl) {
  const parts = dataUrl.split(',');
  if (parts.length < 2) return null;
  try {
    const binary = atob(parts[1]);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function embedDataImage(document, dataUrl) {
  const bytes = dataUrlBytes(dataUrl);
  if (!bytes) return null;
  try {
    return dataUrl.startsWith('data:image/png') ? await document.embedPng(bytes) : await document.embedJpg(bytes);
  } catch (error) {
    console.warn('Failed to embed image in PDF:', error.message);
    return null;
  }
}

function wrapText(text, font, size, width) {
  const lines = [];
  const paragraphs = String(text).split(/\r?\n/);
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (font.widthOfTextAtSize(word, size) > width) {
        if (line) { lines.push(line); line = ''; }
        for (const char of word) {
          const candidate = line + char;
          if (font.widthOfTextAtSize(candidate, size) <= width) {
            line = candidate;
          } else {
            if (line) lines.push(line);
            line = char;
          }
        }
      } else {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) {
          line = candidate;
        } else {
          if (line) lines.push(line);
          line = word;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function fillOriginalPdf(originalBytes, values, fieldMap, media = {}) {
  const document = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  const font = await document.embedFont(StandardFonts.HelveticaBold);
  const color = rgb(0.043, 0.235, 0.608);
  const fitText = (text, width, preferred) => {
    let size = preferred;
    while (size > 4 && font.widthOfTextAtSize(text, size) > width) size -= .25;
    return size;
  };

  const KEEP_ORIGINAL_PAGES = new Set([1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);

  for (const kind of ['photo', 'signature']) {
    for (const placement of imagePlacementMap[kind]) {
      if (!KEEP_ORIGINAL_PAGES.has(placement.page)) continue;
      const dataUrl = media[kind]?.[placement.id];
      if (!dataUrl) continue;
      try {
        const image = await embedDataImage(document, dataUrl);
        if (!image) continue;
        const pdfPage = document.getPage(placement.page - 1);
        const inset = kind === 'photo' ? 2 : 3;
        const targetWidth = placement.width - inset * 2;
        const targetHeight = placement.height - inset * 2;
        const ratio = Math.min(targetWidth / image.width, targetHeight / image.height);
        const width = image.width * ratio;
        const height = image.height * ratio;
        const boxBottom = fieldMap.pageHeight - placement.y - placement.height;
        pdfPage.drawImage(image, {
          x: placement.x + (placement.width - width) / 2,
          y: boxBottom + (placement.height - height) / 2,
          width, height,
        });
      } catch (imageError) {
        console.warn(`Error placing ${kind} ${placement.id}:`, imageError.message);
      }
    }
  }

  for (const [pageNumber, fields] of Object.entries(fieldMap.pages)) {
    if (!KEEP_ORIGINAL_PAGES.has(Number(pageNumber))) continue;
    const pdfPage = document.getPage(Number(pageNumber) - 1);
    for (const field of fields) {
      const rawValue = String(values[field.id] || '').trim().toUpperCase();
      const storedValue = sanitizeWinAnsi(rawValue);
      const value = storedValue;
      if (!value) continue;
      const bottom = fieldMap.pageHeight - field.y - field.height;
      if (field.type === 'checkbox' || field.type === 'radio') {
        const lineWidth = Math.max(.8, Math.min(field.width, field.height) * .11);
        pdfPage.drawLine({
          start: { x: field.x + field.width * .18, y: bottom + field.height * .50 },
          end: { x: field.x + field.width * .42, y: bottom + field.height * .25 },
          thickness: lineWidth, color,
        });
        pdfPage.drawLine({
          start: { x: field.x + field.width * .42, y: bottom + field.height * .25 },
          end: { x: field.x + field.width * .84, y: bottom + field.height * .78 },
          thickness: lineWidth, color,
        });
        continue;
      }
      if (field.type === 'character') {
        const cellWidth = field.width / field.maxLength;
        const size = Math.min(field.height * .72, cellWidth * .78);
        [...value.slice(0, field.maxLength)].forEach((character, index) => {
          if (/\s/.test(character)) return;
          const characterWidth = font.widthOfTextAtSize(character, size);
          pdfPage.drawText(character, { x: field.x + index * cellWidth + (cellWidth - characterWidth) / 2,
            y: bottom + (field.height - size) / 2, size, font, color });
        });
        continue;
      }
      if (field.type === 'multiline') {
        const isNotesPage = String(pageNumber) === '20' || field.height > 200;
        const size = isNotesPage ? 11.5 : Math.max(8, Math.min(10, field.height / 10));
        const lineHeight = isNotesPage ? 25.20 : size * 1.3;
        const firstLineY = isNotesPage ? 746.57 : (bottom + field.height - 6 - size);
        const paddingLeft = isNotesPage ? 6 : 4;
        const availableWidth = field.width - paddingLeft * 2;
        const maxLinesPerPage = isNotesPage ? 28 : Math.max(1, Math.floor((field.height - 6) / lineHeight));

        const lines = wrapText(value, font, size, availableWidth);

        if (!isNotesPage || lines.length <= maxLinesPerPage) {
          lines.slice(0, maxLinesPerPage).forEach((line, index) => {
            if (!line) return;
            pdfPage.drawText(line, {
              x: field.x + paddingLeft,
              y: firstLineY - index * lineHeight,
              size, font, color,
            });
          });
        } else {
          const pageChunks = [];
          for (let i = 0; i < lines.length; i += maxLinesPerPage) {
            pageChunks.push(lines.slice(i, i + maxLinesPerPage));
          }

          for (let pageIndex = 0; pageIndex < pageChunks.length; pageIndex++) {
            let targetPage = pdfPage;
            if (pageIndex > 0) {
              const pageCopyIndex = Number(pageNumber) - 1;
              const [copiedPage] = await document.copyPages(document, [pageCopyIndex]);
              targetPage = document.addPage(copiedPage);
            }
            const chunk = pageChunks[pageIndex];
            chunk.forEach((line, index) => {
              if (!line) return;
              targetPage.drawText(line, {
                x: field.x + paddingLeft,
                y: firstLineY - index * lineHeight,
                size, font, color,
              });
            });
          }
        }
        continue;
      }
      const normalized = value.replace(/\s+/g, ' ');
      const size = fitText(normalized, field.width - 3, Math.min(9, field.height * .68));
      const textWidth = font.widthOfTextAtSize(normalized, size);
      const textX = field.align === 'center' ? field.x + (field.width - textWidth) / 2 : field.x + 1.5;
      pdfPage.drawText(normalized, { x: textX,
        y: bottom + Math.max(1.5, (field.height - size) / 2), size, font, color });
    }
  }
  for (let i = document.getPageCount() - 1; i >= 0; i--) {
    if (!KEEP_ORIGINAL_PAGES.has(i + 1)) {
      document.removePage(i);
    }
  }

  const pageNumberFont = await document.embedFont(StandardFonts.Helvetica);
  const remainingPages = document.getPageCount();
  for (let i = 1; i < remainingPages; i++) {
    const page = document.getPage(i);
    const pageNumText = String(i + 1);
    const textWidth = pageNumberFont.widthOfTextAtSize(pageNumText, 8);
    page.drawRectangle({
      x: 290,
      y: 24,
      width: 32,
      height: 16,
      color: rgb(1, 1, 1),
    });
    page.drawText(pageNumText, {
      x: 306 - textWidth / 2,
      y: 29,
      size: 8,
      font: pageNumberFont,
      color: rgb(0, 0, 0),
    });
  }

  return document.save({ useObjectStreams: true });
}
