import { Controller } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Body, Post } from '@nestjs/common';
import { LoginDto, SignupDto } from '../common/dto';

@Controller('auth')
/** Exposes account registration and credential-based login endpoints. */
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  /** Registers a user and returns an access token with the public user record. */
  @Post('signup') signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }
  /** Verifies credentials and returns an access token with the public user record. */
  @Post('login') login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
