import { useEffect, useState } from "react";
import { getAuthUser } from "./auth";
import { getBookLockRef } from "./firebase";
import { onValue, set, onDisconnect, remove } from "firebase/database";

export interface LockStatus {
  lockedBy: string | null;
  lockedByName: string | null;
}

export function useBookLock(bookId: number | undefined, isWriting: boolean) {
  const [lockStatus, setLockStatus] = useState<LockStatus>({ lockedBy: null, lockedByName: null });
  const authUser = getAuthUser();

  useEffect(() => {
    if (!bookId) return;

    const lockRef = getBookLockRef(bookId);

    // Listen for lock changes
    const unsubscribe = onValue(lockRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLockStatus({
          lockedBy: data.userId,
          lockedByName: data.username,
        });
      } else {
        setLockStatus({ lockedBy: null, lockedByName: null });
      }
    });

    return () => unsubscribe();
  }, [bookId]);

  useEffect(() => {
    if (!bookId || !authUser) return;
    
    const lockRef = getBookLockRef(bookId);
    
    if (isWriting) {
      // Try to acquire lock if not already locked by someone else
      if (lockStatus.lockedBy === null || lockStatus.lockedBy === String(authUser.userId)) {
        const lockData = {
          userId: String(authUser.userId),
          username: authUser.username,
          timestamp: Date.now()
        };
        
        set(lockRef, lockData);
        // Remove lock on disconnect
        onDisconnect(lockRef).remove();
      }
    } else {
      // Release lock if we held it
      if (lockStatus.lockedBy === String(authUser.userId)) {
        remove(lockRef);
        onDisconnect(lockRef).cancel();
      }
    }

    // Also cleanup on unmount
    return () => {
      if (isWriting && lockStatus.lockedBy === String(authUser.userId)) {
        remove(lockRef);
        onDisconnect(lockRef).cancel();
      }
    };
  }, [bookId, isWriting, authUser, lockStatus.lockedBy]);

  return lockStatus;
}
