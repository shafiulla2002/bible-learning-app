import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('phone-otp')
  @HttpCode(HttpStatus.OK)
  async verifyPhoneOtp(@Body() body: { phoneNumber: string; otp: string }) {
    return this.authService.verifyPhoneOtp(body.phoneNumber, body.otp);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async loginWithPassword(@Body() body: { identifier: string; passwordPlain: string }) {
    return this.authService.loginWithPassword(body.identifier, body.passwordPlain);
  }
}
