import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import config from '../../config';

@Injectable()
export class UploadService {
  private s3Client: S3Client | null = null;

  constructor() {
    if (config.nodeEnv === 'production' && config.aws.accessKeyId) {
      this.s3Client = new S3Client({
        region: config.aws.s3Region,
        credentials: {
          accessKeyId: config.aws.accessKeyId,
          secretAccessKey: config.aws.secretAccessKey,
        },
      });
    }
  }

  async uploadAvatar(file: Express.Multer.File): Promise<string> {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;

    if (config.nodeEnv === 'production' && this.s3Client) {
      // Upload to S3
      const key = `img/avatars/${filename}`;
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: config.aws.s3Bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read', // Ensure bucket supports this ACL or omit if bucket policy is public
        }),
      );
      return `https://${config.aws.s3Bucket}.s3.${config.aws.s3Region}.amazonaws.com/${key}`;
    } else {
      // Save locally
      const uploadDir = path.join(process.cwd(), 'public', 'img', 'avatars');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, file.buffer);

      // We assume backend runs on localhost:3000 in dev
      const port = config.port || 3000;
      return `http://localhost:${port}/public/img/avatars/${filename}`;
    }
  }

  async uploadAudio(buffer: Buffer, originalname: string): Promise<string> {
    const ext = path.extname(originalname) || '.mp3';
    const filename = `${uuidv4()}${ext}`;

    if (config.nodeEnv === 'production' && this.s3Client) {
      const key = `audio/tts/${filename}`;
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: config.aws.s3Bucket,
          Key: key,
          Body: buffer,
          ContentType: 'audio/mpeg',
          ACL: 'public-read',
        }),
      );
      return `https://${config.aws.s3Bucket}.s3.${config.aws.s3Region}.amazonaws.com/${key}`;
    } else {
      const uploadDir = path.join(process.cwd(), 'public', 'audio', 'tts');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, buffer);

      const port = config.port || 3000;
      return `http://localhost:${port}/public/audio/tts/${filename}`;
    }
  }
}
