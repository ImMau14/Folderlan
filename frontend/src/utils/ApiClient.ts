// API client for handling HTTP requests to the backend with structured error handling
// and type-safe methods for database, authentication, audit, file, and user management

import axios from "axios"
import type { AxiosRequestConfig, AxiosResponse } from "axios"

/* ---------------------- Canonical wrapper (backend) ---------------------- */
// Standard response format from backend API
export type ApiResponse<T = unknown> = {
  success: boolean
  message: string | null
  data: T | null
  token?: string | null
  exists?: boolean | null
}

/* ---------------------- Client-side result ---------------------- */
// Processed result from API calls for client-side consumption
export type ApiResult<T = unknown> = {
  ok: boolean // HTTP 2xx
  status: number // HTTP status code
  wrapper?: ApiResponse<T> | null // parsed canonical wrapper when present
  data: T | null // convenience unwrapped data (wrapper.data ?? raw body)
  raw: AxiosResponse | null // full axios response for 4xx/5xx inspection
  error?: string | null // network / timeout textual error
}

/* ---------------------- Domain types (from your spec) ---------------------- */
export type FileItem = {
  id: number
  name: string
  size_bytes: number
  internal_path: string
  mime_type: string
  uploaded_by: string | number
  is_public: boolean
  uploaded_at: string
  total_count?: number
}

export type FilesListData = {
  items: FileItem[]
  total: number
  limit: number
  offset: number
}

export type AuditEntry = {
  id: number
  timestamp: string
  user_id?: number
  username?: string
  event_type?: string
  description?: string
  ip_address?: string
  file_id?: number
  file_name?: string
  success?: boolean
}

export type User = {
  id: number
  username: string
  role: string
  is_active: boolean
  can_upload: boolean
  can_delete_own_files: boolean
  has_upload_limits: boolean
  upload_limit: number
  created_at?: string
  last_login_at?: string
}

export type PaginatedUsers = {
  data: User[]
  total?: number
  limit?: number
  offset?: number
}

/* ---------------------- Options & Error class ---------------------- */
export interface ApiClientOptions {
  baseURL: string
  timeoutMs?: number
  defaultHeaders?: Record<string, string>
}

// Custom error class that includes API response details
export class ErrorWithResponse extends Error {
  response: ApiResult | null
  constructor(message: string, response: ApiResult | null) {
    super(message)
    this.name = "ErrorWithResponse"
    this.response = response
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

/* ---------------------- ApiClient ---------------------- */
export class ApiClient {
  private axiosInstance
  private token: string | null = null

  constructor(opts: ApiClientOptions) {
    this.axiosInstance = axios.create({
      baseURL: opts.baseURL,
      timeout: opts.timeoutMs ?? 30_000,
      headers: { "Content-Type": "application/json", ...(opts.defaultHeaders ?? {}) },
      validateStatus: () => true, // Always resolve; inspect status in code
    })

    // Add authorization header to all requests if token is present
    this.axiosInstance.interceptors.request.use((cfg) => {
      if (this.token) {
        cfg.headers = { ...(cfg.headers ?? {}), Authorization: `Bearer ${this.token}` }
      }
      return cfg
    })
  }

  /* ---------------------- Token mgmt ---------------------- */
  setToken(token: string | null) {
    this.token = token
    if (token) this.axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${token}`
    else
      delete (this.axiosInstance.defaults.headers.common as Record<string, string>)["Authorization"]
  }
  clearToken() {
    this.setToken(null)
  }

  /* ---------------------- Core request helper ---------------------- */
  private async request<T = unknown>(cfg: AxiosRequestConfig): Promise<ApiResult<T>> {
    const finalCfg: AxiosRequestConfig = { ...cfg, validateStatus: () => true }
    try {
      // We don't assert the response data type at axios level because server sometimes
      // returns raw body (e.g. file blob) or canonical json wrapper.
      const res = await this.axiosInstance.request(finalCfg)

      // Detect canonical wrapper (has success + message fields)
      const isObj = res.data !== null && typeof res.data === "object"
      let maybeWrapper: ApiResponse<T> | null = null
      if (isObj) {
        const obj = res.data as Record<string, unknown>
        if ("success" in obj && "message" in obj) {
          maybeWrapper = obj as ApiResponse<T>
        }
      }

      const data: T | null = maybeWrapper
        ? (maybeWrapper.data as T | null)
        : (res.data as unknown as T | null)

      return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        wrapper: maybeWrapper,
        data: data ?? null,
        raw: res,
        error: null,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return { ok: false, status: 0, wrapper: null, data: null, raw: null, error: message }
    }
  }

  /* ---------------------- HTTP convenience wrappers ---------------------- */
  private get<T = unknown>(url: string, params?: unknown) {
    return this.request<T>({ method: "GET", url, params })
  }
  private post<T = unknown>(url: string, data?: unknown) {
    return this.request<T>({ method: "POST", url, data })
  }
  private del<T = unknown>(url: string) {
    return this.request<T>({ method: "DELETE", url })
  }
  private postForm<T = unknown>(
    url: string,
    form: FormData,
    onUpload?: (ev: ProgressEvent) => void
  ) {
    return this.request<T>({
      method: "POST",
      url,
      data: form,
      onUploadProgress: onUpload as AxiosRequestConfig["onUploadProgress"],
      // NOTE: axios sets multipart Content-Type (boundary) automatically when FormData is passed.
    })
  }

  /* ---------------------- API methods (explicit types) ---------------------- */

  // -- Database management
  getDb() {
    return this.get<{ exists: boolean }>("/api/db")
  }
  initDb() {
    return this.post<{ message?: string }>("/api/db")
  }

  // -- Authentication
  login(username: string, password: string) {
    return this.post<{ token: string }>("/api/auth/login", { username, password })
  }
  registerVisitor(payload: {
    username: string
    password: string
    can_upload: boolean
    can_delete_own_files: boolean
    has_upload_limits: boolean
    upload_limit: number
  }) {
    return this.post("/api/auth/register", payload)
  }
  ownerRegister(username: string, password: string) {
    return this.post("/api/auth/owner_register", { username, password })
  }
  ownerResetPassword(password: string) {
    return this.post("/api/auth/owner_reset_password", { password })
  }
  visitorResetPassword(username: string, password: string) {
    return this.post("/api/auth/visitor_reset_password", { username, password })
  }

  // -- Audit logs
  getAudit(params?: {
    start?: string
    end?: string
    user_id?: number
    file_id?: number
    event_type?: string
    success?: boolean
    limit?: number
    offset?: number
  }) {
    return this.get<{ data: AuditEntry[] }>("/api/audit", params)
  }

  // -- File management
  uploadChunk(
    metadata: {
      file_id: string
      chunk_index: number
      total_chunks: number
      chunk_size: number
      total_size: number
      filename: string
    },
    chunkFile: File,
    onUploadProgress?: (ev: ProgressEvent) => void
  ) {
    const form = new FormData()
    form.append("metadata", JSON.stringify(metadata))
    form.append("chunk", chunkFile, metadata.filename)
    return this.postForm<{ success: boolean; message?: string }>(
      "/api/files/upload",
      form,
      onUploadProgress
    )
  }

  listFiles(params?: {
    name?: string
    min_size?: number
    max_size?: number
    start_date?: string
    end_date?: string
    limit?: number
    offset?: number
  }) {
    return this.get<FilesListData>("/api/files", params)
  }

  deleteFile(id: number) {
    return this.del<{ success: boolean; message?: string }>(`/api/files/${id}`)
  }

  downloadFile(id: number) {
    // Return ApiResult<null> and keep raw (blob) inside raw.data for caller
    return this.request<null>({
      method: "GET",
      url: `/api/files/download/${id}`,
      responseType: "blob",
    })
  }

  grantFilePerms(id: number, body: { user_id: number; access_level: string }) {
    return this.post(`/api/files/${id}/perms`, body)
  }

  listFilePerms(id: number) {
    return this.get(`/api/files/${id}/perms`)
  }

  revokeFilePerm(id: number, userId: number) {
    return this.del(`/api/files/${id}/perms/${userId}`)
  }

  // -- User management
  getUsers(params?: {
    name?: string
    perm?: string
    is_active?: boolean
    include_deleted?: boolean
    limit?: number
    offset?: number
  }) {
    return this.get<PaginatedUsers>("/api/user", params)
  }

  deleteUser(id: number) {
    return this.del(`/api/user/${id}`)
  }

  toggleUser(id: number) {
    return this.post(`/api/user/${id}/toggle`)
  }

  updateUserPerms(
    id: number,
    body: {
      can_upload?: boolean
      can_delete_own_files?: boolean
      has_upload_limits?: boolean
      upload_limit?: number
    }
  ) {
    return this.post(`/api/user/${id}/perms`, body)
  }

  getAccessibleFiles(id: number) {
    return this.get(`/api/user/${id}/accessible`)
  }

  /* ---------------------- Utilities ---------------------- */
  // Throw error if response is not OK, otherwise return data
  assertOk<T = unknown>(res: ApiResult<T>): T {
    if (res.ok) {
      return res.data as T
    }

    const wrapperMsg = res.wrapper?.message ?? null
    const rawBody = res.raw?.data ?? null
    const base = `HTTP ${res.status}`

    const message = wrapperMsg ?? res.error ?? (rawBody ? JSON.stringify(rawBody) : base)

    throw new ErrorWithResponse(String(message), res)
  }
}

export default ApiClient
