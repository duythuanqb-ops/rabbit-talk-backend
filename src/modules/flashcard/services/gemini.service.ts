import { Injectable, Logger } from '@nestjs/common';
import config from '../../../config';

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

export interface ExamQuestion {
  word: string;
  type: 'synonym' | 'matching' | 'listening' | 'spelling' | 'situation';
  question_text: string;
  options: string[] | null;
  correct_answer: string;
}

const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

const JSON_GENERATION_CONFIG = { responseMimeType: 'application/json' };

const OCR_TEXT_PROMPT = (
  text: string,
) => `You are an expert English lexicographer, OCR post-processing engineer, and a meticulous quality checker.
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

const EXAM_QUESTIONS_PROMPT = (
  items: string[],
) => `You are an expert English language assessment designer and lexicographer.
Your task is to generate high-quality exam questions for the following list of English vocabulary words:
${JSON.stringify(items)}

First, you MUST generate EXACTLY ONE question of type "matching" containing matching pairs for all the words in the entire list.
Second, for EACH AND EVERY word in the list, you MUST generate EXACTLY THREE exam questions, one for each of the following three types (listening, spelling, situation):

1. Type "matching":
   - word: A comma-separated string of all the words in the list (e.g. "adopt, biography, devote").
   - question_text: "Nối từ tiếng Anh với từ đồng nghĩa tiếng Anh (Cambridge synonym) phù hợp:"
   - options: An array containing exactly the synonyms of all the words in the list, SHUFFLED randomly.
   - correct_answer: A stringified JSON object mapping each exact word in the list to its exact synonym option (e.g. "{\\"adopt\\":\\"take in\\",\\"biography\\":\\"life story\\",\\"devote\\":\\"dedicate\\"}").

2. Type "listening":
   - question_text: "Nghe phát âm và chọn từ viết đúng chính tả:"
   - options: An array of 4 strings. One correct spelling (the word itself), and 3 plausible but incorrect/misspelled spelling variations of the word.
   - correct_answer: The correct spelling of the word (exactly matching the 'word' field).

3. Type "spelling":
   - question_text: The Vietnamese translation/meaning of the English word enclosed in curly quotes followed by ' → ______'. Format: "“[Vietnamese meaning/definition]” → ______". Do not include any english spelling hints, parts of speech, or first letters in question_text.
   - options: null (spelling is a write-in question).
   - correct_answer: The correct spelling of the word (exactly matching the 'word' field).

4. Type "situation":
   - question_text: A short English situation, scenario, or question describing a context, followed by a question that leads to the target word. Format: "[Short English situation/scenario describing a context]. How do you feel?" or similar context questions. Do not use blank underscores "________".
   - options: An array of 4 strings. One correct answer (the word itself), and 3 other plausible but incorrect English words of the same part of speech that represent different emotions, actions, or properties in that context.
   - correct_answer: The correct word (exactly matching the 'word' field).

Rules:
- All question_text strings must be in clear Vietnamese (except the English situation descriptions/questions in situation questions).
- Return ONLY a valid JSON array of objects. Do not wrap it in markdown code blocks.
- The format must be exactly:
[
  {
    "word": "adopt, biography",
    "type": "matching",
    "question_text": "Nối từ tiếng Anh với từ đồng nghĩa tiếng Anh (Cambridge synonym) phù hợp:",
    "options": ["life story", "take in"],
    "correct_answer": "{\\"adopt\\":\\"take in\\",\\"biography\\":\\"life story\\"}"
  },
  {
    "word": "adopt",
    "type": "listening",
    "question_text": "Nghe phát âm và chọn từ viết đúng chính tả:",
    "options": ["adopt", "addopt", "adobpt", "adoppt"],
    "correct_answer": "adopt"
  },
  {
    "word": "adopt",
    "type": "spelling",
    "question_text": "“nhận nuôi” → ______",
    "options": null,
    "correct_answer": "adopt"
  },
  {
    "word": "adopt",
    "type": "situation",
    "question_text": "A family wants to bring an orphan child into their home and legally raise them as their own. What do they want to do?",
    "options": ["adopt", "adapt", "abandon", "adore"],
    "correct_answer": "adopt"
  }
]
`;

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly apiKey = config.gemini.apiKey;

  async parseOcrText(text: string): Promise<string[]> {
    if (!text?.trim()) return [];

    if (!this.apiKey) {
      this.logger.error('GEMINI_API_KEY is not configured');
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    this.logger.log('Starting OCR text parse via Gemini API');

    const prompt = OCR_TEXT_PROMPT(text);
    const words = await this.tryModels<string[]>((model) =>
      this.callGeminiText(model, prompt),
    );

    if (words) {
      this.logger.log(`Gemini extracted ${words.length} words from OCR text`);
      return words.filter((w) => w.length > 0 && !/[a-zA-Z]+[0-9]+/.test(w));
    }

    throw new Error('All Gemini models failed to parse OCR text');
  }

  async parseImageWithVision(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    const imageBase64 = imageBuffer.toString('base64');
    this.logger.log('Starting Vision parse via Gemini API');

    const words = await this.tryModels<string[]>((model) =>
      this.callGeminiVision(model, OCR_IMAGE_PROMPT, imageBase64, mimeType),
    );

    if (!words) {
      throw new Error('All Gemini Vision models failed');
    }

    this.logger.log(`Vision extracted ${words.length} words`);
    return words.filter((w) => w.length > 0);
  }

  async generateExamQuestions(items: string[]): Promise<ExamQuestion[]> {
    if (!items || items.length === 0) return [];

    if (!this.apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY is not configured for generateExamQuestions — returning empty',
      );
      return [];
    }

    this.logger.log(
      `Starting exam question generation for ${items.length} words via Gemini API`,
    );

    const prompt = EXAM_QUESTIONS_PROMPT(items);
    const questions = await this.tryModels<ExamQuestion[]>((model) =>
      this.callGeminiQuestions(model, prompt),
    );

    if (questions) {
      this.logger.log(`Gemini generated ${questions.length} exam questions`);
      return questions;
    }

    this.logger.warn('All Gemini models failed to generate exam questions');
    return [];
  }

  private async tryModels<T>(
    callFn: (model: string) => Promise<T | null>,
  ): Promise<T | null> {
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

  private async callGeminiJson(
    model: string,
    body: object,
    logTag = '',
  ): Promise<unknown> {
    const url = buildGeminiUrl(model, this.apiKey);
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      this.logger.warn(
        `Model ${model} returned ${res.status}${logTag ? ` (${logTag})` : ''}`,
      );
      return null;
    }
    return res.json();
  }

  private async callGeminiText(
    model: string,
    prompt: string,
  ): Promise<string[] | null> {
    const data = await this.callGeminiJson(model, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: JSON_GENERATION_CONFIG,
    });
    if (!data) return null;
    return this.extractWordsFromResponse(model, data);
  }

  private async callGeminiVision(
    model: string,
    prompt: string,
    imageBase64: string,
    mimeType: string,
  ): Promise<string[] | null> {
    const data = await this.callGeminiJson(
      model,
      {
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: JSON_GENERATION_CONFIG,
      },
      'vision',
    );
    if (!data) return null;
    return this.extractWordsFromResponse(model, data);
  }

  private async callGeminiQuestions(
    model: string,
    prompt: string,
  ): Promise<ExamQuestion[] | null> {
    const data = await this.callGeminiJson(model, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: JSON_GENERATION_CONFIG,
    });
    if (!data) return null;
    return this.extractQuestionsFromResponse(model, data);
  }

  private extractWordsFromResponse(
    model: string,
    data: unknown,
  ): string[] | null {
    const text = (
      data as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    )?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      this.logger.warn(`Model ${model}: empty response body`);
      return null;
    }
    try {
      const parsed = JSON.parse(text.trim()) as
        | Record<string, unknown>
        | unknown[];
      if (Array.isArray(parsed)) {
        return parsed.map((w: unknown) => String(w).trim());
      }
    } catch {
      this.logger.warn(`Model ${model}: failed to parse JSON response`);
    }
    return null;
  }

  private extractQuestionsFromResponse(
    model: string,
    data: unknown,
  ): ExamQuestion[] | null {
    const text = (
      data as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    )?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      this.logger.warn(`Model ${model}: empty response body for questions`);
      return null;
    }
    try {
      const parsed = JSON.parse(text.trim()) as
        | Record<string, unknown>
        | unknown[];
      if (Array.isArray(parsed)) {
        return parsed.map((q: Record<string, unknown>) => ({
          word: typeof q.word === 'string' ? q.word.trim() : '',
          type: (typeof q.type === 'string' ? q.type.trim() : 'synonym') as
            | 'synonym'
            | 'matching'
            | 'listening'
            | 'spelling'
            | 'situation',
          question_text:
            typeof q.question_text === 'string' ? q.question_text.trim() : '',
          options: Array.isArray(q.options)
            ? q.options.map((o: unknown) =>
                typeof o === 'string' ? o.trim() : String(o),
              )
            : null,
          correct_answer:
            typeof q.correct_answer === 'string' ? q.correct_answer.trim() : '',
        }));
      }
    } catch {
      this.logger.warn(
        `Model ${model}: failed to parse questions JSON response`,
      );
    }
    return null;
  }

  async lookupPhrase(phrase: string): Promise<{
    phonetic: string;
    meaning: string;
    exampleSentence: string;
  } | null> {
    if (!this.apiKey) {
      this.logger.error('GEMINI_API_KEY is not configured for lookupPhrase');
      return null;
    }

    const prompt = `You are a professional English-Vietnamese lexicographer.
Your task is to analyze the English phrase/idiom/collocation/sentence: "${phrase.replace(/"/g, '\\"')}" and generate:
1. A standard IPA phonetic transcription (e.g. /rɪˈzɪs.təns wɔːr/).
2. A natural, concise Vietnamese translation/meaning.
3. A short, natural English example sentence using this phrase.

Return ONLY a valid JSON object with the following fields: "phonetic", "meaning", "exampleSentence". Do not wrap it in markdown code blocks.
Example:
{
  "phonetic": "/rɪˈzɪs.təns wɔː/",
  "meaning": "cuộc kháng chiến",
  "exampleSentence": "The historical museum displays relics from the national resistance war."
}`;

    const quickModels = GEMINI_MODELS;

    for (const model of quickModels) {
      try {
        const result = await this.callGeminiPhrase(model, prompt);
        if (result !== null) return result;
      } catch (e: unknown) {
        this.logger.warn(
          `Model ${model} threw during fast phrase lookup: ${(e as Error).message}`,
        );
      }
    }

    return null;
  }

  private async callGeminiPhrase(
    model: string,
    prompt: string,
  ): Promise<{
    phonetic: string;
    meaning: string;
    exampleSentence: string;
  } | null> {
    const url = buildGeminiUrl(model, this.apiKey);

    const res = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: JSON_GENERATION_CONFIG,
        }),
      },
      0,
    );

    if (!res.ok) {
      this.logger.warn(
        `Model ${model} returned ${res.status} for phrase lookup`,
      );
      return null;
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const text = raw ? String(raw) : '';
    if (!text) return null;

    try {
      const parsed = JSON.parse(text.trim()) as unknown;
      const p = parsed as Record<string, unknown>;
      return {
        phonetic: typeof p.phonetic === 'string' ? p.phonetic.trim() : '',
        meaning: typeof p.meaning === 'string' ? p.meaning.trim() : '',
        exampleSentence:
          typeof p.exampleSentence === 'string' ? p.exampleSentence.trim() : '',
      };
    } catch {
      this.logger.warn(`Model ${model}: failed to parse phrase lookup JSON`);
      return null;
    }
  }
}
