import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { MailModule } from '../mail/mail.module'; // MailModule ইম্পোর্ট করা হলো
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'super-secret-key-change-it-later',
      signOptions: { expiresIn: '15m' },
    }),
    MailModule, // এখানে যুক্ত করা হলো
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}