import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { config } from '../../../config/env';
/** Extracts bearer tokens and maps their subject to the request user identity. */
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.JWT_SECRET,
    });
  }
  /** Converts a verified JWT subject into the user shape consumed by guards. */
  validate(payload: { sub: string }) {
    return { id: payload.sub };
  }
}
