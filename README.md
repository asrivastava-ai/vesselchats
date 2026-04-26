# VesselChats v2

Multi-group fleet operations chat platform.

## Features
- Self-signup — any user can register and create/join groups
- Multi-group — one user can belong to multiple shipping companies/groups
- Vessel auto-routing — messages route to vessel tabs by name detection
- Direct messages — private 1:1 chat between any users
- File sharing — images (inline preview), PDF, Word, Excel (up to 10MB)
- Read receipts with initials
- Mentions tab — catch any message with your name or @name
- Email AI summary teaser — placeholder for future email integration
- Mobile responsive with slide-in sidebar

## Firestore Rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    match /groups/{groupId} {
      allow read: if request.auth != null && exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));
      allow create: if request.auth != null;
      allow update: if request.auth != null && get(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)).data.role == 'admin';
    }
    match /groups/{groupId}/members/{uid} {
      allow read: if request.auth != null && exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));
      allow write: if request.auth != null;
    }
    match /groups/{groupId}/vessels/{vid} {
      allow read: if request.auth != null && exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));
      allow write: if request.auth != null && get(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid)).data.role == 'admin';
    }
    match /groups/{groupId}/messages/{mid} {
      allow read, write: if request.auth != null && exists(/databases/$(database)/documents/groups/$(groupId)/members/$(request.auth.uid));
    }
    match /dms/{dmId}/messages/{mid} {
      allow read, write: if request.auth != null;
    }
    match /invites/{token} {
      allow read, write: if request.auth != null;
      allow read: if true;
    }
  }
}
```

## Firebase Storage Rules
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /uploads/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId && request.resource.size < 10 * 1024 * 1024;
    }
  }
}
```

## Deploy
1. Push to GitHub
2. Vercel → New Project → Import → Deploy
3. Connect vesselchats.com domain
4. Sign up at /signup — create your group — invite team
