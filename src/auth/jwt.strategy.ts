import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'super-secret-key-change-it-later',
    });
  }

  async validate(payload: any) {
    // এই ডাটাটি রিকোয়েস্টের সাথে (req.user) যুক্ত হয়ে যাবে
    return { userId: payload.sub, role: payload.role };
  }
}