# V3: Post Preview & Platform Mockup System

## Goal
Add a live preview panel to the New Post page so users can see exactly how their content will appear on each connected platform before publishing.

## Components

### Frontend — `src/components/preview/`
- ContentTypeSelector.tsx — Post | Story | Reels/Short picker
- MediaUploader.tsx — Upload with aspect-ratio crop frame
- PlatformPreview/ — One pixel-accurate component per platform
  - InstagramPostPreview.tsx
  - InstagramStoryPreview.tsx
  - TikTokPreview.tsx
  - TelegramPreview.tsx
  - FacebookPreview.tsx
  - LinkedInPreview.tsx
  - YouTubePreview.tsx
  - XTwitterPreview.tsx
- PreviewSwitcher.tsx — Tab/carousel switcher
- PreviewScreen.tsx — Full page container with left editor + right preview

### Backend
- `GET /api/v1/accounts/connected` — returns connected platforms with username + avatar_url

## Acceptance Criteria
- Correct aspect ratios: post=1:1/4:5, story/reels=9:16
- Platform-native chrome (header, actions, captions)
- Real username/avatar from connected accounts
- Schedule and Post Now buttons present
