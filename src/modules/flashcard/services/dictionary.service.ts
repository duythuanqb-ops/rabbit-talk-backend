import { Injectable, Logger } from '@nestjs/common';
import config from '../../../config';

export interface FlashcardLookupResult {
  phonetic: string;
  partOfSpeech: string;
  meaning: string;
  synonyms: string;
  exampleSentence: string;
  audioUrl: string;
}

@Injectable()
export class DictionaryService {
  private readonly logger = new Logger(DictionaryService.name);

  /**
   * Build a complete FlashcardLookupResult for a given English word.
   * Priority:
   *   1. Oxford Dictionary API (if credentials are configured)
   *   2. Free Dictionary API
   *   3. Oxford Learners website scrape (phonetics / audio only)
   */
  async lookup(word: string): Promise<FlashcardLookupResult> {
    const result: FlashcardLookupResult = {
      phonetic: '',
      partOfSpeech: '',
      meaning: '',
      synonyms: '',
      exampleSentence: '',
      audioUrl: '',
    };

    const { appId, appKey } = config.oxford;
    let fetchedFromOxford = false;

    // 1. Oxford Dictionary API
    if (appId && appKey) {
      fetchedFromOxford = await this.tryOxfordApi(word, result);
    }

    // 2. Free Dictionary API fallback
    if (!fetchedFromOxford) {
      await this.tryFreeDictionary(word, result);
    }

    if (!result.meaning) {
      this.logger.warn(`"${word}" not found in any dictionary — will save without meaning`);
    }

    // 3. Always attempt Oxford Learners scrape to upgrade phonetics / audio
    await this.tryOxfordLearnersScrape(word, result);

    return result;
  }

  // ---------------------------------------------------------------------------
  // Private: Oxford Dictionary API
  // ---------------------------------------------------------------------------

  private async tryOxfordApi(word: string, result: FlashcardLookupResult): Promise<boolean> {
    const { appId, appKey } = config.oxford;
    try {
      this.logger.log(`Fetching from Oxford Dictionary API for: ${word}`);
      const res = await fetch(
        `https://od-api.oxforddictionaries.com/api/v2/entries/en-gb/${encodeURIComponent(word.toLowerCase())}`,
        { headers: { app_id: appId, app_key: appKey } },
      );

      if (!res.ok) {
        this.logger.log(`Oxford API responded with status ${res.status} for "${word}"`);
        return false;
      }

      const data: any = await res.json();
      const lexicalEntry = data?.results?.[0]?.lexicalEntries?.[0];
      if (!lexicalEntry) return false;

      result.partOfSpeech = lexicalEntry.lexicalCategory?.id ?? '';
      const mainEntry = lexicalEntry.entries?.[0];
      if (!mainEntry) return false;

      // Pronunciation
      const pron =
        mainEntry.pronunciations?.find((p: any) => p.phoneticSpelling && p.audioFile) ??
        mainEntry.pronunciations?.[0];
      if (pron) {
        result.phonetic = pron.phoneticSpelling ? `/${pron.phoneticSpelling}/` : '';
        result.audioUrl = pron.audioFile ?? '';
      }

      // Best sense: prefer one that has both a definition and an example
      const bestSense =
        mainEntry.senses?.find((s: any) => s.definitions?.length && s.examples?.length) ??
        mainEntry.senses?.[0];

      if (bestSense) {
        const engDef = bestSense.definitions?.[0] ?? '';
        result.exampleSentence = bestSense.examples?.[0]?.text ?? '';
        result.synonyms = (bestSense.synonyms?.slice(0, 4) ?? [])
          .map((s: any) => s.text)
          .join(', ');
        if (engDef) {
          result.meaning = (await this.translateToVietnamese(word)) || engDef;
        }
      }

      this.logger.log(`Oxford Dictionary API: extraction successful for "${word}"`);
      return true;
    } catch (e: unknown) {
      this.logger.log(`Oxford Dictionary API error for "${word}": ${(e as Error).message}`);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Free Dictionary API
  // ---------------------------------------------------------------------------

  private async tryFreeDictionary(word: string, result: FlashcardLookupResult): Promise<void> {
    try {
      this.logger.log(`Fetching from Free Dictionary API for: ${word}`);
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      );
      if (!res.ok) return;

      const data: any = await res.json();
      const entry = data?.[0];
      if (!entry) return;

      // Phonetics
      const phoneticObj =
        entry.phonetics?.find((p: any) => p.text && p.audio) ?? entry.phonetics?.[0];
      result.phonetic = phoneticObj?.text ?? entry.phonetic ?? '';
      result.audioUrl = phoneticObj?.audio ?? '';

      // Synonyms (deep search)
      const allSynonyms = new Set<string>();
      for (const m of entry.meanings ?? []) {
        for (const syn of m.synonyms ?? []) allSynonyms.add(syn);
        for (const def of m.definitions ?? []) {
          for (const syn of def.synonyms ?? []) allSynonyms.add(syn);
        }
      }
      result.synonyms = Array.from(allSynonyms).slice(0, 4).join(', ');

      // Best definition + example (prefer definition that has an example)
      let bestDef = '';
      let bestExample = '';
      outer: for (const m of entry.meanings ?? []) {
        for (const d of m.definitions ?? []) {
          if (d.definition && d.example) {
            bestDef = d.definition;
            bestExample = d.example;
            result.partOfSpeech = m.partOfSpeech ?? '';
            break outer;
          }
        }
      }
      if (!bestDef) {
        const firstM = entry.meanings?.[0];
        result.partOfSpeech = firstM?.partOfSpeech ?? '';
        bestDef = firstM?.definitions?.[0]?.definition ?? '';
        bestExample = firstM?.definitions?.[0]?.example ?? '';
      }

      if (bestDef) {
        result.exampleSentence = bestExample;
        result.meaning = (await this.translateToVietnamese(word)) || bestDef;
      }
    } catch (e: unknown) {
      this.logger.log(`Free Dictionary API error for "${word}": ${(e as Error).message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Oxford Learners scrape (phonetics / audio upgrade)
  // ---------------------------------------------------------------------------

  private async tryOxfordLearnersScrape(
    word: string,
    result: FlashcardLookupResult,
  ): Promise<void> {
    // Skip scraping for multi-word phrases (idioms, proper nouns, phrasal verbs)
    // Oxford Learners won't have entries for them and the request will just stall.
    const wordCount = word.trim().split(/\s+/).length;
    if (wordCount > 2) return;

    try {
      const url = `https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(word.toLowerCase())}`;

      // 5-second timeout to prevent hanging batch imports
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

      const phonMatch = html.match(/<span class="phon">([^<]+)<\/span>/);
      if (phonMatch) result.phonetic = phonMatch[1];

      const audioMatch = html.match(/data-src-mp3="([^"]+)"/);
      if (audioMatch) result.audioUrl = audioMatch[1];
    } catch (e: unknown) {
      this.logger.log(`Oxford Learners scrape failed for "${word}": ${(e as Error).message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Google Translate (vi)
  // ---------------------------------------------------------------------------

  private async translateToVietnamese(text: string): Promise<string> {
    if (!text) return '';
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data?.[0]) {
          return data[0].map((item: any) => item[0]).join('').trim();
        }
      }
    } catch (e: unknown) {
      this.logger.log(`Translation error for "${text}": ${(e as Error).message}`);
    }
    return '';
  }
}
