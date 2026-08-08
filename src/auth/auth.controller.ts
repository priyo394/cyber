import { Controller, Post, Body, Ip, Headers, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.authService.login(dto, ip, userAgent);
  }

  // --- 2FA Endpoints ---
  // QR Code জেনারেট করার জন্য (রেজিস্ট্রেশনের পর কল করতে হবে)
  @Post('2fa/generate/:userId')
  generate2faSecret(@Param('userId') userId: string) {
    return this.authService.generateTwoFactorSecret(userId);
  }

  // OTP ভেরিফাই করার জন্য (লগিন বা সেটআপ করার সময়)
  @Post('2fa/verify')
  verify2fa(@Body() body: { userId: string; token: string; isEnableProcess?: boolean }) {
    return this.authService.verifyTwoFactor(body.userId, body.token, body.isEnableProcess);
  }

  // --- Password Recovery Endpoints ---

  @Post('forgot-password')
  forgotPassword(@Body('email') email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: { token: string; newPassword: string }) {
    // এখানেও নতুন পাসওয়ার্ডের ভ্যালিডেশন দেওয়া উচিত (আমরা সিম্পল রাখছি)
    return this.authService.resetPassword(body.token, body.newPassword);
  }
}