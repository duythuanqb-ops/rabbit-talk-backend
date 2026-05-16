import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { AuthService } from '../services/auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'identifier', // Support email or username
      passwordField: 'password',
    });
  }

  async validate(identifier: string, pass: string): Promise<any> {
    return this.authService.validateUser(identifier, pass);
  }
}
