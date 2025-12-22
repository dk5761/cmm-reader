export interface MangaDetail {
  id: string;
  title: string;
  author: string;
  cover: string;
  description: string;
  genres: string[];
  status: "Ongoing" | "Completed" | "Hiatus";
  isLiked: boolean;
  chapters: Chapter[];
}

export interface Chapter {
  id: string;
  number: number;
  title?: string;
  date: string;
  isRead: boolean;
  isNew?: boolean;
}

export const MOCK_MANGA_DETAIL: MangaDetail = {
  id: "1",
  title: "19 Tian",
  author: "Old Xian",
  cover:
    "https://uploads.mangadex.org/covers/0bc5fb93-8fd8-4e34-80d9-494d3dec87c0/69f6b7eb-9c0f-4f16-a7ac-c9a8f879a1cc.jpg",
  description:
    "Lorem ipsum dolor sit amet elit elit, consectetur adipiscing elit. Tellus, nunc sem non ultricies augue ornare dolor ut nunc. Porttitor ante felis elit faucibus iaculis integer egestas aenean. Ultrices lectus maecenas placerat rhoncus, semper ut diam elit rutrum donec. Ultrices lectus maecenas placerat rhoncus.",
  genres: ["Comedy", "Shounen Ai", "School Life"],
  status: "Ongoing",
  isLiked: true,
  chapters: [
    { id: "436", number: 436, date: "28/06/2020", isRead: false, isNew: true },
    { id: "435", number: 435, date: "28/06/2020", isRead: true },
    { id: "434", number: 434, date: "28/06/2020", isRead: true },
    { id: "433", number: 433, date: "28/06/2020", isRead: true },
    { id: "432", number: 432, date: "28/06/2020", isRead: true },
    { id: "431", number: 431, date: "28/06/2020", isRead: true },
    { id: "430", number: 430, date: "28/06/2020", isRead: true },
    { id: "429", number: 429, date: "28/06/2020", isRead: true },
    { id: "428", number: 428, date: "28/06/2020", isRead: true },
  ],
};
