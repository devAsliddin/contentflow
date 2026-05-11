# ContentFlow — API Reference

Base URL: `http://localhost:8000/api/v1`

All protected endpoints require: `Authorization: Bearer <access_token>`

---

## Auth

### POST /auth/register
Register a new user.

**Request:**
```typescript
interface RegisterRequest {
  email: string;
  password: string;
  full_name?: string;
}
```

**Response:**
```typescript
interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: UserOut;
}
```

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123","full_name":"John"}'
```

---

### POST /auth/login
Login with email + password.

**Request:**
```typescript
interface LoginRequest {
  email: string;
  password: string;
}
```

**Response:** `AuthResponse` (same as register)

---

### POST /auth/refresh
Refresh access token.

**Request:**
```typescript
interface RefreshRequest {
  refresh_token: string;
}
```

**Response:** `AuthResponse`

---

### GET /auth/me
Get current user profile. **Auth required.**

**Response:**
```typescript
interface UserOut {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}
```

---

## Posts

### POST /posts
Create a new post. **Auth required.**

**Request:**
```typescript
interface CreatePostRequest {
  caption?: string;
  media_url?: string;
  media_type?: "image" | "video";
  platforms: string[];      // ["instagram:acc_id", "telegram:acc_id"]
  scheduled_at?: string;    // ISO 8601, null = post now
}
```

**Response:**
```typescript
interface PostOut {
  id: string;
  user_id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  platforms: string[];
  scheduled_at: string | null;
  status: "draft" | "scheduled" | "publishing" | "published" | "failed";
  created_at: string;
  updated_at: string;
}
```

---

### GET /posts
List posts. **Auth required.**

**Query params:** `skip=0&limit=20&status=scheduled`

**Response:** `PostOut[]`

---

### GET /posts/{post_id}
Get single post. **Auth required.**

**Response:** `PostOut`

---

### PUT /posts/{post_id}
Update post. **Auth required.**

**Request:** Partial `CreatePostRequest`

**Response:** `PostOut`

---

### DELETE /posts/{post_id}
Delete post. **Auth required.** Returns `204 No Content`.

---

## Accounts

### POST /accounts
Connect a social account. **Auth required.**

**Request:**
```typescript
interface ConnectAccountRequest {
  platform: "instagram" | "tiktok" | "telegram";
  account_name: string;
  credentials: {
    // telegram
    bot_token?: string;
    channel_id?: string;
    // instagram
    access_token?: string;
    account_id?: string;
    // tiktok
    access_token?: string;
    open_id?: string;
  };
}
```

**Response:**
```typescript
interface AccountOut {
  id: string;
  user_id: string;
  platform: string;
  account_name: string;
  is_active: boolean;
  created_at: string;
}
```

---

### GET /accounts
List connected accounts. **Auth required.**

**Query params:** `platform=instagram`

**Response:** `AccountOut[]`

---

### DELETE /accounts/{account_id}
Disconnect account. **Auth required.** Returns `204 No Content`.

---

### POST /accounts/{account_id}/verify
Verify account credentials are still valid. **Auth required.**

**Response:** `{"valid": true, "message": "Account verified"}`

---

## AI

### POST /ai/generate-plan
Generate a weekly content plan. **Auth required.**

**Request:**
```typescript
interface GeneratePlanRequest {
  niche: string;
  frequency: number;       // posts per week
  tone: string;            // "professional" | "casual" | "humorous" | "educational"
  platforms: string[];     // ["instagram", "telegram", "tiktok"]
  language?: string;       // default "en"
}
```

**Response:**
```typescript
interface WeeklyPlan {
  week_start: string;
  days: {
    day: string;           // "Monday" etc
    posts: {
      platform: string;
      content_idea: string;
      caption_suggestion: string;
      hashtags: string[];
      best_time: string;   // "18:00"
    }[];
  }[];
}
```

---

### POST /ai/generate-caption
Generate a caption for a post. **Auth required.**

**Request:**
```typescript
interface GenerateCaptionRequest {
  topic: string;
  platform: "instagram" | "tiktok" | "telegram";
  tone: string;
  language?: string;
}
```

**Response:**
```typescript
interface CaptionResponse {
  caption: string;
  hashtags: string[];
  character_count: number;
}
```

---

### POST /ai/suggest-ideas
Get 5 post ideas based on recent history. **Auth required.**

**Response:**
```typescript
interface IdeasResponse {
  ideas: {
    title: string;
    description: string;
    platform: string;
    content_type: "image" | "video" | "text";
  }[];
}
```

---

## Analytics

### GET /analytics/overview
Overview stats for current week. **Auth required.**

**Response:**
```typescript
interface AnalyticsOverview {
  total_posts: number;
  scheduled: number;
  published: number;
  failed: number;
  week_start: string;
  week_end: string;
}
```

---

### GET /analytics/by-platform
Breakdown by platform. **Auth required.**

**Response:**
```typescript
interface PlatformAnalytics {
  platform: string;
  total: number;
  published: number;
  failed: number;
}[]
```

---

## Upload

### POST /upload/media
Upload media file. **Auth required.**

**Request:** `multipart/form-data` with field `file`

Limits:
- Images: max 20MB (jpg, png, webp)
- Videos: max 500MB (mp4, mov)

**Response:**
```typescript
interface UploadResponse {
  url: string;              // /media/filename.ext
  filename: string;
  media_type: "image" | "video";
  size_bytes: number;
}
```

---

## Health

### GET /health
Health check (no auth).

**Response:** `{"status": "ok", "timestamp": "..."}`
