/**
 * Firestore Indexes Configuration
 *
 * This file documents the required composite indexes for Firebase Firestore.
 * These indexes must be created in the Firestore console for optimal query performance.
 *
 * To create these indexes:
 * 1. Go to Firebase Console → Firestore → Indexes
 * 2. Click "Add Index"
 * 3. Configure each index as documented below
 * 4. Or use the Firebase CLI with the indexes JSON below
 */

/**
 * Index definitions in Firestore console format
 */
export const FIRESTORE_INDEX_DEFINITIONS = [
  {
    collection: "manga",
    fields: [
      { field: "readingStatus", order: "ASCENDING" },
      { field: "lastUpdated", order: "DESCENDING" },
    ],
    description: "Filter by reading status, sort by last updated",
  },
  {
    collection: "manga",
    fields: [
      { field: "sourceId", order: "ASCENDING" },
      { field: "_modified", order: "DESCENDING" },
    ],
    description: "Sync by source, get recently modified",
  },
  {
    collection: "manga",
    fields: [
      { field: "_deleted", order: "ASCENDING" },
      { field: "_modified", order: "DESCENDING" },
    ],
    description: "Exclude deleted, get recent changes",
  },
  {
    collection: "manga",
    fields: [
      { field: "userId", order: "ASCENDING" },
      { field: "_modified", order: "DESCENDING" },
    ],
    description: "User's manga ordered by modification time",
  },
];

/**
 * Firestore indexes JSON format for Firebase CLI
 *
 * Save this as `firestore.indexes.json` in your project root
 * and run: `firebase deploy --only firestore:indexes`
 */
export const FIRESTORE_INDEXES_JSON = {
  indexes: [
    {
      collectionGroup: "manga",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "readingStatus", order: "ASCENDING" },
        { fieldPath: "lastUpdated", order: "DESCENDING" },
      ],
    },
    {
      collectionGroup: "manga",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "sourceId", order: "ASCENDING" },
        { fieldPath: "_modified", order: "DESCENDING" },
      ],
    },
    {
      collectionGroup: "manga",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "_deleted", order: "ASCENDING" },
        { fieldPath: "_modified", order: "DESCENDING" },
      ],
    },
    {
      collectionGroup: "chapters",
      queryScope: "COLLECTION",
      fields: [
        { fieldPath: "mangaId", order: "ASCENDING" },
        { fieldPath: "number", order: "DESCENDING" },
      ],
    },
  ],
  fieldOverrides: [],
};

/**
 * Single field indexes (auto-created by Firestore)
 * Documented here for reference
 */
export const SINGLE_FIELD_INDEXES = [
  { collection: "manga", field: "_created", order: "DESCENDING" },
  { collection: "manga", field: "_modified", order: "DESCENDING" },
  { collection: "manga", field: "sourceId", order: "ASCENDING" },
  { collection: "manga", field: "status", order: "ASCENDING" },
  { collection: "chapters", field: "mangaId", order: "ASCENDING" },
  { collection: "chapters", field: "number", order: "ASCENDING" },
  { collection: "history", field: "lastReadTimestamp", order: "DESCENDING" },
  { collection: "categories", field: "order", order: "ASCENDING" },
];

/**
 * Print instructions for creating indexes
 */
export function printIndexInstructions(): void {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║          FIRESTORE INDEXES - SETUP INSTRUCTIONS                  ║
╚═══════════════════════════════════════════════════════════════════╝

The following composite indexes must be created in Firestore:

${FIRESTORE_INDEX_DEFINITIONS.map((index, i) => `
${i + 1}. Collection: ${index.collection}
   Fields: ${index.fields.map((f) => `${f.field} ${f.order}`).join(", ")}
   Description: ${index.description}
`).join("")}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OPTIONAL: Use Firebase CLI

1. Create a file named 'firestore.indexes.json' in your project root:

${JSON.stringify(FIRESTORE_INDEXES_JSON, null, 2)}

2. Run: firebase deploy --only firestore:indexes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To verify indexes are created:
1. Go to Firebase Console → Firestore → Indexes
2. All indexes above should be listed

`);
}

/**
 * Validate that required indexes exist
 * This would typically be called during app initialization
 */
export async function validateIndexes(): Promise<boolean> {
  // TODO: Implement index validation using Firestore API
  // This would check if all required indexes exist
  console.log("[FirestoreIndexes] Validation not yet implemented");
  return true;
}

/**
 * Get index creation SQL for different environments
 */
export const FIRESTORE_INDEX_SQL = {
  // For Firebase CLI deployment
  cli: FIRESTORE_INDEXES_JSON,

  // For manual console creation
  manual: FIRESTORE_INDEX_DEFINITIONS,
};
