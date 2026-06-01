import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { GeminiService } from './services/gemini.service';
import { DictionaryService } from './services/dictionary.service';

@Injectable()
export class FlashcardService {
  constructor(
    private readonly db: DatabaseService,
    private readonly gemini: GeminiService,
    private readonly dictionary: DictionaryService,
  ) {}

  // ---------------------------------------------------------------------------
  // OCR / AI parsing — delegated to GeminiService
  // ---------------------------------------------------------------------------

  parseOcrText(text: string): Promise<string[]> {
    return this.gemini.parseOcrText(text);
  }

  parseImageWithVision(
    imageBuffer: Buffer,
    mimeType: string,
  ): Promise<string[]> {
    return this.gemini.parseImageWithVision(imageBuffer, mimeType);
  }

  // ---------------------------------------------------------------------------
  // Flashcard Sets
  // ---------------------------------------------------------------------------

  async getSetsByGroupId(groupId: string) {
    const sql = `
      SELECT f.id, f.title, f.description, f.created_at, u.first_name, u.last_name,
        (SELECT COUNT(*) FROM flashcards WHERE set_id = f.id) as card_count
      FROM flashcard_sets f
      JOIN users u ON f.teacher_id = u.uuid
      WHERE f.group_id = ?
      ORDER BY f.created_at DESC
    `;
    return this.db.query(sql, [groupId]);
  }

  async getMySets(userId: string, role: string) {
    if (role === 'teacher') {
      const sql = `
        SELECT f.id, f.title, f.description, f.is_published, f.created_at,
               g.title as group_name, f.group_id,
               (SELECT COUNT(*) FROM flashcards WHERE set_id = f.id) as card_count
        FROM flashcard_sets f
        JOIN \`groups\` g ON f.group_id = g.id
        WHERE f.teacher_id = ?
        ORDER BY f.created_at DESC
      `;
      return this.db.query(sql, [userId]);
    }

    const sql = `
      SELECT f.id, f.title, f.description, f.is_published, f.created_at,
             g.title as group_name, f.group_id,
             u.first_name as teacher_first, u.last_name as teacher_last,
             (SELECT COUNT(*) FROM flashcards WHERE set_id = f.id) as card_count,
             (
               SELECT COUNT(*) FROM student_flashcard_progress p
               JOIN flashcards fc ON p.flashcard_id = fc.id
               WHERE fc.set_id = f.id AND p.student_id = ? AND p.status = 'mastered'
             ) as mastered_count
      FROM flashcard_sets f
      JOIN \`groups\` g ON f.group_id = g.id
      JOIN group_members m ON m.group_id = g.id
      JOIN users u ON f.teacher_id = u.uuid
      WHERE m.user_id = ? AND f.is_published = 1
      ORDER BY f.created_at DESC
    `;
    return this.db.query(sql, [userId, userId]);
  }

  async createSet(
    teacherId: string,
    groupId: string,
    title: string,
    description: string,
  ) {
    const id = randomUUID();
    await this.db.execute(
      `INSERT INTO flashcard_sets (id, group_id, teacher_id, title, description) VALUES (?, ?, ?, ?, ?)`,
      [id, groupId, teacherId, title, description],
    );
    return { id, title, description };
  }

  async updateSet(setId: string, title: string, description: string) {
    await this.db.execute(
      `UPDATE flashcard_sets SET title = ?, description = ? WHERE id = ?`,
      [title, description, setId],
    );
    return { id: setId, title, description };
  }

  async deleteSet(setId: string) {
    // Delete cascade: progress → cards → set
    await this.db.execute(
      `DELETE p FROM student_flashcard_progress p
       JOIN flashcards f ON p.flashcard_id = f.id
       WHERE f.set_id = ?`,
      [setId],
    );
    await this.db.execute(`DELETE FROM flashcards WHERE set_id = ?`, [setId]);
    await this.db.execute(`DELETE FROM flashcard_sets WHERE id = ?`, [setId]);
    return { success: true };
  }

  async updatePublishStatus(setId: string, isPublished: boolean) {
    await this.db.execute(
      `UPDATE flashcard_sets SET is_published = ? WHERE id = ?`,
      [isPublished ? 1 : 0, setId],
    );
    return { id: setId, is_published: isPublished };
  }

  // ---------------------------------------------------------------------------
  // Flashcards (individual cards)
  // ---------------------------------------------------------------------------

  async getCardsForSet(setId: string, studentId: string) {
    const sql = `
      SELECT f.*, COALESCE(p.status, 'learning') as status
      FROM flashcards f
      LEFT JOIN student_flashcard_progress p
        ON f.id = p.flashcard_id AND p.student_id = ?
      WHERE f.set_id = ?
    `;
    return this.db.query(sql, [studentId, setId]);
  }

  async addFlashcard(setId: string, word: string) {
    const {
      phonetic,
      partOfSpeech,
      meaning,
      synonyms,
      exampleSentence,
      audioUrl,
    } = await this.dictionary.lookup(word);

    const id = randomUUID();
    await this.db.execute(
      `INSERT INTO flashcards (id, set_id, word, phonetic, part_of_speech, meaning, synonyms, example_sentence, audio_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        setId,
        word,
        phonetic,
        partOfSpeech,
        meaning,
        synonyms,
        exampleSentence,
        audioUrl,
      ],
    );

    return {
      id,
      set_id: setId,
      word,
      phonetic,
      part_of_speech: partOfSpeech,
      meaning,
      synonyms,
      example_sentence: exampleSentence,
      audio_url: audioUrl,
    };
  }

  async updateFlashcard(
    cardId: string,
    word: string,
    phonetic: string,
    partOfSpeech: string,
    meaning: string,
    synonyms: string,
    exampleSentence: string,
  ) {
    await this.db.execute(
      `UPDATE flashcards
       SET word = ?, phonetic = ?, part_of_speech = ?, meaning = ?, synonyms = ?, example_sentence = ?
       WHERE id = ?`,
      [
        word,
        phonetic,
        partOfSpeech,
        meaning,
        synonyms,
        exampleSentence,
        cardId,
      ],
    );
    return {
      id: cardId,
      word,
      phonetic,
      part_of_speech: partOfSpeech,
      meaning,
      synonyms,
      example_sentence: exampleSentence,
    };
  }

  async deleteFlashcard(cardId: string) {
    await this.db.execute(`DELETE FROM flashcards WHERE id = ?`, [cardId]);
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Student progress
  // ---------------------------------------------------------------------------

  async updateProgress(
    studentId: string,
    flashcardId: string,
    status: 'learning' | 'mastered',
  ) {
    const id = randomUUID();
    await this.db.execute(
      `INSERT INTO student_flashcard_progress (id, student_id, flashcard_id, status)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), last_reviewed_at = CURRENT_TIMESTAMP`,
      [id, studentId, flashcardId, status],
    );
    return { success: true, status };
  }
}
