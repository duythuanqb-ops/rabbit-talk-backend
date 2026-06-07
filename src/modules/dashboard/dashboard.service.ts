/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unused-vars */
import { Injectable, ForbiddenException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DashboardService {
  constructor(private readonly db: DatabaseService) {}

  async runMigration() {
    const queries = [
      'ALTER TABLE `users` ADD COLUMN `xp` INT NOT NULL DEFAULT 0;',
      'ALTER TABLE `users` ADD COLUMN `day_streak` INT NOT NULL DEFAULT 0;',
      "ALTER TABLE `users` ADD COLUMN `league` VARCHAR(50) NOT NULL DEFAULT 'Bronze';",
      'ALTER TABLE `student_flashcard_progress` ADD COLUMN `is_starred` TINYINT(1) DEFAULT 0;',
      `CREATE TABLE IF NOT EXISTS \`student_custom_words\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`student_id\` VARCHAR(36) NOT NULL,
        \`word\` VARCHAR(255) NOT NULL,
        \`meaning\` VARCHAR(500),
        \`phonetic\` VARCHAR(255),
        \`example_sentence\` TEXT,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        FOREIGN KEY (\`student_id\`) REFERENCES \`users\`(\`uuid\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`,
      'ALTER TABLE `users` ADD COLUMN `cover_url` VARCHAR(255) DEFAULT NULL;',
    ];
    try {
      for (const sql of queries) {
        try {
          await this.db.query(sql);
        } catch (e) {
          if (
            !e.message.includes('Duplicate column name') &&
            !e.message.includes('already exists')
          ) {
            throw e;
          }
        }
      }
      return { success: true, message: 'Migration applied successfully!' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async getTeacherStats(teacherId: string) {
    // Total students across all classes created by teacher
    const studentsRes = await this.db.query(
      `SELECT COUNT(DISTINCT gm.user_id) as count 
       FROM group_members gm 
       JOIN \`groups\` g ON gm.group_id = g.id 
       WHERE g.created_by = ?`,
      [teacherId],
    );
    const totalStudents = studentsRes[0]?.count || 0;

    // Pending exams (unpublished or no attempts)
    const examsRes = await this.db.query(
      `SELECT COUNT(id) as count FROM exams WHERE teacher_id = ? AND is_published = 0`,
      [teacherId],
    );
    const pendingExams = examsRes[0]?.count || 0;

    return {
      totalStudents,
      avgProgress: 76, // Mocked percentage for now
      pendingExams,
      weeklyEngagement: 85, // Mocked percentage
    };
  }

  async getTeacherAlerts(teacherId: string) {
    // Mock logic: Find students in teacher's groups who scored < 50 on recent exams
    const sql = `
      SELECT sea.id, u.first_name, u.last_name, u.avatar_url, sea.score, sea.total_questions, e.title as exam_title
      FROM student_exam_attempts sea
      JOIN exams e ON sea.exam_id = e.id
      JOIN users u ON sea.student_id = u.uuid
      WHERE e.teacher_id = ? AND (sea.score * 100 / sea.total_questions) < 50
      ORDER BY sea.completed_at DESC
      LIMIT 10
    `;
    const alerts = await this.db.query(sql, [teacherId]);
    return alerts.map((a) => ({
      id: a.id,
      studentName: `${a.first_name} ${a.last_name}`,
      avatarUrl: a.avatar_url,
      reason: `Scored ${a.score}/${a.total_questions} on ${a.exam_title}`,
      type: 'low_score',
      severity: 'high',
    }));
  }

  async getLeaderboard(userId: string, scope: 'global' | 'friends' = 'global') {
    let sql = '';
    let params: any[] = [];

    if (scope === 'friends') {
      // Mock friend leaderboard
      sql = `
        SELECT u.uuid as id, u.username, u.first_name, u.last_name, u.avatar_url, u.xp, u.league
        FROM users u
        JOIN friendships f ON (f.receiver_id = u.uuid OR f.sender_id = u.uuid)
        WHERE (f.sender_id = ? OR f.receiver_id = ?) AND u.uuid != ? AND f.status = 'accepted'
        ORDER BY u.xp DESC LIMIT 50
      `;
      params = [userId, userId, userId];
    } else {
      sql = `
        SELECT uuid as id, username, first_name, last_name, avatar_url, xp, league
        FROM users
        WHERE role = 'student'
        ORDER BY xp DESC LIMIT 50
      `;
    }
    const rows = await this.db.query(sql, params);
    return rows.map((r, index) => ({
      id: r.id,
      rank: index + 1,
      name: `${r.first_name} ${r.last_name}`,
      avatar: r.avatar_url,
      xp: r.xp,
      league: r.league,
    }));
  }

  async getProfileStats(userId: string) {
    const user = await this.db.query(
      'SELECT xp, day_streak, league FROM users WHERE uuid = ?',
      [userId],
    );
    const achievements = await this.db.query(
      'SELECT * FROM user_achievements WHERE user_id = ? ORDER BY earned_at DESC',
      [userId],
    );

    return {
      xp: user[0]?.xp || 0,
      dayStreak: user[0]?.day_streak || 0,
      league: user[0]?.league || 'Bronze',
      achievements: achievements.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        icon: a.icon,
        bgColor: a.bg_color,
        date: a.earned_at,
      })),
    };
  }

  async getStudentStats(studentId: string) {
    const userRes = await this.db.query(
      'SELECT xp, day_streak, league FROM users WHERE uuid = ?',
      [studentId],
    );
    const user = userRes[0] || { xp: 0, day_streak: 0, league: 'Bronze' };

    const wordsRes = await this.db.query(
      `SELECT COUNT(*) as count FROM student_flashcard_progress WHERE student_id = ? AND status = 'mastered'`,
      [studentId],
    );
    const wordsLearned = wordsRes[0]?.count || 0;

    const rankRes = await this.db.query(
      `SELECT COUNT(*) + 1 as \`rank\` FROM users WHERE role = 'student' AND xp > ?`,
      [user.xp],
    );
    const currentRank = rankRes[0]?.rank || 1;

    return {
      totalXp: user.xp,
      wordsLearned,
      currentRank,
      dayStreak: user.day_streak,
    };
  }

  async getStudentAssignments(studentId: string) {
    const sql = `
      SELECT e.id, e.title, e.due_date, g.title as group_name
      FROM exams e
      JOIN \`groups\` g ON e.group_id = g.id
      JOIN group_members gm ON e.group_id = gm.group_id
      WHERE gm.user_id = ? AND e.is_published = 1 
        AND e.due_date IS NOT NULL 
        AND e.due_date >= NOW()
        AND NOT EXISTS (
          SELECT 1 FROM student_exam_attempts sea WHERE sea.exam_id = e.id AND sea.student_id = ?
        )
      ORDER BY e.due_date ASC
      LIMIT 10
    `;
    const assignments = await this.db.query(sql, [studentId, studentId]);
    return assignments.map((a) => ({
      id: a.id,
      title: a.title,
      dueDate: a.due_date,
      groupName: a.group_name,
      type: 'exam',
      isUrgent:
        new Date(a.due_date).getTime() - Date.now() < 24 * 60 * 60 * 1000, // urgent if due within 24h
    }));
  }

  async getStudentQuests(studentId: string) {
    // 1. Ensure global quest pool is populated
    let quests = await this.db.query('SELECT * FROM daily_quests');
    if (quests.length === 0) {
      await this.db
        .execute(`INSERT INTO daily_quests (id, title, description, xp_reward, type, target_value) VALUES 
        (UUID(), 'Practice 5 Vocabulary Words', 'Study your flashcards or custom words', 50, 'practice_words', 5),
        (UUID(), 'Add 2 Custom Words', 'Add new words to your vocabulary', 30, 'add_custom_words', 2),
        (UUID(), 'Complete an Exam', 'Take any assigned exam', 100, 'take_exam', 1)`);
      quests = await this.db.query('SELECT * FROM daily_quests');
    }

    // 2. Fetch today's progress for this student
    const progressSql = `
      SELECT p.id, p.quest_id, p.current_value, p.is_completed, 
             q.title, q.description, q.xp_reward, q.type, q.target_value
      FROM student_quest_progress p
      JOIN daily_quests q ON p.quest_id = q.id
      WHERE p.student_id = ? AND DATE(p.created_at) = CURDATE()
    `;
    let todayProgress = await this.db.query(progressSql, [studentId]);

    // 3. Assign new quests if we have less than 3 for today
    if (todayProgress.length < 3) {
      const assignedQuestIds = todayProgress.map((p: any) => p.quest_id);
      const availableQuests = quests.filter(
        (q: any) => !assignedQuestIds.includes(q.id),
      );

      const needed = 3 - todayProgress.length;
      const selectedQuests = availableQuests
        .sort(() => 0.5 - Math.random())
        .slice(0, needed);

      for (const q of selectedQuests) {
        await this.db.execute(
          `
          INSERT INTO student_quest_progress (id, student_id, quest_id, current_value, is_completed)
          VALUES (?, ?, ?, 0, 0)
        `,
          [uuidv4(), studentId, q.id],
        );
      }

      if (selectedQuests.length > 0) {
        todayProgress = await this.db.query(progressSql, [studentId]);
      }
    }

    return todayProgress.map((p: any) => ({
      id: p.quest_id,
      title: p.title,
      description: p.description,
      xpReward: p.xp_reward,
      type: p.type,
      targetValue: p.target_value,
      currentValue: p.current_value,
      isCompleted: !!p.is_completed,
    }));
  }

  async updateQuestProgress(
    studentId: string,
    questType: string,
    increment: number = 1,
  ) {
    // Find today's progress record matching the quest type
    const findSql = `
      SELECT p.id, p.current_value, p.is_completed, q.target_value, q.xp_reward
      FROM student_quest_progress p
      JOIN daily_quests q ON p.quest_id = q.id
      WHERE p.student_id = ? AND q.type = ? AND DATE(p.created_at) = CURDATE() AND p.is_completed = 0
    `;
    const records = await this.db.query(findSql, [studentId, questType]);

    if (records.length === 0)
      return { success: false, message: 'No active quest of this type today' };

    const record = records[0];
    let newValue = record.current_value + increment;
    const isCompleted = newValue >= record.target_value ? 1 : 0;

    // Cap at target value
    if (newValue > record.target_value) newValue = record.target_value;

    const updateSql = `
      UPDATE student_quest_progress
      SET current_value = ?, is_completed = ?
      WHERE id = ?
    `;
    await this.db.execute(updateSql, [newValue, isCompleted, record.id]);

    if (isCompleted) {
      // Award XP to student
      const userSql = `UPDATE users SET xp = IFNULL(xp, 0) + ? WHERE uuid = ?`;
      await this.db.execute(userSql, [record.xp_reward, studentId]);
    }

    return {
      success: true,
      newValue,
      isCompleted,
      xpRewarded: isCompleted ? record.xp_reward : 0,
    };
  }

  async clearQuests() {
    await this.db.execute('DELETE FROM student_quest_progress');
    await this.db.execute('DELETE FROM daily_quests');
    return { success: true };
  }

  async getStudentAttendance(studentId: string) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-indexed

    const pad = (n: number) => String(n).padStart(2, '0');
    const toDateStr = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // Fetch all attendance for this user to calculate real streak
    const allAttendanceRows = await this.db.query(
      'SELECT date FROM student_attendance WHERE student_id = ? ORDER BY date DESC',
      [studentId],
    );

    const attendanceStrs = allAttendanceRows.map((r: any) => {
      const d = typeof r.date === 'string' ? new Date(r.date) : r.date;
      return toDateStr(d);
    });
    const uniqueAttendanceStrs = [...new Set(attendanceStrs)];

    let currentStreak = 0;
    const todayStrRaw = toDateStr(today);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = toDateStr(yesterday);

    const activeStreakDates = new Set<string>();

    if (uniqueAttendanceStrs.includes(todayStrRaw)) {
      const checkDate = new Date(today);
      while (uniqueAttendanceStrs.includes(toDateStr(checkDate))) {
        activeStreakDates.add(toDateStr(checkDate));
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    } else if (uniqueAttendanceStrs.includes(yesterdayStr)) {
      const checkDate = new Date(yesterday);
      while (uniqueAttendanceStrs.includes(toDateStr(checkDate))) {
        activeStreakDates.add(toDateStr(checkDate));
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    // Now build result array for current month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const result: any[] = [];
    const daysInMonth = lastDay.getDate();

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = toDateStr(d);

      result.push({
        date: dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isPresent: uniqueAttendanceStrs.includes(dateStr),
        isActiveStreak: activeStreakDates.has(dateStr),
        isToday: dateStr === todayStrRaw,
      });
    }

    const startEmptyDays = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
    const endEmptyDays = (7 - ((startEmptyDays + daysInMonth) % 7)) % 7;

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    const paddingStartDays: number[] = [];
    for (let i = startEmptyDays - 1; i >= 0; i--) {
      paddingStartDays.push(prevMonthLastDay - i);
    }

    const paddingEndDays: number[] = [];
    for (let i = 1; i <= endEmptyDays; i++) {
      paddingEndDays.push(i);
    }

    const userRes = await this.db.query(
      'SELECT day_streak FROM users WHERE uuid = ?',
      [studentId],
    );
    const dbStreak = userRes[0]?.day_streak || 0;

    if (dbStreak !== currentStreak) {
      await this.db.query('UPDATE users SET day_streak = ? WHERE uuid = ?', [
        currentStreak,
        studentId,
      ]);
    }

    return {
      streak: currentStreak,
      history: result,
      currentMonth: today.toLocaleString('default', {
        month: 'long',
        year: 'numeric',
      }),
      paddingStartDays,
      paddingEndDays,
    };
  }

  async checkInStudent(studentId: string) {
    // Check if already checked in today
    const checkSql =
      'SELECT * FROM student_attendance WHERE student_id = ? AND date = CURDATE()';
    const existing = await this.db.query(checkSql, [studentId]);
    if (existing.length > 0) {
      return { success: false, message: 'Already checked in today' };
    }

    const id = uuidv4();

    // Insert attendance
    const insertSql =
      'INSERT INTO student_attendance (id, student_id, date, xp_earned) VALUES (?, ?, CURDATE(), 50)';
    await this.db.query(insertSql, [id, studentId]);

    // Update streak based on the new logic!
    const attendanceData = await this.getStudentAttendance(studentId);

    // Update Daily Quest Progress for check-in
    await this.updateQuestProgress(studentId, 'daily_checkin', 1).catch(
      console.error,
    );

    return {
      success: true,
      xpEarned: 50,
      newStreak: attendanceData.streak,
    };
  }

  async getStudentVocabulary(studentId: string) {
    // Source 1: words student added themselves
    const customWordsSql = `
      SELECT 
        id,
        word,
        meaning,
        'My Words' as set_title,
        'custom' as status,
        0 as is_starred,
        'custom' as source,
        created_at
      FROM student_custom_words
      WHERE student_id = ?
    `;

    // Source 2: teacher's flashcard words that student has STUDIED (has progress record)
    // AND has starred (marked with *)
    const starredSql = `
      SELECT 
        sfp.flashcard_id as id,
        f.word,
        f.meaning,
        fs.title as set_title,
        sfp.status,
        sfp.is_starred,
        'flashcard' as source,
        sfp.last_reviewed_at as created_at
      FROM student_flashcard_progress sfp
      JOIN flashcards f ON sfp.flashcard_id = f.id
      JOIN flashcard_sets fs ON f.set_id = fs.id
      WHERE sfp.student_id = ? AND sfp.is_starred = 1
    `;

    const [customWords, starredWords] = await Promise.all([
      this.db.query(customWordsSql, [studentId]),
      this.db.query(starredSql, [studentId]),
    ]);

    const allWords = [
      ...customWords.map((w) => ({
        id: w.id,
        word: w.word,
        meaning: w.meaning,
        setTitle: w.set_title,
        status: 'custom',
        isStarred: false,
        source: 'custom',
      })),
      ...starredWords.map((w) => ({
        id: w.id,
        word: w.word,
        meaning: w.meaning,
        setTitle: w.set_title,
        status: w.status,
        isStarred: true,
        source: 'flashcard',
      })),
    ];

    return allWords.slice(0, 20);
  }

  async toggleVocabularyStar(studentId: string, flashcardId: string) {
    const sql = `
      UPDATE student_flashcard_progress 
      SET is_starred = NOT is_starred 
      WHERE student_id = ? AND flashcard_id = ?
    `;
    await this.db.query(sql, [studentId, flashcardId]);
    return { success: true };
  }

  async addCustomWord(
    studentId: string,
    word: string,
    meaning?: string,
    phonetic?: string,
    exampleSentence?: string,
  ) {
    const sql = `
      INSERT INTO student_custom_words (id, student_id, word, meaning, phonetic, example_sentence)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await this.db.query(sql, [
      uuidv4(),
      studentId,
      word,
      meaning || null,
      phonetic || null,
      exampleSentence || null,
    ]);

    // Update daily quest progress if applicable
    await this.updateQuestProgress(studentId, 'add_custom_words', 1).catch(
      console.error,
    );

    return { success: true };
  }

  async updateCustomWord(
    id: string,
    studentId: string,
    word: string,
    meaning?: string,
  ) {
    const sql = `
      UPDATE student_custom_words 
      SET word = ?, meaning = ?
      WHERE id = ? AND student_id = ?
    `;
    await this.db.query(sql, [word, meaning || null, id, studentId]);
    return { success: true };
  }

  async deleteCustomWord(id: string, studentId: string) {
    const sql = `DELETE FROM student_custom_words WHERE id = ? AND student_id = ?`;
    await this.db.query(sql, [id, studentId]);
    return { success: true };
  }

  async getVocabularyStudyCards(studentId: string) {
    // Custom words added by student (no audio/flashcard progress tracking)
    const customSql = `
      SELECT 
        id,
        word,
        meaning,
        phonetic,
        NULL as example_sentence,
        NULL as synonyms,
        NULL as audio_url,
        'custom' as source
      FROM student_custom_words
      WHERE student_id = ?
    `;

    // Full flashcard data for starred teacher words
    const starredSql = `
      SELECT 
        f.id,
        f.word,
        f.meaning,
        f.phonetic,
        f.example_sentence,
        f.synonyms,
        f.audio_url,
        'flashcard' as source,
        sfp.status
      FROM student_flashcard_progress sfp
      JOIN flashcards f ON sfp.flashcard_id = f.id
      WHERE sfp.student_id = ? AND sfp.is_starred = 1
    `;

    const [customWords, starredWords] = await Promise.all([
      this.db.query(customSql, [studentId]),
      this.db.query(starredSql, [studentId]),
    ]);

    return [
      ...customWords.map((w) => ({
        id: w.id,
        word: w.word,
        meaning: w.meaning || '(No meaning added)',
        phonetic: w.phonetic || null,
        exampleSentence: null,
        synonyms: null,
        audioUrl: null,
        source: 'custom',
      })),
      ...starredWords.map((w) => ({
        id: w.id,
        word: w.word,
        meaning: w.meaning || '(No meaning provided)',
        phonetic: w.phonetic || null,
        exampleSentence: w.example_sentence || null,
        synonyms: w.synonyms || null,
        audioUrl: w.audio_url || null,
        source: 'flashcard',
        status: w.status,
      })),
    ];
  }
}
