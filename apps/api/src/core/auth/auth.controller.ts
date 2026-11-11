import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import * as crypto from 'crypto';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  private attachSessionCookies(res: Response, accessToken: string) {
    const isProd = process.env.NODE_ENV === 'production';
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    const csrfToken = crypto.randomBytes(24).toString('hex');

    res.cookie('auth_token', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: maxAgeMs,
    });

    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: maxAgeMs,
    });
  }

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  async requestPhoneOtp(@Body() body: { phoneNumber?: string; phone?: string }) {
    return this.authService.requestPhoneOtp(body.phoneNumber || body.phone || '');
  }

  @Post('phone-otp')
  @HttpCode(HttpStatus.OK)
  async verifyPhoneOtp(
    @Body()
    body: {
      phoneNumber?: string;
      phone?: string;
      otp: string;
      role?: string;
      challengeToken?: string;
      firebaseIdToken?: string;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyPhoneOtp(
      body.phoneNumber || body.phone || '',
      body.otp,
      body.role,
      body.challengeToken,
      body.firebaseIdToken,
    );
    if (result?.accessToken) {
      this.attachSessionCookies(res, result.accessToken);
    }
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async loginWithPassword(
    @Body() body: { identifier: string; passwordPlain: string; role?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginWithPassword(
      body.identifier,
      body.passwordPlain,
      body.role,
    );
    if (result?.accessToken) {
      this.attachSessionCookies(res, result.accessToken);
    }
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user);
  }

  private clearSessionCookies(res: Response) {
    const clearOpts = { path: '/', maxAge: 0 };
    res.clearCookie('auth_token', clearOpts);
    res.clearCookie('access_token', clearOpts);
    res.clearCookie('token', clearOpts);
    res.clearCookie('csrf_token', clearOpts);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    this.clearSessionCookies(res);
    return { success: true };
  }

  @Get('logout')
  async logoutRedirect(@Res() res: Response) {
    this.clearSessionCookies(res);
    res.redirect('/login');
  }
}
