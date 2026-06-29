import { SetMetadata } from '@nestjs/common';

export const REQUIRED_SCOPES_KEY = 'required_scopes';

/**
 * Gunakan di controller/handler untuk definisikan scope yg diperlukan.
 * Contoh: @RequireScopes('product:read:*') untuk izinkan semua category
 *         @RequireScopes('product:read:electronics') untuk category spesifik
 */
export const RequireScopes = (...scopes: string[]) =>
  SetMetadata(REQUIRED_SCOPES_KEY, scopes);
