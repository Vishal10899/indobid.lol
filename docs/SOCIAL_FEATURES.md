# INDOBID — SOCIAL FEATURES SPECIFICATION

---

## 1. Social Submodules Organization (`src/modules/social/`)

| Feature | Service Location | Repository Location | API Route | Database Model |
| :--- | :--- | :--- | :--- | :--- |
| **Likes** | `modules/social/likes/like.service.ts` | `repositories/like.repository.ts` | `POST /api/debates/[id]/like` | `DebateLike` |
| **Bookmarks** | `modules/social/bookmarks/bookmark.service.ts`| `repositories/bookmark.repository.ts` | `POST /api/debates/[id]/bookmark`| `DebateBookmark` |
| **Follows** | `modules/social/follows/follow.service.ts` | `repositories/follow.repository.ts` | `POST /api/users/[user]/follow` | `Follow` |
| **Replies** | `modules/social/comments/comment.service.ts` | `repositories/contribution.repository.ts`| `GET /api/debates/[id]` | `Contribution` |
| **Shares** | `modules/social/shares/share.service.ts` | `repositories/debate.repository.ts` | `GET /api/debates/[id]` | `Debate` |

---

## 2. Notification Integration
All social interactions (Likes, Follows, Replies, Support Backing) trigger synchronous notifications to the target recipient via `NotificationService.create()`.
