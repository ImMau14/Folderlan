// Type definitions and Zod schemas for the API client.
// Provides runtime validation and compile-time type safety for all API responses.

import { z } from "zod"
import type { CancelToken } from "axios"

// ==================== CORE SCHEMAS ====================

// Canonical response wrapper that the backend always returns
export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    message: z.string().nullable().optional(),
    data: dataSchema.nullable().optional(),
    token: z.string().nullable().optional(),
    exists: z.boolean().nullable().optional(),
  })

// Base type for all API responses
export type ApiResponse<T = unknown> = z.infer<ReturnType<typeof ApiResponseSchema<z.ZodType<T>>>>

// ==================== DOMAIN SCHEMAS ====================

// Database
export const DbCheckSchema = ApiResponseSchema(
  z.object({
    exists: z.boolean().optional(),
  })
)

export const DbInitSchema = ApiResponseSchema(z.object({}))

// Authentication
export const LoginSchema = ApiResponseSchema(
  z.object({
    token: z.string(),
  })
)

export const SimpleMessageSchema = ApiResponseSchema(z.object({}))

// Audit
export const AuditEntrySchema = z.object({
  id: z.number(),
  timestamp: z.string(),
  user_id: z.number().optional(),
  username: z.string().optional(),
  event_type: z.string().optional(),
  description: z.string().optional(),
  ip_address: z.string().optional(),
  file_id: z.number().optional(),
  file_name: z.string().optional(),
  success: z.boolean().optional(),
})

export const AuditListSchema = ApiResponseSchema(
  z.object({
    data: z.array(AuditEntrySchema),
  })
)

// Files
export const FileItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  size_bytes: z.number(),
  internal_path: z.string(),
  mime_type: z.string(),
  uploaded_by: z.union([z.string(), z.number()]),
  is_public: z.boolean(),
  uploaded_at: z.string(),
  total_count: z.number().optional(),
})

export const FilesListDataSchema = z.object({
  items: z.array(FileItemSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
})

export const FilesListSchema = ApiResponseSchema(FilesListDataSchema)

export const UploadFileSchema = ApiResponseSchema(FileItemSchema)

export const DeleteFileSchema = ApiResponseSchema(
  z.object({
    success: z.boolean(),
  })
)

// File Permissions
export const FilePermissionSchema = z.object({
  user_id: z.number(),
  username: z.string(),
  access_level: z.string(),
  granted_at: z.string(),
  granted_by: z.number(),
})

export const FilePermsListSchema = ApiResponseSchema(z.array(FilePermissionSchema))
export const GrantPermissionSchema = ApiResponseSchema(FilePermissionSchema)

// Users
export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  role: z.string(),
  is_active: z.boolean(),
  can_upload: z.boolean(),
  can_delete_own_files: z.boolean(),
  has_upload_limits: z.boolean(),
  upload_limit: z.number(),
  created_at: z.string().optional(),
  last_login_at: z.string().optional(),
})

export const UsersListSchema = ApiResponseSchema(
  z.object({
    data: z.array(UserSchema),
    total: z.number().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  })
)

// Accessible Files
export const AccessibleFileSchema = z.object({
  id: z.number(),
  name: z.string(),
  size_bytes: z.number(),
  mime_type: z.string(),
  uploaded_by: z.number(),
  uploaded_at: z.string(),
  access_type: z.enum(["owner", "viewer", "collaborator"]),
})

export const AccessibleFilesSchema = ApiResponseSchema(z.array(AccessibleFileSchema))

// ==================== INFERRED TYPES ====================

export type DbCheckResponse = z.infer<typeof DbCheckSchema>
export type DbInitResponse = z.infer<typeof DbInitSchema>
export type LoginResponse = z.infer<typeof LoginSchema>
export type SimpleMessageResponse = z.infer<typeof SimpleMessageSchema>
export type AuditEntry = z.infer<typeof AuditEntrySchema>
export type AuditListResponse = z.infer<typeof AuditListSchema>
export type FileItem = z.infer<typeof FileItemSchema>
export type FilesListData = z.infer<typeof FilesListDataSchema>
export type FilesListResponse = z.infer<typeof FilesListSchema>
export type UploadFileResponse = z.infer<typeof UploadFileSchema>
export type DeleteFileResponse = z.infer<typeof DeleteFileSchema>
export type FilePermission = z.infer<typeof FilePermissionSchema>
export type FilePermsResponse = z.infer<typeof FilePermsListSchema>
export type GrantPermissionResponse = z.infer<typeof GrantPermissionSchema>
export type User = z.infer<typeof UserSchema>
export type UsersListResponse = z.infer<typeof UsersListSchema>
export type AccessibleFile = z.infer<typeof AccessibleFileSchema>
export type AccessibleFilesResponse = z.infer<typeof AccessibleFilesSchema>

// ==================== API RESULT TYPES ====================

export type ApiSuccess<T> = {
  success: true
  data: T
  status: number
  headers: Record<string, string>
}

export type ApiFailure = {
  success: false
  error: {
    message: string
    code: number
    details?: unknown
  }
  status: number
  data?: unknown
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure

export type BlobResult = {
  blob: Blob
  filename?: string
  headers: Record<string, string>
}

// ==================== REQUEST OPTIONS ====================

export interface ApiRequestOptions {
  cancelToken?: CancelToken
  onUploadProgress?: (progressEvent: ProgressEvent) => void
  onDownloadProgress?: (progressEvent: ProgressEvent) => void
}

// ==================== ERROR CLASS ====================

export class ApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// ==================== CLIENT OPTIONS ====================

export interface ApiClientOptions {
  timeoutMs?: number
  defaultHeaders?: Record<string, string>
}
