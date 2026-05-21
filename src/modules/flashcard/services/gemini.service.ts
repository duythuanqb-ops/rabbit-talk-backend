import { Injectable, Logger } from '@nestjs/common';
import config from '../../../config';
import { localOcrParser } from '../utils/ocr-parser.util';

// ---------------------------------------------------------------------------
// Internal HTTP helpers
// ---------------------------------------------------------------------------

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  initialDelay = 1000,
): Promise<Response> {
  let retries = 0;
  while (true) {
    try {
      const response = await fetch(url, options);
      // Retry only on 5xx or 429; everything else (including 4xx) is returned as-is
      if (response.ok || (response.status < 500 && response.status !== 429)) {
        return response;
      }
      if (retries >= maxRetries) return response;
      retries++;
      const delay = initialDelay * Math.pow(2, retries - 1);
      await sleep(delay);
    } catch (error: unknown) {
      if (retries >= maxRetries) throw error;
      retries++;
      const delay = initialDelay * Math.pow(2, retries - 1);
      await sleep(delay);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildGeminiUrl(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

const GEMINI_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash',
];

const JSON_GENERATION_CONFIG = { responseMimeType: 'application/json' };

// ---------------------------------------------------------------------------
// OCR extraction prompts
// ---------------------------------------------------------------------------

const OCR_TEXT_PROMPT = (text: string) => `You are an expert English lexicographer, OCR post-processing engineer, and a meticulous quality checker.
Your task is to analyze raw OCR text extracted from an English textbook (which contains vocabulary words, phonetics like /.../ or [...], and Vietnamese translations/definitions) and extract an extremely clean, accurate, and 100% complete list of English vocabulary words and phrases.

To achieve 99.9% accuracy, you MUST perform a two-pass analysis:

PASS 1: Extraction
1. Extract ONLY valid English vocabulary words, collocations, or functional phrases/idioms (e.g., "adopt", "biography", "devote to", "pass away", "on cloud nine", "make a difference").
2. DO NOT include phonetic spellings (like /əˈdɒpt/, [biography], /bænd/, etc.).
3. DO NOT include Vietnamese words, definitions, or explanations.
4. DO NOT extract grammatical terms, parts of speech, or abbreviation legends (such as "adj", "adjective", "adv", "adverb", "n", "noun", "np", "noun phrase", "v", "verb") typically found in headers or glossary abbreviation boxes.
5. DO NOT split cohesive multi-word terms, proper nouns, or collocations into single individual words. Keep them intact!
   - Example: "Communist Party of Viet Nam" must remain a single array entry.
   - Example: "resistance war" must remain intact.
6. DO NOT split lists of synonyms/alternatives separated by slashes. Keep them together as a single intact string entry just as they appear in the textbook!
   - Example: "on cloud nine/on top of the world/over the moon" must remain ONE single array entry: "on cloud nine/on top of the world/over the moon".
   - For words with situational parentheses like "attend (school/college)", clean it to its root form "attend".
7. Auto-correct obvious OCR spelling typos (e.g., "marrage" -> "marriage", "enami" -> "enemy").

PASS 2: Self-Verification & Double-Checking (CRITICAL FOR 99.9% ACCURACY)
- Re-scan the entire raw OCR text. For every Vietnamese definition or line showing a translation, check if you have extracted its corresponding English word.
- Ensure no words are skipped, especially short or common words, or words at the margins.
- Verify that every single vocabulary item on the page is represented in your final array.

Return ONLY a valid JSON array of strings. Do not wrap it in markdown code blocks. Example: ["adopt", "biography", "devote to", "pass away"].

Here is the raw OCR text:
"${text.replace(/"/g, '\\"')}"`;

const OCR_IMAGE_PROMPT = `You are an expert English lexicographer and vocabulary extraction specialist.
This image is a photo of a glossary page from an English textbook. The page has English vocabulary words, their phonetic spellings, parts of speech, and Vietnamese translations.

Your task: Extract a 100% complete and accurate list of ALL English vocabulary words and phrases from this glossary.

Rules:
1. Extract ONLY valid English vocabulary words, collocations, idioms, or phrasal verbs.
2. DO NOT include phonetic spellings (e.g., /əˈdɒpt/).
3. DO NOT include Vietnamese translations or definitions.
4. DO NOT include grammatical labels like "adj", "adv", "n", "v", "np", "verb", "noun", etc.
5. Keep multi-word terms and proper nouns intact as a single entry (e.g., "Communist Party of Viet Nam", "resistance war").
6. CRITICAL: When multiple idioms or synonyms appear grouped together on the same glossary line, separated by slashes (e.g., "on cloud nine/on top of the world/over the moon"), treat the ENTIRE slash-separated group as ONE single array entry, exactly as written.
   - Example: "on cloud nine/on top of the world/over the moon" → must be ONE entry: "on cloud nine/on top of the world/over the moon"
   - This ensures the extracted count matches the number of actual glossary entries in the textbook.
7. Clean parenthetical usage hints: "attend (school/college)" → "attend".
8. Include ALL words — do not miss any, including words at the top and bottom of columns.

Return ONLY a valid JSON array of strings. No markdown code blocks.
Example: ["adopt", "biography", "devote to", "pass away"]`;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey = config.gemini.apiKey;

  /**
   * Parse raw OCR text and extract English vocabulary words.
   * Falls back to the local parser if all Gemini models fail.
   */
  async parseOcrText(text: string): Promise<string[]> {
    if (!text?.trim()) return [];

    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY is not configured — using local fallback parser');
      return localOcrParser(text);
    }

    this.logger.log('Starting OCR text parse via Gemini API');

    const prompt = OCR_TEXT_PROMPT(text);
    const words = await this.tryModels((model) =>
      this.callGeminiText(model, prompt),
    );

    if (words) {
      this.logger.log(`Gemini extracted ${words.length} words from OCR text`);
      return words.filter((w) => w.length > 0 && !/[a-zA-Z]+[0-9]+/.test(w));
    }

    // Gemini unavailable — use local fallback
    this.logger.warn('All Gemini models failed. Activating local fallback parser');
    const fallback = localOcrParser(text);
    this.logger.log(`Local fallback extracted ${fallback.length} words`);
    return fallback;
  }

  /**
   * Parse a glossary image and extract vocabulary words via Gemini Vision.
   */
  async parseImageWithVision(imageBuffer: Buffer, mimeType: string): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    const imageBase64 = imageBuffer.toString('base64');
    this.logger.log('Starting Vision parse via Gemini API');

    const words = await this.tryModels((model) =>
      this.callGeminiVision(model, OCR_IMAGE_PROMPT, imageBase64, mimeType),
    );

    if (!words) {
      throw new Error('All Gemini Vision models failed');
    }

    this.logger.log(`Vision extracted ${words.length} words`);
    return words.filter((w) => w.length > 0);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Try each model in order, return parsed string[] on first success or null. */
  private async tryModels(
    callFn: (model: string) => Promise<string[] | null>,
  ): Promise<string[] | null> {
    for (const model of GEMINI_MODELS) {
      try {
        const result = await callFn(model);
        if (result !== null) return result;
      } catch (e: unknown) {
        this.logger.warn(`Model ${model} threw: ${(e as Error).message}`);
      }
    }
    return null;
  }

  private async callGeminiText(model: string, prompt: string): Promise<string[] | null> {
    const url = buildGeminiUrl(model, this.apiKey);
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: JSON_GENERATION_CONFIG,
      }),
    });

    if (!res.ok) {
      this.logger.warn(`Model ${model} returned ${res.status}`);
      return null;
    }
    return this.extractWordsFromResponse(model, await res.json());
  }

  private async callGeminiVision(
    model: string,
    prompt: string,
    imageBase64: string,
    mimeType: string,
  ): Promise<string[] | null> {
    const url = buildGeminiUrl(model, this.apiKey);
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ],
        }],
        generationConfig: JSON_GENERATION_CONFIG,
      }),
    });

    if (!res.ok) {
      this.logger.warn(`Vision model ${model} returned ${res.status}`);
      return null;
    }
    return this.extractWordsFromResponse(model, await res.json());
  }

  private extractWordsFromResponse(model: string, data: unknown): string[] | null {
    const text = (data as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      this.logger.warn(`Model ${model}: empty response body`);
      return null;
    }
    try {
      const parsed = JSON.parse(text.trim());
      if (Array.isArray(parsed)) {
        return parsed.map((w: unknown) => String(w).trim());
      }
    } catch {
      this.logger.warn(`Model ${model}: failed to parse JSON response`);
    }
    return null;
  }
}
