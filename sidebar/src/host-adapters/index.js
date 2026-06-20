import { excelAdapter } from './excel-adapter.js';
import { officeAdapter } from './office-adapter.js';
import { pptAdapter } from './ppt-adapter.js';
import { wordAdapter } from './word-adapter.js';

const HOST_ADAPTERS = {
  word: wordAdapter,
  excel: excelAdapter,
  ppt: pptAdapter,
  office: officeAdapter,
};

export function getHostAdapter(mode) {
  return HOST_ADAPTERS[mode] || officeAdapter;
}

export {
  excelAdapter,
  officeAdapter,
  pptAdapter,
  wordAdapter,
};
