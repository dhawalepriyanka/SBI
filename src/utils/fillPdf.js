import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { imagePlacementMap } from '../imagePlacementMap.js';

function dataUrlBytes(dataUrl) {
  const encoded = dataUrl.split(',')[1];
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function embedDataImage(document, dataUrl) {
  const bytes = dataUrlBytes(dataUrl);
  return dataUrl.startsWith('data:image/png') ? document.embedPng(bytes) : document.embedJpg(bytes);
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
  const color = rgb(0, 0, 0);
  const fitText = (text, width, preferred) => {
    let size = preferred;
    while (size > 4 && font.widthOfTextAtSize(text, size) > width) size -= .25;
    return size;
  };

  for (const kind of ['photo', 'signature']) {
    for (const placement of imagePlacementMap[kind]) {
      const dataUrl = media[kind]?.[placement.id];
      if (!dataUrl) continue;
      const image = await embedDataImage(document, dataUrl);
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
    }
  }

  for (const [pageNumber, fields] of Object.entries(fieldMap.pages)) {
    const pdfPage = document.getPage(Number(pageNumber) - 1);
    for (const field of fields) {
      const storedValue = String(values[field.id] || '').trim().toUpperCase();
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
  return document.save({ useObjectStreams: true });
}
