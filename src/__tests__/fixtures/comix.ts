/**
 * Test fixtures for Comix API responses
 */

export const mockComixManga = {
  hash_id: "test-manga-123",
  title: "Test Manga Title",
  alt_titles: ["Alternative Title 1", "Alternative Title 2"],
  synopsis: "This is a test manga synopsis with some description",
  type: "manga",
  poster: {
    small: "https://example.com/small.jpg",
    medium: "https://example.com/medium.jpg",
    large: "https://example.com/large.jpg",
  },
  status: "releasing",
  is_nsfw: false,
  author: [
    {
      term_id: 1,
      type: "author",
      title: "Test Author",
      slug: "test-author",
      count: 10,
    },
  ],
  artist: [
    {
      term_id: 2,
      type: "artist",
      title: "Test Artist",
      slug: "test-artist",
      count: 5,
    },
  ],
  genre: [
    { term_id: 6, type: "genre", title: "Action", slug: "action", count: 100 },
    {
      term_id: 23,
      type: "genre",
      title: "Romance",
      slug: "romance",
      count: 80,
    },
  ],
  theme: [
    {
      term_id: 54,
      type: "theme",
      title: "Reincarnation",
      slug: "reincarnation",
      count: 50,
    },
  ],
  demographic: [
    {
      term_id: 2,
      type: "demographic",
      title: "Shounen",
      slug: "shounen",
      count: 200,
    },
  ],
  rated_avg: 8.5,
};

export const mockComixSearchResponse = {
  result: {
    items: [mockComixManga],
    pagination: {
      current_page: 1,
      last_page: 10,
    },
  },
};

export const mockComixChapter = {
  chapter_id: 12345,
  scanlation_group_id: 100,
  number: 1,
  name: "The Beginning",
  votes: 150,
  updated_at: 1704067200, // 2024-01-01
  scanlation_group: {
    name: "Test Scans",
  },
  is_official: 0,
};

export const mockComixChapterList = {
  result: {
    items: [
      mockComixChapter,
      {
        ...mockComixChapter,
        chapter_id: 12346,
        number: 2,
        name: "The Journey",
        updated_at: 1704153600, // 2024-01-02
      },
    ],
    pagination: {
      current_page: 1,
      last_page: 1,
    },
  },
};

export const mockComixPageList = {
  result: {
    chapter_id: 12345,
    images: [
      { url: "https://example.com/page1.jpg" },
      { url: "https://example.com/page2.jpg" },
      { url: "https://example.com/page3.jpg" },
    ],
  },
};

// Test chapters for deduplication
export const mockDuplicateChapters = [
  {
    chapter_id: 1,
    number: 1,
    is_official: 0,
    votes: 100,
    updated_at: 1000,
    name: "Fansubbed",
    scanlation_group_id: 100,
  },
  {
    chapter_id: 2,
    number: 1,
    is_official: 1,
    votes: 50,
    updated_at: 900,
    name: "Official",
    scanlation_group_id: 9275,
  },
  {
    chapter_id: 3,
    number: 2,
    is_official: 0,
    votes: 200,
    updated_at: 1500,
    name: "High Votes",
    scanlation_group_id: 101,
  },
  {
    chapter_id: 4,
    number: 2,
    is_official: 0,
    votes: 50,
    updated_at: 1400,
    name: "Low Votes",
    scanlation_group_id: 102,
  },
];
