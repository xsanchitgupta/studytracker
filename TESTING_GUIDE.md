# Testing Guide - Playlists & Admin Panel Enhancements

## 🎯 Test Scenarios

### Part 1: Recommended Playlists (User Features)

#### Test 1: Notes on Recommended Playlists
1. **Setup**: Login as a regular user
2. **Action**: Navigate to Playlists page
3. **Action**: Click on a recommended (admin) playlist
4. **Action**: Click on a lecture to open it
5. **Action**: Type notes in the notes editor
6. **Expected**: 
   - Save status shows "Typing..." → "Saving..." → "Saved"
   - Notes persist after page refresh
   - Notes are NOT visible to other users (user-specific)

#### Test 2: Timestamps on Recommended Playlists
1. **Setup**: Open a lecture from a recommended playlist
2. **Action**: Click the bookmark icon (Add Timestamp)
3. **Action**: Enter timestamp (e.g., "5:30") and note
4. **Action**: Click "Add Bookmark"
5. **Expected**:
   - Timestamp appears in the list
   - Clicking timestamp jumps video to that time
   - Timestamps persist after refresh
   - Can delete timestamps

#### Test 3: Completion Tracking
1. **Action**: Click the checkmark next to a lecture in recommended playlist
2. **Expected**:
   - Lecture marks as complete
   - Completion persists after refresh
   - Other users don't see your completion status

#### Test 4: Data Isolation
1. **Action**: Add notes/timestamps to recommended playlist as User A
2. **Action**: Logout and login as User B
3. **Action**: View same recommended playlist
4. **Expected**:
   - User B sees empty notes (not User A's notes)
   - User B has their own independent data

---

### Part 2: Admin Panel Features

#### Test 5: Edit Playlist Description
1. **Setup**: Login as admin
2. **Action**: Navigate to Admin Panel → Playlists tab
3. **Action**: Click on the description text of a playlist
4. **Expected**: Description becomes editable
5. **Action**: Edit text and click Save
6. **Expected**: Description updates, shows success toast

#### Test 6: Bulk Delete Lectures
1. **Action**: In a playlist with multiple lectures
2. **Action**: Select checkboxes next to 2+ lectures
3. **Action**: Click "Delete Selected" (or bulk delete button)
4. **Expected**: 
   - Confirmation dialog appears
   - Selected lectures are deleted
   - List updates immediately

#### Test 7: Reorder Lectures
1. **Action**: Find playlist with 3+ lectures
2. **Action**: Click up arrow on second lecture
3. **Expected**: Lecture moves up one position
4. **Action**: Click down arrow on first lecture
5. **Expected**: Lecture moves down one position
6. **Expected**: Order persists after refresh

#### Test 8: Duplicate Playlist
1. **Action**: Click "More" (⋮) dropdown on a playlist
2. **Action**: Select "Duplicate"
3. **Expected**:
   - New playlist created with "(Copy)" suffix
   - All lectures copied to new playlist
   - New playlist is unpublished by default

#### Test 9: Publish/Unpublish
1. **Action**: Create a new playlist
2. **Action**: Add some lectures
3. **Action**: Click "Publish" button
4. **Expected**: 
   - Playlist becomes visible to users
   - Badge shows "Public"
5. **Action**: Login as regular user
6. **Expected**: Can see the published playlist

---

## 🔧 Debugging Checklist

### If Notes Don't Save on Recommended Playlists:
- [ ] Check browser console for errors
- [ ] Verify Firestore rules deployed: `firebase deploy --only firestore:rules`
- [ ] Check Network tab - should see calls to `admin_playlist_data`
- [ ] Verify user is authenticated

### If Admin Features Don't Work:
- [ ] Verify user has `role: "admin"` in Firestore users collection
- [ ] Check Firestore rules allow admin writes to `playlists_global`
- [ ] Refresh profile in Admin Panel header

### Common Issues:
1. **"Permission denied"**: Deploy Firestore rules
2. **"Document not found"**: Code handles this with setDoc fallback
3. **Notes not persisting**: Check auto-save timer (600ms debounce)

---

## 📊 Expected Firestore Structure After Testing

```
users/
  user123/
    playlists/
      abc123/                    # Personal playlist
        { title, lectures, ... }
    
    admin_playlist_data/
      global456/                 # User data for admin playlist
        {
          lectures: {
            lec1: { notes, completed, timestamps, ... }
            lec2: { notes, completed, timestamps, ... }
          },
          lastUpdated: 1234567890
        }

playlists_global/
  global456/                     # Admin playlist
    {
      title: "Calculus Basics",
      description: "Learn fundamentals",
      lectures: [...],
      isPublic: true,
      syncedToUsers: 5
    }
```

---

## ✅ Success Criteria

All tests should pass with:
- ✅ No console errors
- ✅ Data persists across page refreshes
- ✅ Data isolated per user (for recommended playlists)
- ✅ Admin operations work smoothly
- ✅ UI updates immediately after actions
- ✅ Toast notifications show for all operations

---

## 🚀 Deployment Steps

1. **Deploy Firestore Rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

2. **Test in Development**:
   ```bash
   npm run dev
   ```

3. **Build for Production**:
   ```bash
   npm run build
   ```

4. **Deploy to Firebase Hosting** (if using):
   ```bash
   firebase deploy
   ```

---

## 📝 Additional Notes

### Performance Considerations:
- User data loads only once when recommended playlists load
- Auto-save debounced to 600ms (reduces Firestore writes)
- Firestore queries optimized with proper indexing

### Security:
- All user data isolated by UID
- Admin operations require `role: "admin"` check
- Read-only access to admin playlists for users

### Future Enhancements:
- [ ] Analytics dashboard for admin playlist usage
- [ ] Batch sync operations for multiple users
- [ ] Export user progress reports
- [ ] Playlist templates/categories
