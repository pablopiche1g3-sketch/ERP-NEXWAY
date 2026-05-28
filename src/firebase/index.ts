
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection as firestoreCollection, doc as firestoreDoc, DocumentReference, CollectionReference } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from './config';

export function initializeFirebase() {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  return { app, db, auth };
}

export function getTenantName(): string | null {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem('nexway_tenant');
  }
  return null;
}

export function collection(db: any, ...pathSegments: string[]): CollectionReference {
  const tenant = getTenantName();
  if (tenant && pathSegments[0] !== 'users') {
    return firestoreCollection(db, 'tenants', tenant, ...pathSegments);
  }
  return firestoreCollection(db, pathSegments[0], ...pathSegments.slice(1));
}

export function doc(dbOrCollection: any, ...pathSegments: string[]): DocumentReference {
  if (dbOrCollection && typeof dbOrCollection.path === 'string') {
    return firestoreDoc(dbOrCollection, ...pathSegments);
  }
  
  const tenant = getTenantName();
  if (tenant && pathSegments[0] !== 'users') {
    return firestoreDoc(dbOrCollection, 'tenants', tenant, ...pathSegments);
  }
  return firestoreDoc(dbOrCollection, pathSegments[0], ...pathSegments.slice(1));
}

export * from './provider';
export * from './auth/use-user';
export * from './firestore/use-doc';
export * from './firestore/use-collection';
export * from './client-provider';
