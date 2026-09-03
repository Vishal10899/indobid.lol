# INDOBID — SOCIAL FEATURES ARCHITECTURE SPECIFICATION

**Document Version:** 2.0.0  
**Status:** Authoritative Social Feature Reference  
**Modules:** `src/modules/social/`  

---

## 1. Modular Social Architecture Overview

Social features in IndoBid are organized into self-contained submodules under `src/modules/social/`:
* `likes/`: Post likes and aggregate counters.
* `bookmarks/`: Private saved opinions.
* `follows/`: User-to-user subscription graph.
* `comments/`: Discussion responses and sequential replies.
* `shares/`: Public sharing counters and telemetry.
* `messages/`: Private direct message threads.

---

## 2. Submodule Breakdown

### 2.1 Likes (`src/modules/social/likes/`)
* **Service:** `LikeService` (`likeService.likeDebate()`, `likeService.unlikeDebate()`)
* **Repository:** `LikeRepository` (`likeRepository.findUnique()`, `likeRepository.create()`, `likeRepository.delete()`)
* **Constraint:** Database compound unique index `UNIQUE (debateId, userId)` guarantees exactly 1 like per user per opinion.
* **API:** `POST /api/debates/[id]/like`

### 2.2 Bookmarks (`src/modules/social/bookmarks/`)
* **Service:** `BookmarkService` (`bookmarkService.toggleBookmark()`, `bookmarkService.getUserBookmarks()`)
* **Repository:** `BookmarkRepository` (`bookmarkRepository.findUnique()`, `bookmarkRepository.create()`, `bookmarkRepository.delete()`)
* **Constraint:** Database compound unique index `UNIQUE (debateId, userId)` guarantees idempotent bookmarking.
* **API:** `POST /api/debates/[id]/bookmark`, `GET /api/saved`

### 2.3 Follows (`src/modules/social/follows/`)
* **Service:** `FollowService` (`followService.follow()`, `followService.unfollow()`, `followService.isFollowing()`)
* **Repository:** `FollowRepository` (`followRepository.findUnique()`, `followRepository.create()`, `followRepository.delete()`, `followRepository.countFollowers()`)
* **Rules:** Self-following is rejected at application level. Compound index `UNIQUE (followerId, followingId)` prevents duplicate edges in the social graph.
* **API:** `POST /api/users/[username]/follow`

### 2.4 Comments & Responses (`src/modules/social/comments/`)
* **Service:** `CommentService`
* **Repository:** `ContributionRepository`
* **Rules:** Responses form the sequential contribution chain of a debate. Free responses create verified sequence entries with 0 paise amount. Paid responses trigger backing fulfillment.
* **API:** `GET /api/debates/[id]`, `POST /api/debates/[id]/continue`

### 2.5 Shares (`src/modules/social/shares/`)
* **Service:** `ShareService`
* **Repository:** `DebateRepository`
* **API:** Public social sharing endpoints.

### 2.6 Direct Messages (`src/modules/social/messages/`)
* **Service:** `MessageService` (`messageService.getOrCreateConversation()`, `messageService.sendMessage()`, `messageService.getConversationMessages()`, `messageService.markAsRead()`)
* **Repository:** `MessageRepository`
* **Rules:** Direct messages are grouped by canonical participant pairs `(p1, p2)` where `p1 < p2`. Only conversation participants can view or send messages in the thread.
* **API:** `GET /api/messages`, `POST /api/messages`, `GET /api/messages/[conversationId]`, `POST /api/messages/[conversationId]`
