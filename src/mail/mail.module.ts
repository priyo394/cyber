import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
  providers: [MailService],
  exports: [MailService], // এক্সপোর্ট করা হলো
})
export class MailModule {}