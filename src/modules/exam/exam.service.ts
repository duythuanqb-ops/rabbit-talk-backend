import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { GeminiService } from '../flashcard/services/gemini.service';
import { DictionaryService } from '../flashcard/services/dictionary.service';
import { v4 as uuidv4 } from 'uuid';

export interface ExamQuestion {
  id?: string;
  word: string;
  type: 'matching' | 'synonym' | 'listening' | 'spelling' | 'situation';
  question_text: string;
  options: string[] | null;
  correct_answer: string;
  audio_url?: string | null;
}

export interface Exam {
  id: string;
  group_id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  is_published?: boolean;
  created_at?: string;
  questions: ExamQuestion[];
}

function cleanWord(word: string): string {
  if (!word) return '';
  return word.trim().replace(new RegExp('[.,/#!$%^&*;:{}=\\-_`~()]', 'g'), '');
}

@Injectable()
export class ExamService {
  private readonly logger = new Logger(ExamService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly gemini: GeminiService,
    private readonly dictionary: DictionaryService,
  ) {}

  getProxyAudioUrl(req: any, originalUrl: string | null): string | null {
    if (!originalUrl) return null;
    if (originalUrl.includes('/proxy-audio?url=')) return originalUrl;
    const protocol = (req.protocol as string) || 'http';
    const host = req.get('host') as string;
    return `${protocol}://${host}/api/v1/proxy-audio?url=${encodeURIComponent(originalUrl)}`;
  }

  async lookupWordFromDictionary(word: string) {
    return this.dictionary.lookup(word);
  }

  async generateQuestions(items: string[], req: any): Promise<ExamQuestion[]> {
    let questions: ExamQuestion[] | null = null;
    try {
      questions = await this.gemini.generateExamQuestions(items);
    } catch (e: any) {
      this.logger.warn(
        `Gemini generation failed: ${e.message}. Using backend fallback...`,
      );
    }

    if (!questions || questions.length === 0) {
      this.logger.log(
        'Gemini generation yielded no questions. Generating clean backend fallback questions...',
      );
      questions = await this.generateBackendFallbackQuestions(items);
    }

    for (const q of questions) {
      if (q.type === 'listening' && q.word) {
        try {
          const cleanedWord = cleanWord(q.word);
          const dictRes = await this.dictionary.lookup(cleanedWord);
          if (dictRes && dictRes.audioUrl) {
            q.audio_url = this.getProxyAudioUrl(req, dictRes.audioUrl);
            this.logger.log(
              `Enriched listening question for word "${q.word}" with audioUrl: ${q.audio_url}`,
            );
          }
        } catch (e) {
          this.logger.error(
            `Failed to fetch Oxford audio for word "${q.word}":`,
            e,
          );
        }
      }
    }

    return questions;
  }

  private consolidateMatchingQuestions(
    questions: ExamQuestion[],
  ): ExamQuestion[] {
    const result: ExamQuestion[] = [];
    let existingMatching: ExamQuestion | null = null;

    for (const q of questions) {
      if (q.type === 'matching') {
        if (!existingMatching) {
          existingMatching = { ...q };
          result.push(existingMatching);
        } else {
          try {
            const existingPairs = existingMatching.correct_answer
              ? (JSON.parse(existingMatching.correct_answer) as Record<
                  string,
                  string
                >)
              : {};
            const newPairs = q.correct_answer
              ? (JSON.parse(q.correct_answer) as Record<string, string>)
              : {};
            const mergedPairs: Record<string, string> = {
              ...existingPairs,
              ...newPairs,
            };

            existingMatching.correct_answer = JSON.stringify(mergedPairs);
            existingMatching.word = Object.keys(mergedPairs).join(', ');

            const allOptions = Object.values(mergedPairs);
            existingMatching.options = Array.from(new Set(allOptions)).sort(
              () => Math.random() - 0.5,
            );
          } catch {
            // Keep the first matching card if JSON parse fails
          }
        }
      } else {
        result.push(q);
      }
    }
    return result;
  }

  async generateBackendFallbackQuestions(
    items: string[],
  ): Promise<ExamQuestion[]> {
    const qs: ExamQuestion[] = [];

    // Process single word questions (listening, spelling, situation)
    for (const rawItem of items) {
      const item: any = rawItem;
      try {
        const isObj = typeof item === 'object' && item !== null;
        const word = isObj ? String(item.word || '') : String(item);
        let meaning = isObj ? String(item.meaning || '') : '';
        let example = isObj ? String(item.example_sentence || '') : '';

        if (!word) continue;

        let dictRes: any = null;
        if (!meaning || !example) {
          try {
            dictRes = await this.dictionary.lookup(cleanWord(word));
            if (dictRes) {
              if (!meaning) meaning = dictRes.meaning;
              if (!example) example = dictRes.exampleSentence;
            }
          } catch (e) {
            this.logger.error(
              `Failed to lookup dictionary for backend fallback word "${word}":`,
              e,
            );
          }
        }
        if (!meaning) meaning = word;

        // 1. Matching (handled in chunks after this loop)

        // 2. Listening
        const correct = word;
        const opt1 = word + 'e';
        const opt2 = word.replace(/[aeiou]/g, 'i');
        const opt3 = word + 'y';
        let optionsList = [correct, opt1, opt2, opt3].filter(
          (v, i, a) => a.indexOf(v) === i,
        );
        while (optionsList.length < 4) {
          optionsList.push(word + '-' + optionsList.length);
        }
        optionsList = optionsList.sort(() => Math.random() - 0.5);
        qs.push({
          word,
          type: 'listening',
          question_text: `Nghe phát âm và chọn từ viết đúng chính tả:`,
          options: optionsList,
          correct_answer: correct,
        });

        // 3. Spelling
        qs.push({
          word,
          type: 'spelling',
          question_text: `“${meaning}” → ______`,
          options: null,
          correct_answer: word,
        });

        // 4. Situation — context-based question (no blanks / underscores)
        const questionText = example
          ? `Read the situation: "${example}" — Which word best describes this context?`
          : `Which English word matches this description: "${meaning}"?`;

        // Build distractor pool from other items in the vocabulary list for variety
        const distractorPool = items
          .map((r) =>
            typeof r === 'object' && r !== null
              ? String((r as any).word || '')
              : String(r),
          )
          .filter((w) => w && w.toLowerCase() !== word.toLowerCase());
        const shuffledPool = distractorPool.sort(() => Math.random() - 0.5);
        const distractors =
          shuffledPool.length >= 3
            ? shuffledPool.slice(0, 3)
            : [...shuffledPool, 'lesson', 'school', 'homework'].slice(0, 3);

        let optionsSit = [word, ...distractors];
        optionsSit = optionsSit.sort(() => Math.random() - 0.5);
        qs.push({
          word,
          type: 'situation',
          question_text: questionText,
          options: optionsSit,
          correct_answer: word,
        });
      } catch {
        this.logger.error(
          `Error generating backend fallback question for item: ${item}`,
        );
      }
    }

    // Generate ONE single Matching Question for all items
    const correctAnswerMap: Record<string, string> = {};
    const optionsArr: string[] = [];
    const wordsArr: string[] = [];

    for (const rawItem of items) {
      const item: any = rawItem;
      const isObj = typeof item === 'object' && item !== null;
      const word = isObj ? String(item.word || '') : String(item);
      if (!word) continue;

      let synonym = word + ' (synonym)';
      const rawSynonyms = isObj ? String(item.synonyms || '') : '';

      if (rawSynonyms) {
        const parts = rawSynonyms
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
        if (parts.length > 0) synonym = parts[0];
      } else {
        // If no raw synonyms, try dictionary lookup
        try {
          const dictRes = await this.dictionary.lookup(word);
          if (dictRes && dictRes.synonyms) {
            const parts = dictRes.synonyms
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean);
            if (parts.length > 0) synonym = parts[0];
          }
        } catch (e) {
          this.logger.error(`Failed to fetch synonyms for ${word}`, e);
        }
      }

      correctAnswerMap[word] = synonym;
      optionsArr.push(synonym);
      wordsArr.push(word);
    }

    if (wordsArr.length > 0) {
      const shuffledOptions = [...optionsArr].sort(() => Math.random() - 0.5);
      qs.unshift({
        word: wordsArr.join(', '),
        type: 'matching',
        question_text:
          'Nối từ tiếng Anh với từ đồng nghĩa tiếng Anh (Cambridge synonym) phù hợp:',
        options: shuffledOptions,
        correct_answer: JSON.stringify(correctAnswerMap),
      });
    }

    return qs;
  }

  async createExam(teacherId: string, data: any): Promise<Exam> {
    const {
      groupId,
      title,
      description,
      questions: rawQuestions,
    } = data as {
      groupId: string;
      title: string;
      description?: string;
      questions: ExamQuestion[];
    };
    const questions = this.consolidateMatchingQuestions(rawQuestions || []);
    const groups = await this.db.query(
      'SELECT created_by FROM `groups` WHERE id = ?',
      [groupId],
    );
    if (!groups.length) {
      throw new NotFoundException('Group not found');
    }
    if (groups[0].created_by !== teacherId) {
      throw new ForbiddenException('Only the class teacher can create exams');
    }
    if (!questions || questions.length === 0) {
      throw new BadRequestException('Exam must have at least one question');
    }

    const examId = uuidv4();
    await this.db.execute(
      'INSERT INTO exams (id, group_id, teacher_id, title, description) VALUES (?, ?, ?, ?, ?)',
      [examId, groupId, teacherId, title, description || null],
    );

    for (const q of questions) {
      const questionId = uuidv4();
      const optionsStr = q.options ? JSON.stringify(q.options) : null;
      let rawAudioUrl = q.audio_url || null;

      if (!rawAudioUrl && q.type === 'listening' && q.word) {
        try {
          const cleanedWord = cleanWord(q.word);
          const dictRes = await this.dictionary.lookup(cleanedWord);
          if (dictRes && dictRes.audioUrl) {
            rawAudioUrl = dictRes.audioUrl;
            this.logger.log(
              `Enriched missing audio_url during exam creation for word "${q.word}" with: ${rawAudioUrl}`,
            );
          }
        } catch {
          this.logger.error(
            `Failed to enrich missing audio_url in createExam for "${q.word}"`,
          );
        }
      } else if (rawAudioUrl && rawAudioUrl.includes('/proxy-audio?url=')) {
        try {
          const parsed = new URL(rawAudioUrl);
          const urlParam = parsed.searchParams.get('url');
          if (urlParam) {
            rawAudioUrl = urlParam;
          }
        } catch {
          // Ignore invalid URL parsing
        }
      }

      await this.db.execute(
        `INSERT INTO exam_questions (id, exam_id, word, type, question_text, options, correct_answer, audio_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          questionId,
          examId,
          q.word || '',
          q.type || 'synonym',
          q.question_text || '',
          optionsStr,
          q.correct_answer || '',
          rawAudioUrl,
        ],
      );
    }

    return this.getExamById(examId);
  }

  async getMyExams(userId: string, isTeacher: boolean): Promise<any[]> {
    if (isTeacher) {
      const sql = `
        SELECT e.*, g.title as group_name,
               (SELECT COUNT(DISTINCT student_id) FROM student_exam_attempts WHERE exam_id = e.id) as student_count,
               (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) as question_count
        FROM exams e
        JOIN \`groups\` g ON e.group_id = g.id
        WHERE e.teacher_id = ?
        ORDER BY e.created_at DESC
      `;
      return this.db.query(sql, [userId]);
    } else {
      const sql = `
        SELECT e.*, g.title as group_name,
               (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) as question_count,
               (SELECT COUNT(*) FROM student_exam_attempts WHERE exam_id = e.id AND student_id = ?) as attempt_count,
               (SELECT MAX(score) FROM student_exam_attempts WHERE exam_id = e.id AND student_id = ?) as max_score
        FROM exams e
        JOIN \`groups\` g ON e.group_id = g.id
        JOIN group_members gm ON e.group_id = gm.group_id
        WHERE gm.user_id = ? AND e.is_published = 1
        ORDER BY e.created_at DESC
      `;
      return this.db.query(sql, [userId, userId, userId]);
    }
  }

  async getExamsByGroup(
    groupId: string,
    userId: string,
    isTeacher: boolean,
  ): Promise<any[]> {
    if (isTeacher) {
      const sql = `
        SELECT e.*,
               (SELECT COUNT(DISTINCT student_id) FROM student_exam_attempts WHERE exam_id = e.id) as student_count,
               (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) as question_count
        FROM exams e
        WHERE e.group_id = ?
        ORDER BY e.created_at DESC
      `;
      return this.db.query(sql, [groupId]);
    } else {
      const sql = `
        SELECT e.*,
               (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.id) as question_count,
               (SELECT COUNT(*) FROM student_exam_attempts WHERE exam_id = e.id AND student_id = ?) as attempt_count,
               (SELECT MAX(score) FROM student_exam_attempts WHERE exam_id = e.id AND student_id = ?) as max_score
        FROM exams e
        WHERE e.group_id = ? AND e.is_published = 1
        ORDER BY e.created_at DESC
      `;
      return this.db.query(sql, [userId, userId, groupId]);
    }
  }

  async getExamById(examId: string): Promise<Exam> {
    const exams = await this.db.query('SELECT * FROM exams WHERE id = ?', [
      examId,
    ]);
    if (!exams.length) {
      throw new NotFoundException('Exam not found');
    }
    const rawQuestions = await this.db.query(
      'SELECT id, word, type, question_text, options, correct_answer, audio_url FROM exam_questions WHERE exam_id = ?',
      [examId],
    );

    const questions: ExamQuestion[] = rawQuestions.map((q: any) => {
      let parsedOptions: string[] | null = null;
      if (q.options) {
        try {
          parsedOptions = JSON.parse(q.options as string) as string[];
        } catch {
          parsedOptions = q.options as string[];
        }
      }
      return {
        id: q.id as string,
        word: q.word as string,
        type: q.type,
        question_text: q.question_text as string,
        options: parsedOptions,
        correct_answer: q.correct_answer as string,
        audio_url: q.audio_url || null,
      };
    });

    return {
      id: exams[0].id as string,
      group_id: exams[0].group_id as string,
      teacher_id: exams[0].teacher_id as string,
      title: exams[0].title as string,
      description: exams[0].description || null,
      is_published: !!exams[0].is_published,
      created_at: exams[0].created_at ? String(exams[0].created_at) : undefined,
      questions,
    };
  }

  async updateExam(
    examId: string,
    teacherId: string,
    data: any,
  ): Promise<Exam> {
    const {
      title,
      description,
      questions: rawQuestions,
    } = data as {
      title: string;
      description?: string;
      questions: ExamQuestion[];
    };
    const questions = this.consolidateMatchingQuestions(rawQuestions || []);

    const exams = await this.db.query(
      'SELECT teacher_id FROM exams WHERE id = ?',
      [examId],
    );
    if (!exams.length) {
      throw new NotFoundException('Exam not found');
    }
    if (exams[0].teacher_id !== teacherId) {
      throw new ForbiddenException('Only the exam creator can update it');
    }
    if (!questions || questions.length === 0) {
      throw new BadRequestException('Exam must have at least one question');
    }

    await this.db.execute(
      'UPDATE exams SET title = ?, description = ? WHERE id = ?',
      [title, description || null, examId],
    );

    // Delete existing questions and insert updated questions
    await this.db.execute('DELETE FROM exam_questions WHERE exam_id = ?', [
      examId,
    ]);

    for (const q of questions) {
      const questionId = q.id && q.id.length === 36 ? q.id : uuidv4();
      const optionsStr = q.options ? JSON.stringify(q.options) : null;
      let rawAudioUrl = q.audio_url || null;

      if (rawAudioUrl && rawAudioUrl.includes('/proxy-audio?url=')) {
        try {
          const parsed = new URL(rawAudioUrl);
          const urlParam = parsed.searchParams.get('url');
          if (urlParam) {
            rawAudioUrl = urlParam;
          }
        } catch {
          // Ignore
        }
      } else if (!rawAudioUrl && q.type === 'listening' && q.word) {
        try {
          const cleanedWord = cleanWord(q.word);
          const dictRes = await this.dictionary.lookup(cleanedWord);
          if (dictRes && dictRes.audioUrl) {
            rawAudioUrl = dictRes.audioUrl;
          }
        } catch {
          // Ignore
        }
      }

      await this.db.execute(
        `INSERT INTO exam_questions (id, exam_id, word, type, question_text, options, correct_answer, audio_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          questionId,
          examId,
          q.word || '',
          q.type || 'synonym',
          q.question_text || '',
          optionsStr,
          q.correct_answer || '',
          rawAudioUrl,
        ],
      );
    }

    return this.getExamById(examId);
  }

  async updatePublishStatus(
    examId: string,
    teacherId: string,
    isPublished: boolean,
  ) {
    const exams = await this.db.query(
      'SELECT teacher_id FROM exams WHERE id = ?',
      [examId],
    );
    if (!exams.length) {
      throw new NotFoundException('Exam not found');
    }
    if (exams[0].teacher_id !== teacherId) {
      throw new ForbiddenException(
        'Only the creator of the exam can update publish status',
      );
    }
    await this.db.execute('UPDATE exams SET is_published = ? WHERE id = ?', [
      isPublished ? 1 : 0,
      examId,
    ]);
    return { success: true, is_published: isPublished };
  }

  async enrichListeningAudioUrls() {
    const questions = await this.db.query(
      `SELECT id, word FROM exam_questions WHERE type = 'listening' AND (audio_url IS NULL OR audio_url = '')`,
      [],
    );
    this.logger.log(
      `enrichListeningAudioUrls: found ${questions.length} questions with missing audio_url`,
    );
    let updated = 0;
    let failed = 0;

    for (const q of questions) {
      try {
        const cleanedWord = cleanWord(String(q.word));
        const dictRes = await this.dictionary.lookup(cleanedWord);
        if (dictRes && dictRes.audioUrl) {
          await this.db.execute(
            `UPDATE exam_questions SET audio_url = ? WHERE id = ?`,
            [dictRes.audioUrl, q.id],
          );
          this.logger.log(`Enriched "${q.word}" → ${dictRes.audioUrl}`);
          updated++;
        } else {
          this.logger.warn(`No audio URL found for "${q.word}"`);
          failed++;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(`Failed to enrich "${q.word}": ${msg}`);
        failed++;
      }
    }
    return { total: questions.length, updated, failed };
  }

  async deleteExam(examId: string, teacherId: string) {
    const exams = await this.db.query(
      'SELECT teacher_id FROM exams WHERE id = ?',
      [examId],
    );
    if (!exams.length) {
      throw new NotFoundException('Exam not found');
    }
    if (exams[0].teacher_id !== teacherId) {
      throw new ForbiddenException(
        'Only the creator of the exam can delete it',
      );
    }
    await this.db.execute('DELETE FROM exams WHERE id = ?', [examId]);
    return { success: true, message: 'Exam deleted successfully' };
  }

  async submitAttempt(
    studentId: string,
    examId: string,
    answers: Record<string, string>,
  ) {
    const exam = await this.getExamById(examId);
    const questions = exam.questions;
    let score = 0;

    const gradedQuestions = questions.map((q: ExamQuestion) => {
      const studentAnswer = (answers[q.id || ''] || '').trim();
      const correctAnswer = q.correct_answer.trim();
      let isCorrect = false;

      if (q.type === 'spelling') {
        isCorrect = studentAnswer.toLowerCase() === correctAnswer.toLowerCase();
      } else if (q.type === 'matching') {
        try {
          const studentObj = JSON.parse(studentAnswer) as Record<
            string,
            string
          >;
          const correctObj = JSON.parse(correctAnswer) as Record<
            string,
            string
          >;
          isCorrect =
            Object.keys(correctObj).every(
              (k) => studentObj[k] === correctObj[k],
            ) &&
            Object.keys(studentObj).length === Object.keys(correctObj).length;
        } catch {
          isCorrect = false;
        }
      } else {
        isCorrect = studentAnswer === correctAnswer;
      }

      if (isCorrect) {
        score++;
      }

      return {
        questionId: q.id,
        word: q.word,
        type: q.type,
        question_text: q.question_text,
        studentAnswer,
        correctAnswer,
        isCorrect,
      };
    });

    const attemptId = uuidv4();
    await this.db.execute(
      `INSERT INTO student_exam_attempts (id, student_id, exam_id, score, total_questions, answers)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        attemptId,
        studentId,
        examId,
        score,
        questions.length,
        JSON.stringify(answers),
      ],
    );

    return {
      attemptId,
      score,
      total: questions.length,
      percentage: Math.round((score / questions.length) * 100),
      gradedQuestions,
    };
  }

  async getAttemptsByStudent(
    examId: string,
    studentId: string,
  ): Promise<
    {
      id: string;
      score: number;
      total_questions: number;
      answers: Record<string, string>;
      completed_at: string;
    }[]
  > {
    const attempts = await this.db.query(
      'SELECT id, score, total_questions, answers, completed_at FROM student_exam_attempts WHERE exam_id = ? AND student_id = ? ORDER BY completed_at DESC',
      [examId, studentId],
    );

    return attempts.map((att) => {
      let parsedAnswers: Record<string, string> = {};
      if (att.answers) {
        try {
          parsedAnswers = JSON.parse(String(att.answers)) as Record<
            string,
            string
          >;
        } catch {
          parsedAnswers = {};
        }
      }
      return {
        id: String(att.id),
        score: Number(att.score),
        total_questions: Number(att.total_questions),
        answers: parsedAnswers,
        completed_at: String(att.completed_at),
      };
    });
  }
}
