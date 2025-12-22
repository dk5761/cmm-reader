---
description: Feature Folder pattern
---

# Feature Implementation Pattern

This document describes the standard patterns for implementing master/CRUD features in this codebase. Use **RegionMaster** as the reference implementation.

---

## Table of Contents

1. [Folder Structure](#1-folder-structure)
2. [API Layer](#2-api-layer)
3. [Constants & Options](#3-constants--options)
4. [Forms with React Hook Form](#4-forms-with-react-hook-form)
5. [Sheet/Drawer Components](#5-sheetdrawer-components)
6. [Table Page with Filters](#6-table-page-with-filters)
7. [Shared Components](#7-shared-components)

---

## 1. Folder Structure

```
src/features/[Domain]/[FeatureName]/
├── api/
│   ├── index.ts                    # Barrel exports
│   ├── [feature].types.ts          # TypeScript interfaces
│   ├── [feature].queries.ts        # React Query hooks
│   ├── [feature].queryfactory.ts   # Query key factory
│   └── [feature].mock.ts           # Mock data (optional)
├── components/
│   ├── index.ts
│   └── [Feature]Sheet.tsx          # Sheet/drawer wrapper
├── constants/
│   ├── index.ts
│   └── options.ts                  # Dropdown options, enums
├── forms/
│   ├── index.ts
│   └── [Feature]Form/
│       ├── index.ts
│       └── [Feature]Form.tsx       # Form component
├── pages/
│   ├── index.ts
│   └── [Feature].tsx               # Main page component
└── index.ts                        # Feature barrel export
```

**Reference:** [RegionMaster](file:///Users/drshnk/Developer/office/client-panel/src/features/Allocation/RegionMaster)

---

## 2. API Layer

### 2.1 Types Definition

```typescript
// api/region-master.types.ts
export interface RegionMasterItem {
  id: string;
  region_ref_number: string;
  state: string;
  city: string;
  // ... other fields
}

export interface RegionMasterListResponse {
  regions: RegionMasterItem[];
  current_page: number;
  pages: number;
  total_count: number;
}

export interface RegionMasterListOptions {
  page: number;
  state?: string;
  city?: string;
  // ... filter options
}
```

**Reference:** [region-master.types.ts](file:///Users/drshnk/Developer/office/client-panel/src/features/Allocation/RegionMaster/api/region-master.types.ts)

### 2.2 Query Factory

```typescript
// api/region-master.queryfactory.ts
import { generateOptimizedOptions } from "@src/utils/utils";

export const REGION_MASTER_QUERY_FACTORY = {
  all: () => ["allocation", "region-master"],
  getRegionMasterList: (options: RegionMasterListOptions) => [
    ...REGION_MASTER_QUERY_FACTORY.all(),
    "list",
    generateOptimizedOptions(options),
  ],
};
```

**Reference:** [region-master.queryfactory.ts](file:///Users/drshnk/Developer/office/client-panel/src/features/Allocation/RegionMaster/api/region-master.queryfactory.ts)

### 2.3 Query Function

```typescript
// api/region-master.queries.ts
import { queryOptions } from "@tanstack/react-query";

export const getRegionMasterListFn = (
  options: RegionMasterListOptions,
  enabled = true
) =>
  queryOptions({
    queryKey: REGION_MASTER_QUERY_FACTORY.getRegionMasterList(options),
    queryFn: async (): Promise<RegionMasterListResponse> => {
      // Replace with actual API call
      const response = await getMockRegionMasterList(options);
      return response;
    },
    enabled: enabled,
  });
```

**Reference:** [region-master.queries.ts](file:///Users/drshnk/Developer/office/client-panel/src/features/Allocation/RegionMaster/api/region-master.queries.ts)

---

## 3. Constants & Options

```typescript
// constants/options.ts
const locationTypeOptions = [
  { label: "Urban", value: "Urban" },
  { label: "Semi Urban", value: "Semi Urban" },
  { label: "Rural", value: "Rural" },
];

export { locationTypeOptions };
```

**Reference:** [options.ts](file:///Users/drshnk/Developer/office/client-panel/src/features/Allocation/RegionMaster/constants/options.ts)

---

## 4. Forms with React Hook Form

### 4.1 Form Component Structure

```typescript
// forms/RegionForm/RegionForm.tsx
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Input,
  Dropdown,
  useSheetContext,
} from "@tech-admin-getrezolv/ui-components";
import { z } from "zod";

// Schema
const regionFormSchema = z.object({
  state: z.string(),
  location_type: z.enum(["Urban", "Semi Urban", "Rural"]),
  area: z.string().min(1, "Area is required"),
});

type RegionFormData = z.infer<typeof regionFormSchema>;

const RegionForm = ({ regionData, onFormSubmit }: Props) => {
  const { close } = useSheetContext();

  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegionFormData>({
    resolver: zodResolver(regionFormSchema),
    mode: "all",
    defaultValues: {
      /* ... */
    },
  });

  return (
    <form onSubmit={handleSubmit(onFormSubmit)}>
      {/* Disabled Input */}
      <Controller
        control={control}
        name="state"
        render={({ field }) => (
          <Input label="State" value={field.value} disabled />
        )}
      />

      {/* Dropdown Input */}
      <Controller
        control={control}
        name="location_type"
        render={({ field }) => (
          <Dropdown>
            <Dropdown.Toggle>
              <Input label="Location Type" value={field.value} readOnly />
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {options.map((option) => (
                <Dropdown.Item
                  key={option.value}
                  onClick={() => field.onChange(option.value)}
                  active={field.value === option.value}
                >
                  {option.label}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        )}
      />

      {/* Editable Input */}
      <Controller
        control={control}
        name="area"
        render={({ field }) => (
          <Input
            label="Area"
            value={field.value}
            onChange={field.onChange}
            error={!!errors.area}
            errorMessage={errors.area?.message}
          />
        )}
      />

      {/* Actions */}
      <Button intent="inverse" onClick={() => close()}>
        Cancel
      </Button>
      <Button type="submit" intent="primary">
        Save
      </Button>
    </form>
  );
};
```

**Reference:** [RegionForm.tsx](file:///Users/drshnk/Developer/office/client-panel/src/features/Allocation/RegionMaster/forms/RegionForm/RegionForm.tsx)

---

## 5. Sheet/Drawer Components

### 5.1 NSheet Pattern

```typescript
// components/RegionSheet.tsx
import { NSheet, useSheetContext } from "@tech-admin-getrezolv/ui-components";
import { CloseIcon } from "@src/common/icons";

type RegionSheetProps = {
  regionData: RegionMasterItem;
  trigger: React.ReactNode;
};

const RegionSheetContent = ({ regionData, trigger }: Props) => {
  const { close } = useSheetContext();

  const handleSubmit = (formData: RegionFormData) => {
    // API call here
    toast.success({ title: "Success", description: "Updated successfully" });
    close();
  };

  return (
    <>
      <NSheet.Trigger asChild>{trigger}</NSheet.Trigger>
      <NSheet.Content width="400px">
        <NSheet.Header>
          <div className="flex justify-between items-center">
            <NSheet.Title>Edit Region</NSheet.Title>
            <NSheet.Close>
              <CloseIcon className="cursor-pointer" />
            </NSheet.Close>
          </div>
        </NSheet.Header>
        <RegionForm regionData={regionData} onFormSubmit={handleSubmit} />
      </NSheet.Content>
    </>
  );
};

const RegionSheet = ({ regionData, trigger }: RegionSheetProps) => (
  <NSheet>
    <RegionSheetContent regionData={regionData} trigger={trigger} />
  </NSheet>
);
```

**Reference:** [RegionSheet.tsx](file:///Users/drshnk/Developer/office/client-panel/src/features/Allocation/RegionMaster/components/RegionSheet.tsx)

---

## 6. Table Page with Filters

### 6.1 Page Component Structure

```typescript
// pages/RegionMaster.tsx
import { PageLayout } from "@src/components/PageLayout/PageLayout";
import { SearchWithDropdownV2 } from "@src/components";
import { useUrlFilters } from "@src/hooks/useUrlFilters";
import { useUrlPagination } from "@src/hooks/useUrlPagination";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import {
  CustomTable,
  Pagination,
  Dropdown,
  Input,
} from "@tech-admin-getrezolv/ui-components";

// Filter Config
export const REGION_CONFIG = [
  { name: "location_type", defaultValue: "" },
  { name: "city", defaultValue: "", hidden: false },
] as const;

const RegionMaster = () => {
  // Hooks
  const { filters, setFilterValue, replaceFilters } =
    useUrlFilters(REGION_CONFIG);
  const { currentPage, setCurrentPage } = useUrlPagination({
    defaultPage: 1,
    resetDependencies: [filters.city, filters.location_type],
  });

  // Query
  const { data, isLoading, isFetching, isError } = useQuery(
    getRegionMasterListFn({ page: currentPage, ...filters })
  );

  // Columns
  const columnHelper = createColumnHelper<
    RegionMasterItem & { actions: string }
  >();
  const columns = useMemo(
    () => [
      columnHelper.accessor("state", {
        cell: (info) => info.getValue(),
        header: "State",
      }),
      // ... more columns
      columnHelper.accessor("actions", {
        cell: (info) => (
          <RegionSheet
            regionData={info.row.original}
            trigger={
              <Button intent="link">
                <Pencil />
              </Button>
            }
          />
        ),
        header: "Actions",
      }),
    ],
    []
  );

  return (
    <PageLayout>
      <PageLayout.Body>
        <PageLayout.Header>
          <div className="flex justify-between items-center w-full">
            <div className="flex flex-row items-center gap-3">
              {/* Search Component */}
              <SearchWithDropdownV2
                options={searchDropdownOptions}
                filters={filters}
                onSearch={handleSearch}
                onFieldChange={handleFieldChange}
                labelMap={SEARCH_LABEL_MAP}
                autoSearchOnClear={true}
                defaultSearchField="city"
              />
              {/* Filter Dropdown */}
              <Dropdown>
                <Dropdown.Toggle>
                  <Input
                    label="Location Type"
                    value={filters.location_type}
                    readOnly
                  />
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {options.map((option) => (
                    <Dropdown.Item
                      onClick={() =>
                        setFilterValue("location_type", option.value)
                      }
                      active={option.value === filters.location_type}
                    >
                      {option.label}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </div>
        </PageLayout.Header>

        <PageLayout.Content>
          <CustomTable
            columnProps={columns}
            dataProps={data?.regions ?? []}
            isLoading={isLoading}
            isFetching={isFetching}
            isError={isError}
          />
        </PageLayout.Content>

        <PageLayout.Footer>
          <Pagination
            currentPage={currentPage}
            totalPages={data?.pages ?? 1}
            onPageChange={setCurrentPage}
          />
        </PageLayout.Footer>
      </PageLayout.Body>
    </PageLayout>
  );
};
```

**Reference:** [RegionMaster.tsx](file:///Users/drshnk/Developer/office/client-panel/src/features/Allocation/RegionMaster/pages/RegionMaster.tsx)

---

## 7. Shared Components

### 7.1 SearchWithDropdownV2

A reusable search component with field selector dropdown.

```typescript
import { SearchWithDropdownV2 } from "@src/components";

<SearchWithDropdownV2
  options={[
    { value: "city", name: "City" },
    { value: "pincode", name: "Pincode" },
  ]}
  filters={filters}
  onSearch={(key, value) =>
    replaceFilters(["city", "pincode"], { [key]: value })
  }
  onFieldChange={(newField, allFieldNames) =>
    replaceFilters(allFieldNames, { [newField]: "" })
  }
  labelMap={[
    { value: "city", label: "Search by City" },
    { value: "pincode", label: "Search by Pincode" },
  ]}
  autoSearchOnClear={true}
  defaultSearchField="city"
/>;
```

**Reference:** [SearchWithDropdownV2.tsx](file:///Users/drshnk/Developer/office/client-panel/src/components/SearchWithDropdownV2/SearchWithDropdownV2.tsx)

---

## Quick Reference

| Pattern        | File Reference                          |
| -------------- | --------------------------------------- |
| Types          | `api/[feature].types.ts`                |
| Query Factory  | `api/[feature].queryfactory.ts`         |
| Query Function | `api/[feature].queries.ts`              |
| Form with Zod  | `forms/[Feature]Form/[Feature]Form.tsx` |
| Sheet/Drawer   | `components/[Feature]Sheet.tsx`         |
| Table Page     | `pages/[Feature].tsx`                   |
| Filter Options | `constants/options.ts`                  |
