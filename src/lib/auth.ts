import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { auth, db } from './firebase';

const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export type UserRole = 'admin' | 'employee' | null;

export const checkUserRole = async (user: User): Promise<UserRole> => {
  if (!user || !user.email) return null;

  try {
    // Check if user is admin
    const adminDoc = await getDoc(doc(db, 'admins', user.uid));
    if (adminDoc.exists()) {
      return 'admin';
    }

    // Check if user is employee
    const employeeDoc = await getDoc(doc(db, 'employees', user.uid));
    if (employeeDoc.exists()) {
      return 'employee';
    }

    // Migration Logic: Check if user exists with email-based UID
    // This handles cases where Admin added user by email before they signed in
    
    // 1. Check Employees by email
    const employeesRef = collection(db, 'employees');
    // Query both exact match and lowercase match if possible, but for now assume DB has lowercase or exact match
    const q = query(employeesRef, where('email', '==', user.email));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const oldDoc = querySnapshot.docs[0];
      const oldData = oldDoc.data();
      
      console.log('Found existing employee record by email. Migrating to Auth UID:', user.uid);

      try {
        // Create new doc with Auth UID
        await setDoc(doc(db, 'employees', user.uid), {
          ...oldData,
          uid: user.uid, // Ensure UID is in the data
          updatedAt: new Date(),
          migratedAt: new Date()
        });
        console.log('Created new employee record with Auth UID');

        // Try to delete old doc
        try {
          await deleteDoc(doc(db, 'employees', oldDoc.id));
          console.log('Deleted old employee record');
        } catch (deleteError) {
          console.warn('Failed to delete old employee record (likely permission issue). Ignoring.', deleteError);
          // We continue anyway because the user now has a valid record with their Auth UID
        }
        
        return 'employee';
      } catch (migrationError) {
        console.error('Migration failed:', migrationError);
        // If we can't create the new doc, we can't log them in properly as an employee
        // unless we change how the app works. For now, return null.
        return null;
      }
    }

    // 2. Check Admins by email (just in case)
    const adminsRef = collection(db, 'admins');
    const adminQ = query(adminsRef, where('email', '==', user.email));
    const adminSnapshot = await getDocs(adminQ);

    if (!adminSnapshot.empty) {
      const oldDoc = adminSnapshot.docs[0];
      const oldData = oldDoc.data();
      
      console.log('Found existing admin record by email. Migrating to Auth UID:', user.uid);

      try {
        // Create new doc with Auth UID
        await setDoc(doc(db, 'admins', user.uid), {
          ...oldData,
          uid: user.uid,
          updatedAt: new Date(),
          migratedAt: new Date()
        });
        
        try {
          await deleteDoc(doc(db, 'admins', oldDoc.id));
        } catch (deleteError) {
          console.warn('Failed to delete old admin record. Ignoring.', deleteError);
        }
        
        return 'admin';
      } catch (migrationError) {
        console.error('Admin migration failed:', migrationError);
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking user role:', error);
    return null;
  }
};
