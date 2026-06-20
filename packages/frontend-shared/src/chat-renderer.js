export function renderMessageHtml(message) {
  const errorClass = message.error ? ' message-error' : '';
  const copyTitle = message.role === 'user' ? '复制我的消息' : '复制助手回复';
  const cursor = message.pending ? '<span class="cursor-blink">▋</span>' : '';

  return `
    <div class="message message-${message.role}${errorClass}" data-message-id="${escapeHtml(message.id)}">
      <div class="message-bubble">
        <div class="message-content">${renderMessageContent(message)}${cursor}</div>
        <button class="message-copy-btn" type="button" title="${copyTitle}" aria-label="${copyTitle}" data-copy-message="${escapeHtml(message.id)}">
          <svg class="icon" aria-hidden="true"><use href="#icon-copy"></use></svg>
        </button>
      </div>
    </div>
  `;
}

export function renderMessageContent(message) {
  if (!message.content) return '';
  if (message.role !== 'assistant' || message.error) {
    return escapeHtml(message.content).replace(/\n/g, '<br>');
  }
  return renderMarkdown(message.content);
}

export function renderMarkdown(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let paragraph = [];
  let listType = null;
  let inCode = false;
  let codeLines = [];
  let quoteLines = [];
  let tableLines = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  };

  const flushQuote = () => {
    if (!quoteLines.length) return;
    html.push(`<blockquote>${quoteLines.map(line => `<p>${renderInlineMarkdown(line)}</p>`).join('')}</blockquote>`);
    quoteLines = [];
  };

  const flushTable = () => {
    if (!tableLines.length) return;
    if (tableLines.length >= 2 && isTableSeparator(tableLines[1])) {
      html.push(renderTable(tableLines));
    } else {
      paragraph.push(...tableLines);
    }
    tableLines = [];
  };

  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        flushParagraph();
        closeList();
        flushQuote();
        flushTable();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      flushTable();
      flushQuote();
      flushParagraph();
      closeList();
      continue;
    }

    if (isTableLine(trimmed)) {
      flushParagraph();
      closeList();
      flushQuote();
      tableLines.push(trimmed);
      continue;
    }

    flushTable();

    const quote = trimmed.match(/^>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      closeList();
      quoteLines.push(quote[1]);
      continue;
    }

    flushQuote();

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(heading[1].length + 2, 5);
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (listType !== 'ul') {
        closeList();
        listType = 'ul';
        html.push('<ul>');
      }
      html.push(`<li>${renderInlineMarkdown(unordered[1])}</li>`);
      continue;
    }

    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (listType !== 'ol') {
        closeList();
        listType = 'ol';
        html.push('<ol>');
      }
      html.push(`<li>${renderInlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  if (inCode) {
    html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }
  flushTable();
  flushQuote();
  flushParagraph();
  closeList();
  return html.join('');
}

function isTableLine(line) {
  return line.includes('|') && line.split('|').filter(cell => cell.trim()).length >= 2;
}

function isTableSeparator(line) {
  const cells = splitTableRow(line);
  return cells.length >= 2 && cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()));
}

function renderTable(lines) {
  const rows = lines.map(splitTableRow);
  const headers = rows[0] || [];
  const bodyRows = rows.slice(2);
  return [
    '<div class="markdown-table-wrap"><table>',
    `<thead><tr>${headers.map(cell => `<th>${renderInlineMarkdown(cell.trim())}</th>`).join('')}</tr></thead>`,
    `<tbody>${bodyRows.map(row => `<tr>${headers.map((_, index) => `<td>${renderInlineMarkdown((row[index] || '').trim())}</td>`).join('')}</tr>`).join('')}</tbody>`,
    '</table></div>',
  ].join('');
}

function splitTableRow(line) {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|');
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
