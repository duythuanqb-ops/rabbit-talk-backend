export interface UserRow {
  id: number;
  uuid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  date_of_birth: Date;
  password: string | null;
  auth_provider: 'local' | 'google';
  google_id: string | null;
  avatar_url: string | null;
  is_email_verified: number;
  email_verification_token: string | null;
  email_verification_expires: Date | null;
  bio: string | null;
  role: 'admin' | 'student' | 'teacher';
  password_reset_token: string | null;
  password_reset_expires: Date | null;
  xp: number;
  day_streak: number;
  league: string;
  cover_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface RefreshTokenRow {
  id: number;
  user_uuid: string;
  token: string;
  device_info: string | null;
  ip_address: string | null;
  expires_at: Date;
  created_at: Date;
  last_active: Date;
  is_revoked: number;
}

export interface TeacherProfileRow {
  id: number;
  user_uuid: string;
  headline: string;
  experience_years: number;
  video_intro_url: string | null;
  certificates: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: Date;
  updated_at: Date;
}

export interface GroupRow {
  id: string;
  title: string;
  description: string | null;
  avatar: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface GroupMemberRow {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: Date;
}

export interface FriendshipRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: Date;
  updated_at: Date;
}

export interface FlashcardSetRow {
  id: string;
  group_id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  is_published: number;
  created_at: Date;
  updated_at: Date;
}

export interface FlashcardRow {
  id: string;
  set_id: string;
  word: string;
  phonetic: string | null;
  part_of_speech: string | null;
  meaning: string | null;
  synonyms: string | null;
  example_sentence: string | null;
  audio_url: string | null;
  translation: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface StudentFlashcardProgressRow {
  id: string;
  student_id: string;
  flashcard_id: string;
  status: 'new' | 'learning' | 'mastered';
  last_reviewed_at: Date;
  created_at: Date;
  is_starred: number;
}

export interface StudentCustomWordRow {
  id: string;
  student_id: string;
  word: string;
  meaning: string | null;
  phonetic: string | null;
  example_sentence: string | null;
  created_at: Date;
}

export interface ExamRow {
  id: string;
  group_id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  is_published: number;
  created_at: Date;
  updated_at: Date;
  due_date: Date | null;
  start_date: Date | null;
  allow_retry: number;
}

export interface ExamQuestionRow {
  id: string;
  exam_id: string;
  word: string;
  type: string;
  question_text: string;
  options: string | null; // JSON string
  correct_answer: string;
  audio_url: string | null;
  created_at: Date;
}

export interface StudentExamAttemptRow {
  id: string;
  student_id: string;
  exam_id: string;
  score: number;
  total_questions: number;
  answers: string | null; // JSON string
  completed_at: Date;
}

export interface UserAchievementRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  icon: string | null;
  bg_color: string | null;
  earned_at: Date;
}

export interface DailyQuestRow {
  id: string;
  title: string;
  description: string | null;
  xp_reward: number;
  type: string;
  target_value: number;
  created_at: Date;
}

export interface StudentQuestProgressRow {
  id: string;
  student_id: string;
  quest_id: string;
  current_value: number;
  is_completed: number;
  created_at: Date;
  updated_at: Date;
}

export interface StudentAttendanceRow {
  id: string;
  student_id: string;
  date: Date;
  xp_earned: number;
  created_at: Date;
}
