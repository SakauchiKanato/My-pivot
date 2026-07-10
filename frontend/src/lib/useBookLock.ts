import { useEffect, useState, useMemo } from "react";
import { getAuthUser } from "./auth";
import { getBookLockRef } from "./firebase";
import { onValue, set, onDisconnect, remove } from "firebase/database";

export interface LockStatus {
  lockedBy: string | null;
  lockedByName: string | null;
}

export function useBookLock(bookId: number | undefined, isWriting: boolean) {
  const [lockStatus, setLockStatus] = useState<LockStatus>({ lockedBy: null, lockedByName: null });
  
  // Memoize authUser to prevent changing reference on every render
  const authUser = useMemo(() => getAuthUser(), []);
  const userId = authUser ? String(authUser.userId) : null;
  const username = authUser ? authUser.username : null;

  useEffect(() => {
    if (!bookId) return;

    const lockRef = getBookLockRef(bookId);

    // Listen for lock changes
    const unsubscribe = onValue(lockRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLockStatus(prev => {
          if (prev.lockedBy === data.userId && prev.lockedByName === data.username) return prev;
          return {
            lockedBy: data.userId,
            lockedByName: data.username,
          };
        });
      } else {
        setLockStatus(prev => {
          if (prev.lockedBy === null && prev.lockedByName === null) return prev;
          return { lockedBy: null, lockedByName: null };
        });
      }
    });

    return () => unsubscribe();
  }, [bookId]);

  useEffect(() => {
    if (!bookId || !userId || !username) return;
    
    const lockRef = getBookLockRef(bookId);
    
    if (isWriting) {
      // Try to acquire lock if not already locked by someone else
      if (lockStatus.lockedBy === null || lockStatus.lockedBy === userId) {
        const lockData = {
          userId: userId,
          username: username,
          timestamp: Date.now()
        };
        
        set(lockRef, lockData);
        // Remove lock on disconnect
        onDisconnect(lockRef).remove();
      }
    } else {
      // Release lock if we held it
      if (lockStatus.lockedBy === userId) {
        remove(lockRef);
        onDisconnect(lockRef).cancel();
      }
    }

    // Also cleanup on unmount
    return () => {
      if (isWriting && lockStatus.lockedBy === userId) {
        remove(lockRef);
        onDisconnect(lockRef).cancel();
      }
    };
  }, [bookId, isWriting, userId, username, lockStatus.lockedBy]);

  return lockStatus;
}
