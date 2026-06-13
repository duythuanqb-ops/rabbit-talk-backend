import { Injectable, Logger } from '@nestjs/common';
import { UploadService } from '../../upload/upload.service';
import { EdgeTTS } from '@andresaya/edge-tts';
import { GeminiService } from './gemini.service';

export interface FlashcardLookupResult {
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  synonyms: string;
  exampleSentence: string;
  audioUrl: string;
}

interface DictionaryEntry {
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings?: {
    partOfSpeech?: string;
    synonyms?: string[];
    definitions?: {
      definition?: string;
      example?: string;
      synonyms?: string[];
    }[];
  }[];
}

@Injectable()
export class DictionaryService {
  private readonly logger = new Logger(DictionaryService.name);

  constructor(
    private readonly uploadService: UploadService,
    private readonly geminiService: GeminiService,
  ) {}

  async lookup(word: string): Promise<FlashcardLookupResult> {
    const result: FlashcardLookupResult = {
      phonetic: '',
      partOfSpeech: '',
      meaning: '',
      synonyms: '',
      exampleSentence: '',
      audioUrl: '',
    };

    const wordCount = word.trim().split(/\s+/).length;

    if (wordCount >= 2) {
      this.logger.log(
        `"${word}" has 2 or more words. Using premium Gemini & Microsoft Edge TTS.`,
      );

      const phraseDetails = await this.geminiService.lookupPhrase(word);
      if (phraseDetails) {
        result.phonetic = phraseDetails.phonetic;
        result.meaning = phraseDetails.meaning;
        result.exampleSentence = phraseDetails.exampleSentence;
        result.partOfSpeech = 'phrase';
      } else {
        this.logger.warn(
          `Gemini lookup failed for "${word}" (probably 429). Falling back to free translation & composite phonetics.`,
        );
        result.meaning = await this.translateToVietnamese(word);
        result.phonetic = await this.generatePhrasePhonetic(word);
        result.exampleSentence = `It is important to understand the concept of "${word}".`;
        result.partOfSpeech = 'phrase';
      }

      const audioBuffer = await this.generateEdgeTts(word);
      if (audioBuffer) {
        result.audioUrl = await this.uploadService.uploadAudio(
          audioBuffer,
          `${word}.mp3`,
        );
      } else {
        this.logger.log(
          `Microsoft Edge TTS failed for "${word}" — falling back to legacy Google Translate TTS`,
        );
        result.audioUrl = this.buildGoogleTranslateTtsUrl(word);
      }
    } else {
      await this.tryFreeDictionary(word, result);

      if (!result.meaning) {
        this.logger.warn(
          `"${word}" not found in Free Dictionary — will save without meaning`,
        );
      }

      await this.tryCambridgeScrape(word, result);

      result.audioUrl = '';
      await this.tryOxfordAudio(word, result);

      if (!result.audioUrl) {
        this.logger.log(
          `Oxford audio not found for single word "${word}" — attempting Microsoft Edge TTS fallback`,
        );
        const audioBuffer = await this.generateEdgeTts(word);
        if (audioBuffer) {
          result.audioUrl = await this.uploadService.uploadAudio(
            audioBuffer,
            `${word}.mp3`,
          );
        } else {
          this.logger.log(
            `Microsoft Edge TTS fallback failed for "${word}" — falling back to Google Translate TTS`,
          );
          result.audioUrl = this.buildGoogleTranslateTtsUrl(word);
        }
      }
    }

    return result;
  }

  private async tryFreeDictionary(
    word: string,
    result: FlashcardLookupResult,
  ): Promise<void> {
    try {
      this.logger.log(`Fetching from Free Dictionary API for: ${word}`);
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      );
      if (!res.ok) return;

      const data = (await res.json()) as DictionaryEntry[];
      const entry = data?.[0];
      if (!entry) return;

      const phoneticObj =
        entry.phonetics?.find((p) => !!(p.text && p.audio)) ??
        entry.phonetics?.[0];
      result.phonetic = phoneticObj?.text
        ? String(phoneticObj.text)
        : entry.phonetic
          ? String(entry.phonetic)
          : '';
      result.audioUrl = phoneticObj?.audio ? String(phoneticObj.audio) : '';

      const allSynonyms = new Set<string>();
      for (const m of entry.meanings ?? []) {
        for (const syn of m.synonyms ?? []) allSynonyms.add(String(syn));
        for (const def of m.definitions ?? []) {
          for (const syn of def.synonyms ?? []) allSynonyms.add(String(syn));
        }
      }
      result.synonyms = Array.from(allSynonyms).slice(0, 4).join(', ');

      let bestDef = '';
      let bestExample = '';
      outer: for (const m of entry.meanings ?? []) {
        for (const d of m.definitions ?? []) {
          if (d.definition && d.example) {
            bestDef = String(d.definition);
            bestExample = String(d.example);
            result.partOfSpeech = (m.partOfSpeech as string) ?? '';
            break outer;
          }
        }
      }
      if (!bestDef) {
        const firstM = entry.meanings?.[0];
        result.partOfSpeech = (firstM?.partOfSpeech as string) ?? '';
        bestDef = firstM?.definitions?.[0]?.definition
          ? String(firstM.definitions[0].definition)
          : '';
        bestExample = firstM?.definitions?.[0]?.example
          ? String(firstM.definitions[0].example)
          : '';
      }

      if (bestDef) {
        result.exampleSentence = bestExample;
        result.meaning = (await this.translateToVietnamese(word)) || bestDef;
      }
    } catch (e: unknown) {
      this.logger.error(
        `Free Dictionary API error for "${word}": ${(e as Error).message}`,
      );
    }
  }

  private async tryCambridgeScrape(
    word: string,
    result: FlashcardLookupResult,
  ): Promise<void> {
    const wordCount = word.trim().split(/\s+/).length;
    if (wordCount > 2) return;

    try {
      const url = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word.toLowerCase())}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) return;

      const html = await res.text();

      const ipaMatch = html.match(/class="ipa[^"]*"[^>]*>([\s\S]*?)<\/span>/);
      if (ipaMatch) {
        result.phonetic = `/${ipaMatch[1].trim()}/`;
      }
    } catch (e: unknown) {
      this.logger.error(
        `Cambridge scrape failed for "${word}": ${(e as Error).message}`,
      );
    }
  }

  private async tryOxfordAudio(
    word: string,
    result: FlashcardLookupResult,
  ): Promise<void> {
    const wordCount = word.trim().split(/\s+/).length;
    if (wordCount > 3) return;

    const base = word.toLowerCase().trim();
    const uniqueSlugs = [
      ...new Set([
        base.replace(/\s+/g, '-'),
        base.replace(/\s+/g, '_'),
        encodeURIComponent(base),
      ]),
    ];

    for (const slug of uniqueSlugs) {
      const found = await this.tryOxfordSlug(word, slug, result);
      if (found) return;
    }
  }

  private async tryOxfordSlug(
    word: string,
    slug: string,
    result: FlashcardLookupResult,
  ): Promise<boolean> {
    try {
      this.logger.log(
        `Scraping Oxford Learner's Dictionary audio for: ${word} (slug: ${slug})`,
      );
      const url = `https://www.oxfordlearnersdictionaries.com/definition/english/${slug}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://www.oxfordlearnersdictionaries.com/',
        },
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        this.logger.log(`Oxford slug "${slug}" returned HTTP ${res.status}`);
        return false;
      }

      const html = await res.text();

      const ukMatch =
        html.match(/class="[^"]*pron-uk[^"]*"[^>]*data-src-mp3="([^"]+)"/) ||
        html.match(/data-src-mp3="([^"]+)"[^>]*class="[^"]*pron-uk[^"]*"/);
      if (ukMatch) {
        let audio = ukMatch[1];
        if (audio.startsWith('/')) {
          audio = 'https://www.oxfordlearnersdictionaries.com' + audio;
        }
        result.audioUrl = audio;
        this.logger.log(
          `Found Oxford UK audio for "${word}" (slug: ${slug}): ${audio}`,
        );
        return true;
      }

      const usMatch =
        html.match(/class="[^"]*pron-us[^"]*"[^>]*data-src-mp3="([^"]+)"/) ||
        html.match(/data-src-mp3="([^"]+)"[^>]*class="[^"]*pron-us[^"]*"/);
      if (usMatch) {
        let audio = usMatch[1];
        if (audio.startsWith('/')) {
          audio = 'https://www.oxfordlearnersdictionaries.com' + audio;
        }
        result.audioUrl = audio;
        this.logger.log(
          `Found Oxford US audio for "${word}" (slug: ${slug}): ${audio}`,
        );
        return true;
      }

      const anyMp3Match = html.match(/data-src-mp3="([^"]+)"/);
      if (anyMp3Match) {
        let audio = anyMp3Match[1];
        if (audio.startsWith('/')) {
          audio = 'https://www.oxfordlearnersdictionaries.com' + audio;
        }
        result.audioUrl = audio;
        this.logger.log(
          `Found Oxford generic audio for "${word}" (slug: ${slug}): ${audio}`,
        );
        return true;
      }

      this.logger.log(`No audio found on Oxford page for slug: ${slug}`);
      return false;
    } catch (e: unknown) {
      this.logger.error(
        `Oxford scrape failed for slug "${slug}": ${(e as Error).message}`,
      );
      return false;
    }
  }

  private buildGoogleTranslateTtsUrl(word: string): string {
    const encoded = encodeURIComponent(word);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=en&client=tw-ob`;
    this.logger.log(`Built Google Translate TTS URL for "${word}": ${url}`);
    return url;
  }

  private async translateToVietnamese(text: string): Promise<string> {
    if (!text) return '';
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as unknown[][][];
        if (data?.[0]) {
          return data[0]
            .map((item: unknown[]) => String(item[0]))
            .join('')
            .trim();
        }
      }
    } catch (e: unknown) {
      this.logger.error(
        `Translation error for "${text}": ${(e as Error).message}`,
      );
    }
    return '';
  }

  private async generateEdgeTts(text: string): Promise<Buffer | null> {
    try {
      this.logger.log(
        `Requesting Microsoft Edge TTS (en-US-AriaNeural) for: "${text}"`,
      );
      const tts = new EdgeTTS();
      await tts.synthesize(text, 'en-US-AriaNeural');
      const buffer = tts.toBuffer();
      return buffer;
    } catch (e: unknown) {
      this.logger.error(
        `Microsoft Edge TTS generation failed: ${(e as Error).message}`,
      );
      return null;
    }
  }

  private async generatePhrasePhonetic(phrase: string): Promise<string> {
    const words = phrase.trim().split(/\s+/);
    const phonetics: string[] = [];

    for (const w of words) {
      const cleanWord = w
        .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '')
        .toLowerCase();
      if (!cleanWord) continue;

      const phonetic = (await this.fetchWordPhonetic(cleanWord)) || cleanWord;
      phonetics.push(phonetic.replace(/^\/|\/$/g, ''));
    }

    return phonetics.length > 0 ? `/${phonetics.join(' ')}/` : '';
  }

  private async fetchWordPhonetic(word: string): Promise<string> {
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as DictionaryEntry[];
        const entry = data?.[0];
        const phoneticObj =
          entry?.phonetics?.find((p) => !!(p.text && p.audio)) ??
          entry?.phonetics?.[0];
        const text = String(phoneticObj?.text || entry?.phonetic || '');
        if (text) return text;
      }
    } catch (e: unknown) {
      this.logger.error(
        `Free Dictionary phonetic fetch failed for "${word}": ${(e as Error).message}`,
      );
    }

    const tempResult: FlashcardLookupResult = {
      phonetic: '',
      partOfSpeech: '',
      meaning: '',
      synonyms: '',
      exampleSentence: '',
      audioUrl: '',
    };
    await this.tryCambridgeScrape(word, tempResult);
    return tempResult.phonetic;
  }
}
