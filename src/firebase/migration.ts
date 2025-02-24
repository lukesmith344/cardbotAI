import { db } from './config';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';

export const migrateUserDocuments = async () => {
  try {
    // Get all user documents
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    // Migrate each document
    for (const docSnapshot of snapshot.docs) {
      const data = docSnapshot.data();
      if (data.firebaseUid && data.firebaseUid !== docSnapshot.id) {
        // Create new document with correct ID
        await setDoc(doc(db, 'users', data.firebaseUid), {
          ...data
        });
        
        // Delete old document
        await deleteDoc(docSnapshot.ref);
        
        console.log(`Migrated user document for ${data.userId}`);
      }
    }
    
    console.log('Migration completed');
  } catch (error) {
    console.error('Migration error:', error);
  }
}; 