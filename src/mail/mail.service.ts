import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: 587,
      secure: false, 
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // --- 2FA OTP পাঠানোর ফাংশন ---
  async sendOtpEmail(email: string, otpCode: string) {
    const mailOptions = {
      from: `"Secure Auth" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your 2FA Login Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Security Verification</h2>
          <p>Your 6-digit OTP code for login is:</p>
          <h1 style="color: #764ba2; letter-spacing: 5px;">${otpCode}</h1>
          <p>Please enter this code to complete your login. It is valid for a short time.</p>
          <p style="color: #777; font-size: 12px;">If you did not attempt to log in, please secure your account immediately.</p>
        </div>
      `,
    };
    
    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ OTP Email sent successfully to ${email}`);
    } catch (error) {
      console.error('❌ Error sending OTP email:', error);
      throw error;
    }
  }

  // --- নতুন ডিভাইস লগিন অ্যালার্ট ---
  async sendNewDeviceAlert(email: string, ip: string, device: string) {
    const mailOptions = {
      from: `"Secure Auth" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Security Alert: New Device Login Detected',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #d9534f;">New Login Detected</h2>
          <p>We noticed a new login to your account.</p>
          <p><b>IP Address:</b> ${ip}</p>
          <p><b>Device/Browser:</b> ${device}</p>
          <p>If this wasn't you, please change your password immediately.</p>
        </div>
      `,
    };
    await this.transporter.sendMail(mailOptions);
  }

  // --- পাসওয়ার্ড রিসেট টোকেন ---
  async sendPasswordResetEmail(email: string, token: string) {
    const mailOptions = {
      from: `"Secure Auth" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Password Recovery',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>Your password reset token is: <b>${token}</b></p>
          <p>Copy this token and use it to reset your password. It is valid for 1 hour.</p>
        </div>
      `,
    };
    await this.transporter.sendMail(mailOptions);
  }
}