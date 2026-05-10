
export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  path: string;
  operation: string;
  requestResourceData?: any;

  constructor(context: SecurityRuleContext) {
    super(`FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
{
  "method": "${context.operation}",
  "path": "${context.path}"
}`);
    this.name = 'FirestorePermissionError';
    this.path = context.path;
    this.operation = context.operation;
    this.requestResourceData = context.requestResourceData;
  }
}
