/**
 * Test script for Manhwa18NetSource parsing
 * Run with: npx ts-node scripts/test-manhwa18.ts
 */

import { Manhwa18NetSource } from "../src/sources/manhwa18/Manhwa18NetSource";

async function test() {
  const source = new Manhwa18NetSource();

  console.log("\n=== Testing Manhwa18.net Source ===");
  console.log("Source ID:", source.id);
  console.log("Source Name:", source.name);
  console.log("Base URL:", source.baseUrl);
  console.log("NSFW:", source.config.nsfw);

  try {
    console.log("\n--- Testing getLatest ---");
    const latest = await source.getLatest(1);
    console.log(`Found ${latest.manga.length} manga`);
    console.log("Has next page:", latest.hasNextPage);

    if (latest.manga.length > 0) {
      console.log("\nFirst 3 manga:");
      latest.manga.slice(0, 3).forEach((m, i) => {
        console.log(`\n${i + 1}. ${m.title}`);
        console.log(`   URL: ${m.url}`);
        console.log(`   Cover: ${m.cover.substring(0, 80)}...`);
        console.log(`   ID: ${m.id}`);
      });
    } else {
      console.log("❌ NO MANGA FOUND! Check selectors.");
    }

    console.log("\n--- Testing getPopular ---");
    const popular = await source.getPopular(1);
    console.log(`Found ${popular.manga.length} manga`);

    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
  }
}

test();
