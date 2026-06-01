import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  healthCheck() {
    return this.appService.getHealthStatus();
  }

  @Get('proxy-audio')
  async proxyAudio(@Query('url') url: string, @Res() res: Response) {
    if (!url) {
      throw new BadRequestException('Audio URL is required');
    }

    // Detect if URL is a Google Translate TTS request so we can send the
    // correct Referer header — Google TTS returns 403 without it.
    const isGoogleTts =
      url.includes('translate.google.com') ||
      url.includes('translate.googleapis.com');

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: '*/*',
          ...(isGoogleTts
            ? {
                Referer: 'https://translate.google.com/',
                'Accept-Language': 'en-US,en;q=0.9',
              }
            : {}),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || 'audio/mpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Access-Control-Allow-Origin', '*');
      // Optional: Add Cache-Control so the browser caches the audio
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      res
        .status(500)
        .json({ message: 'Error proxying audio', error: error.message });
    }
  }
}
