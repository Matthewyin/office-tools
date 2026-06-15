/**
 * 读取当前选中的文本内容
 * @param {string} host - Office.HostType 值（Word / Excel / PowerPoint）
 * @returns {Promise<string>}
 */
export async function getSelectedText(host) {
  switch (host) {
    case 'Word':
      return await readWordSelection();
    case 'Excel':
      return await readExcelSelection();
    case 'PowerPoint':
      return await readPptSelection();
    default:
      throw new Error(`不支持的宿主类型: ${host}`);
  }
}

/**
 * 将文本插入到文档中
 * @param {string} host
 * @param {string} text
 */
export async function insertText(host, text) {
  switch (host) {
    case 'Word':
      return await insertWordText(text);
    case 'Excel':
      return await insertExcelText(text);
    case 'PowerPoint':
      return await insertPptText(text);
    default:
      throw new Error(`不支持的宿主类型: ${host}`);
  }
}

export async function replaceWordMatches(searchText, replacementText) {
  // eslint-disable-next-line no-undef
  return Word.run(async (context) => {
    const selection = context.document.getSelection();
    selection.load('text');
    await context.sync();

    if (selection.text.trim()) {
      const replaced = replaceLiteralText(selection.text, searchText, replacementText);
      if (replaced.count > 0) {
        // eslint-disable-next-line no-undef
        selection.insertText(replaced.text, Word.InsertLocation.replace);
        await context.sync();
      }
      return { count: replaced.count, scope: '选区' };
    }

    const results = context.document.body.search(searchText, {
      matchCase: false,
      matchWholeWord: false,
    });
    results.load('items');
    await context.sync();

    for (const item of results.items) {
      // 只替换搜索命中的正文范围，不处理页眉页脚和批注。
      // eslint-disable-next-line no-undef
      item.insertText(replacementText, Word.InsertLocation.replace);
    }

    await context.sync();
    return { count: results.items.length, scope: '全文' };
  });
}

export async function replaceWordSelection(replacementText) {
  // eslint-disable-next-line no-undef
  return Word.run(async (context) => {
    const selection = context.document.getSelection();
    selection.load('text');
    await context.sync();

    if (!selection.text.trim()) {
      throw new Error('请先选中要改写的 Word 文本。');
    }

    // eslint-disable-next-line no-undef
    selection.insertText(replacementText, Word.InsertLocation.replace);
    await context.sync();
    return { scope: '选区' };
  });
}

export async function getWordBodyText() {
  // eslint-disable-next-line no-undef
  return Word.run(async (context) => {
    const body = context.document.body;
    body.load('text');
    await context.sync();
    return body.text || '';
  });
}

export async function getWordBodyOoxmlSnapshot() {
  // eslint-disable-next-line no-undef
  return Word.run(async (context) => {
    const ooxml = context.document.body.getOoxml();
    await context.sync();
    return ooxml.value;
  });
}

export async function restoreWordBodyOoxmlSnapshot(ooxml) {
  // eslint-disable-next-line no-undef
  return Word.run(async (context) => {
    // eslint-disable-next-line no-undef
    context.document.body.insertOoxml(ooxml, Word.InsertLocation.replace);
    await context.sync();
  });
}

export async function previewWordMatches(searchText, replacementText, limit = 3) {
  // eslint-disable-next-line no-undef
  return Word.run(async (context) => {
    const selection = context.document.getSelection();
    selection.load('text');
    await context.sync();

    if (selection.text.trim()) {
      return {
        ...previewLiteralText(selection.text, searchText, replacementText, limit),
        scope: '选区',
      };
    }

    const results = context.document.body.search(searchText, {
      matchCase: false,
      matchWholeWord: false,
    });
    results.load('items');
    await context.sync();
    results.items.slice(0, limit).forEach(item => item.load('text'));
    await context.sync();

    return {
      count: results.items.length,
      scope: '全文',
      examples: results.items.slice(0, limit).map(item => ({
        before: item.text || searchText,
        after: replacementText,
      })),
    };
  });
}

export async function createExcelAnalysisSheet(analysisText) {
  // eslint-disable-next-line no-undef
  return Excel.run(async (context) => {
    const worksheets = context.workbook.worksheets;
    worksheets.load('items/name');
    await context.sync();

    const usedNames = new Set(worksheets.items.map(sheet => sheet.name));
    const sheetName = nextSheetName(usedNames, 'AI 分析');
    const sheet = worksheets.add(sheetName);
    const rows = analysisTextToRows(analysisText);
    const range = sheet.getRangeByIndexes(0, 0, rows.length, 1);
    range.values = rows;
    range.format.autofitColumns();
    sheet.activate();
    await context.sync();
    return sheetName;
  });
}

// ==================== Word ====================

async function readWordSelection() {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line no-undef
    Word.run(async (context) => {
      const range = context.document.getSelection();
      range.load('text');
      await context.sync();
      resolve(range.text || '');
    }).catch(reject);
  });
}

async function insertWordText(text) {
  // eslint-disable-next-line no-undef
  return Word.run(async (context) => {
    const range = context.document.getSelection();
    // 如果有选中内容则替换，否则在光标处插入
    range.insertText(text, 'Replace');
    await context.sync();
  });
}

// ==================== Excel ====================

async function readExcelSelection() {
  // eslint-disable-next-line no-undef
  return Excel.run(async (context) => {
    const range = context.workbook.getSelectedRange();
    range.load(['values', 'address', 'rowCount', 'columnCount']);
    await context.sync();

    // 将单元格数据转换为 CSV 格式的字符串
    const rows = range.values.map(row =>
      row.map(cell => (cell === null || cell === undefined ? '' : String(cell))).join('\t')
    );
    return `[选中区域: ${range.address}]\n${rows.join('\n')}`;
  });
}

async function insertExcelText(text) {
  // eslint-disable-next-line no-undef
  return Excel.run(async (context) => {
    const range = context.workbook.getSelectedRange();
    range.load(['rowCount', 'columnCount', 'address']);
    await context.sync();

    // 将第一个单元格写入完整文本（如果文本按行分隔则填充多行）
    const lines = text.split('\n').filter(l => l.trim());
    const cellValues = lines.map(line => [line]);
    const targetRange = range.getCell(0, 0).getResizedRange(cellValues.length - 1, 0);
    targetRange.values = cellValues;
    await context.sync();
  });
}

function nextSheetName(usedNames, baseName) {
  if (!usedNames.has(baseName)) return baseName;
  for (let i = 2; i < 100; i += 1) {
    const name = `${baseName} ${i}`;
    if (!usedNames.has(name)) return name;
  }
  return `${baseName} ${Date.now()}`;
}

function analysisTextToRows(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const bodyRows = lines.length ? lines.map(line => [line]) : [['无分析结果']];
  return [
    ['AI 分析报告'],
    [`生成时间：${new Date().toLocaleString('zh-CN')}`],
    [''],
    ...bodyRows,
  ];
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceLiteralText(text, searchText, replacementText) {
  if (!searchText) return { count: 0, text };
  let count = 0;
  const regex = new RegExp(escapeRegExp(searchText), 'gi');
  const nextText = text.replace(regex, () => {
    count += 1;
    return replacementText;
  });
  return { count, text: nextText };
}

function previewLiteralText(text, searchText, replacementText, limit) {
  if (!searchText) return { count: 0, examples: [] };
  const regex = new RegExp(escapeRegExp(searchText), 'gi');
  const examples = [];
  let count = 0;
  let match = regex.exec(text);
  while (match) {
    count += 1;
    if (examples.length < limit) {
      examples.push({
        before: match[0],
        after: replacementText,
      });
    }
    match = regex.exec(text);
  }
  return { count, examples };
}

// ==================== PowerPoint ====================

async function readPptSelection() {
  // eslint-disable-next-line no-undef
  return PowerPoint.run(async (context) => {
    // PowerPointApi 1.5+ 支持读取选中文本
    const textRange = context.presentation.getSelectedTextRange();
    textRange.load('text');
    try {
      await context.sync();
      return textRange.text || '';
    } catch {
      // 未选中任何文本时会抛出异常
      return '';
    }
  });
}

async function insertPptText(text) {
  // PPT API 限制：不能直接操作占位符，改为新建幻灯片并添加文本框
  // eslint-disable-next-line no-undef
  return PowerPoint.run(async (context) => {
    const slides = context.presentation.slides;
    slides.load('items');
    await context.sync();

    // 在末尾新建一张幻灯片
    const newSlide = slides.add();
    await context.sync();

    // 添加一个矩形文本框覆盖幻灯片主要区域
    const shape = newSlide.shapes.addGeometricShape(
      // eslint-disable-next-line no-undef
      PowerPoint.GeometricShapeType.rectangle
    );
    shape.left = 40;
    shape.top = 40;
    shape.width = 840; // 标准 16:9 幻灯片宽约 960，留边距
    shape.height = 460;
    shape.fill.setSolidColor('1a1f36');     // 深色背景，与插件主题一致
    shape.lineFormat.visible = false;
    shape.textFrame.textRange.text = text;
    shape.textFrame.textRange.font.color = 'e2e8f0';
    shape.textFrame.textRange.font.size = 18;
    shape.textFrame.textRange.font.name = 'Microsoft YaHei';
    shape.textFrame.autoSizeSetting =
      // eslint-disable-next-line no-undef
      PowerPoint.ShapeAutoSize.autoSizeShapeToFitText;

    await context.sync();
  });
}
