export const LIBRARY_FILTERS = [
  "All",
  "Reading",
  "Completed",
  "Plan to Read",
  "On Hold",
  "Dropped",
] as const;

export interface LibraryManga {
  id: string;
  title: string;
  cover: string;
  localCover?: string;
  sourceId?: string;
  status?: "Completed" | "Ongoing" | "Hiatus";
  readingStatus:
    | "reading"
    | "completed"
    | "plan_to_read"
    | "on_hold"
    | "dropped";
  totalChapters?: number;
  currentChapter?: number;
  lastRead?: string;
  unreadCount?: number;
}

export const MOCK_LIBRARY_DATA: LibraryManga[] = [
  {
    id: "1",
    title: "Chainsaw Man",
    cover:
      "https://uploads.mangadex.org/covers/a77742b1-befd-49a4-bff5-1ad4e6b0ef7b/544b82bc-9d7a-4226-8051-7890eb93822e.jpg.512.jpg",
    status: "Ongoing",
    readingStatus: "reading",
    totalChapters: 170,
    currentChapter: 164,
  },
  {
    id: "2",
    title: "One Piece",
    cover:
      "https://uploads.mangadex.org/covers/a1c7c817-4e59-43b7-9365-09675a149a6f/e84e5f96-33c8-47bc-ae8f-8d2a4f478a5e.jpg.512.jpg",
    status: "Ongoing",
    readingStatus: "reading",
    totalChapters: 1120,
    currentChapter: 1110,
  },
  {
    id: "3",
    title: "Jujutsu Kaisen",
    cover:
      "https://uploads.mangadex.org/covers/c52b2ce3-7f95-469c-96b0-479524fb7a1a/f712f5c7-27b5-4b08-963d-4c3116a4459f.jpg.512.jpg",
    status: "Ongoing",
    readingStatus: "reading",
    totalChapters: 260,
    currentChapter: 252,
  },
  {
    id: "4",
    title: "Spy x Family",
    cover:
      "https://uploads.mangadex.org/covers/6b1eb432-81f1-4629-bc78-65c9c1b33383/e009a259-712b-402a-9e1e-af4e7978000c.jpg.512.jpg",
    status: "Ongoing",
    readingStatus: "reading",
    totalChapters: 98,
    currentChapter: 75,
  },
  {
    id: "5",
    title: "Blue Lock",
    cover:
      "https://uploads.mangadex.org/covers/32d76d19-8a05-4db0-9fc2-e0b0648fe9d3/c0d720c7-0131-4835-9509-c45443217d7b.jpg.512.jpg",
    status: "Ongoing",
    readingStatus: "reading",
    totalChapters: 260,
    currentChapter: 245,
  },
  {
    id: "6",
    title: "My Hero Academia",
    cover:
      "https://uploads.mangadex.org/covers/4f3bcae4-2d96-4c9d-932c-90181d9c873e/f8149c48-356c-486a-8b89-a29d6d37667b.jpg.512.jpg",
    status: "Ongoing",
    readingStatus: "reading",
    totalChapters: 420,
    currentChapter: 350,
  },
  {
    id: "7",
    title: "Tokyo Revengers",
    cover:
      "https://uploads.mangadex.org/covers/5e869752-d17e-4053-99f5-3c1212fb9c56/b553e47a-9a99-4d6f-87d9-482458428176.jpg.512.jpg",
    status: "Completed",
    readingStatus: "completed",
    totalChapters: 278,
    currentChapter: 278,
  },
  {
    id: "8",
    title: "Dandadan",
    cover:
      "https://uploads.mangadex.org/covers/191e3e13-96b6-4c62-bd01-f2cbdf3ae566/d1b82e4e-096d-4700-abe0-f9ad549cf0f6.jpg.512.jpg",
    status: "Ongoing",
    readingStatus: "reading",
    totalChapters: 156,
    currentChapter: 40,
  },
  {
    id: "9",
    title: "Berserk",
    cover:
      "https://uploads.mangadex.org/covers/801513ba-a712-498c-8f57-cae55b38cc92/2a613374-633b-4c55-83c9-0417937d571f.jpg.512.jpg",
    status: "Ongoing",
    readingStatus: "reading",
    totalChapters: 376,
    currentChapter: 39,
  },
  {
    id: "10",
    title: "Vagabond",
    cover:
      "https://uploads.mangadex.org/covers/d1a93deb-f713-46d9-8e94-c2c4e808e2d3/b9292c20-6d38-4e89-a99f-7d130644cf32.jpg.512.jpg",
    status: "Completed",
    readingStatus: "completed",
    totalChapters: 327,
    currentChapter: 327,
  },
  {
    id: "11",
    title: "Monster",
    cover:
      "https://uploads.mangadex.org/covers/d0d2388c-3cb2-42df-8d72-9f91eb728c14/831518f8-e9f0-4f51-863a-6ff11ca93d80.jpg.512.jpg",
    status: "Completed",
    readingStatus: "completed",
    totalChapters: 162,
    currentChapter: 162,
  },
];
