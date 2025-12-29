import React from "react";
import { RealmProvider as BaseRealmProvider } from "@realm/react";
import { realmSchemas } from "./schema";

type DatabaseProviderProps = {
  children: React.ReactNode;
};

/**
 * Database provider wrapping the app with Realm context
 * All components can use useRealm, useQuery, useObject hooks
 */
export function DatabaseProvider({ children }: DatabaseProviderProps) {
  return (
    <BaseRealmProvider
      schema={realmSchemas}
      schemaVersion={4}
      onMigration={(oldRealm, newRealm) => {
        // Migration from version 1 to 2: added localCover property
        // Migration from version 2 to 3: added ReadingHistorySchema
        // Migration from version 3 to 4: added mangaUrl to ReadingHistorySchema
        // No data migration needed - new schemas/properties are auto-handled
      }}
    >
      {children}
    </BaseRealmProvider>
  );
}
