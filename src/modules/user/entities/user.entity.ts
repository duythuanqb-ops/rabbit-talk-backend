export type UserRole = 'admin' | 'student' | 'teacher';

export class UserEntity {
  id!: number;
  uuid!: string;
  username!: string;
  email!: string;
  first_name!: string;
  last_name!: string;
  date_of_birth!: string;
  password!: string;
  role!: UserRole;
  is_email_verified!: number;
  bio?: string | null;
  avatar_url?: string | null;
  auth_provider?: string;
  xp!: number;
  day_streak!: number;
  league!: string;
  created_at!: string;
  updated_at!: string;
}
