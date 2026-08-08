import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // সব ইউজারের লিস্ট দেখা (পাসওয়ার্ড ছাড়া)
  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        isBlocked: true,
        failedLoginAttempts: true,
        createdAt: true,
      },
    });
  }

  // ইউজারকে ব্লক বা আনব্লক করা
  async toggleBlockUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isBlocked: !user.isBlocked }, // যা আছে তার উল্টো করে দেওয়া
      select: { id: true, email: true, isBlocked: true },
    });

    return { 
      message: `User has been successfully ${updatedUser.isBlocked ? 'blocked' : 'unblocked'}`,
      user: updatedUser 
    };
  }

  // সবার লগিন হিস্ট্রি দেখা
  async getLoginLogs() {
    return this.prisma.loginHistory.findMany({
      orderBy: { loginTime: 'desc' },
      include: {
        user: { select: { email: true } } // কোন ইমেইল থেকে লগিন হয়েছে তা দেখার জন্য
      },
      take: 100, // রিসেন্ট ১০০টি লগ দেখাবে
    });
  }
}