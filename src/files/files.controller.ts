import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  type AuthenticatedUser,
} from '../auth/index.js';
import { USER_ROLE } from '../users/index.js';
import { CreateUploadUrlDto, type UploadUrlResponseDto } from './dto/index.js';
import { FilesService } from './files.service.js';

@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles([USER_ROLE.MENTOR])
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload-url')
  async createUploadUrl(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() upload: CreateUploadUrlDto,
  ): Promise<UploadUrlResponseDto> {
    const uploadUrl = await this.filesService.createUploadUrl(
      currentUser.id,
      upload,
    );
    return uploadUrl;
  }
}
