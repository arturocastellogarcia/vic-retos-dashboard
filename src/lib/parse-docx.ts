// Wrapper que extrae texto crudo de un .docx (mammoth) y lo pasa al parser.
import mammoth from 'mammoth';
import { parseFichaText, type ParsedFicha } from './parser';

export interface ParsedFichaWithRaw extends ParsedFicha {
  rawText: string;
}

export async function parseFichaDocx(buffer: Buffer): Promise<ParsedFichaWithRaw> {
  const result = await mammoth.extractRawText({ buffer });
  const rawText = result.value;
  const parsed = parseFichaText(rawText);
  return { ...parsed, rawText };
}
