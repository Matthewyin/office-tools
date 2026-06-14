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
