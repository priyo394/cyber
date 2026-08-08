import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // এটি একদম প্রথমেই থাকতে হবে
    PrismaModule,
    AuthModule,
    MailModule,
    AdminModule,
  ],
})
export class AppModule {}