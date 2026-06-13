import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { AuthService, AuthUser } from '../services/auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'identifier',
      passwordField: 'password',
    });
  }

  async validate(
    identifier: string,
    pass: string,
  ): Promise<Omit<AuthUser, 'password'>> {
    return this.authService.validateUser(identifier, pass);
  }
}
