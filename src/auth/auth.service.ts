import { Injectable, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy'; // 2FA এর জন্য
import * as qrcode from 'qrcode';       // QR Code এর জন্য
import * as crypto from 'crypto'; // এটি নতুন যুক্ত করুন
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  async resetPassword(token: string, newPassword: string) {
    try {
      // ১. টোকেন দিয়ে ডাটাবেস থেকে ইউজার খোঁজা (এখানে findFirst ব্যবহার করা নিরাপদ)
      const user = await this.prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: {
            gt: new Date(), // চেক করছে টোকেনের মেয়াদ (১ ঘণ্টা) পার হয়েছে কিনা
          },
        },
      });

      if (!user) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      // ২. নতুন পাসওয়ার্ডটিকে হ্যাশ (এনক্রিপ্ট) করা
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // ৩. ডাটাবেসে নতুন পাসওয়ার্ড সেভ করা এবং আগের টোকেন মুছে ফেলা
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
        },
      });

      return { message: 'Password updated successfully' };
    } catch (error) {
      console.log('Reset Password Error:', error);
      const message = error instanceof Error ? error.message : String(error ?? '');
      throw new BadRequestException(message || 'Error updating password');
    }
  }

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService
  ) {}

  // --- Registration Logic ---
  async register(dto: RegisterDto) {
    const userExists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (userExists) throw new BadRequestException('Email is already registered');

    const password = dto.password;
    if (!password) throw new BadRequestException('Password is required');

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email: dto.email as string, password: hashedPassword },
    });
    return { message: 'User registered successfully', userId: user.id };
  }

  // --- Login Logic ---
  async login(dto: LoginDto, ip: string, userAgent: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.isBlocked) throw new ForbiddenException('Your account is blocked by an admin');
    if (user.lockUntil && user.lockUntil > new Date()) {
      throw new ForbiddenException('Account temporarily locked. Try again later.');
    }
    if (!user.password) throw new UnauthorizedException('Invalid credentials');

    const passwordHash = user.password ?? '';
    const password = dto.password ?? '';
    const isPasswordValid = bcrypt.compareSync(password, passwordHash);

    // পাসওয়ার্ড ভুল হলে নিচের লজিক কাজ করবে:
    if (!isPasswordValid) {
      const attempts = user.failedLoginAttempts + 1;
      let lockUntilTime = user.lockUntil;

      // যদি ৩ বার বা তার বেশি ভুল পাসওয়ার্ড দেয়
      if (attempts >= 3) {
        lockUntilTime = new Date(Date.now() + 30 * 1000); // বর্তমান সময় থেকে ৩০ সেকেন্ড পর পর্যন্ত লক থাকবে
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockUntil: lockUntilTime,
        },
      });

      throw new BadRequestException(
        attempts >= 3 
          ? 'Too many failed attempts. Account locked for 30 seconds.' 
          : `Invalid credentials. Attempt ${attempts} of 3.`
      );
    }

    // পাসওয়ার্ড সঠিক হলে ফেইলড কাউন্ট রিসেট করে দিবে
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockUntil: null },
    });

    // Device Detection & History
    const previousLogin = await this.prisma.loginHistory.findFirst({
      where: { userId: user.id, ipAddress: ip, userAgent: userAgent },
    });

    if (!previousLogin) {
      try {
        // ইমেইল পাঠানোর চেষ্টা করবে
        await this.mailService.sendNewDeviceAlert(user.email, ip || 'Unknown IP', userAgent || 'Unknown Device');
      } catch (error) {
        // ইমেইল পাঠাতে ফেইল করলেও লগিন প্রসেস থামবে না
        console.log('Email sending failed, but login will continue.');
      }
    }
    await this.prisma.loginHistory.create({
      data: {
        userId: user.id,
        ipAddress: ip || 'Unknown IP',
        userAgent: userAgent || 'Unknown Device',
        device: userAgent || 'Unknown Device',
        success: true,
      },
    });

    // --- 2FA Check (NEW LOGIC) ---
    // (সব ইউজারের জন্যই এখন জিমেইল ওটিপি যাবে)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // ৬ ডিজিটের কোড

    // ডাটাবেসে ওটিপি সেভ করা
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: otpCode },
    });

    // মেইল সার্ভিসের মাধ্যমে জিমেইলে কোড পাঠানো
    try {
      await this.mailService.sendOtpEmail(user.email, otpCode);
    } catch (err) {
      console.log('Failed to send OTP email', err);
    }

    // ফ্রন্টএন্ডকে বলে দেওয়া যে 2FA লাগবে
    return { message: '2FA verification required', userId: user.id, require2FA: true };
    
  } // <--- এই ব্র্যাকেটটি ভুল করে কমেন্ট হয়ে গিয়েছিল! এখন ঠিক করে দেওয়া হয়েছে।

  // --- 2FA Logic (NEW) ---
  // ১. QR Code এবং Secret জেনারেট করা
  async generateTwoFactorSecret(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const secret = speakeasy.generateSecret({
      name: `SecureAuthApp (${user.email})`, // Google Authenticator-এ এই নাম দেখাবে
    });

    // ডাটাবেসে Secret সেভ করা
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret.base32 },
    });

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);
    return { qrCodeUrl, secret: secret.base32 };
  }

  // ২. OTP ভেরিফাই করে 2FA এনাবল বা লগিন করানো
  async verifyTwoFactor(userId: string, token: string, isEnableProcess: boolean = false) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) throw new BadRequestException('2FA not setup');

    let isValid = false;

    // চেক করা হচ্ছে এটি জিমেইল ওটিপি (৬ ডিজিট) নাকি Google Authenticator
    if (token.length === 6 && user.twoFactorSecret === token) {
      isValid = true;
      // জিমেইল ওটিপি হলে ব্যবহার হওয়ার পর ডাটাবেস থেকে মুছে ফেলা হচ্ছে
      await this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: null }
      });
    } else {
      // জিমেইল ওটিপি না মিললে Google Authenticator (speakeasy) দিয়ে চেক করবে
      isValid = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: token,
      });
    }

    if (!isValid) throw new UnauthorizedException('Invalid 2FA token');

    // যদি ইউজার প্রথমবার 2FA সেটআপ করে থাকে
    if (isEnableProcess) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { isTwoFactorEnabled: true },
      });
      return { message: '2FA enabled successfully' };
    }

    // লগিন করার সময় 2FA ভেরিফাই হলে টোকেন দেওয়া হবে
    const payload = { sub: user.id, role: user.role };
    const access_token = this.jwtService.sign(payload);
    
    return { message: 'Login successful', access_token };
  }

  // --- Password Recovery Logic ---

  // ১. Forgot Password (ইমেইলে রিসেট লিংক পাঠানো)
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // ইউজার না পেলে এরর দেখাবে না, সিকিউরিটির জন্য সাকসেস মেসেজই দেখাবে
      return { message: 'If this email is registered, a reset link will be sent.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    try {
      // ইমেইলে লিংক পাঠানোর চেষ্টা করবে
      await this.mailService.sendPasswordResetEmail(user.email, resetToken);
    } catch (error) {
      // ইমেইল ফেইল করলে টার্মিনালে টোকেনটি প্রিন্ট করে দিবে টেস্টিংয়ের জন্য
      console.log('\n❌ Email Sending Failed due to invalid credentials.');
      console.log('✅ TEST PASSWORD RESET TOKEN (Copy this):');
      console.log(resetToken);
      console.log('\n');
    }

    return { message: 'Password reset process initiated. Check email or terminal.' };
  }
}