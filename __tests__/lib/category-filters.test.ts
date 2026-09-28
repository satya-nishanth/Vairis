import fs from "fs";
import path from "path";
import {
  getDefaultFilterConfig,
  getAllCategoryFilters,
  getCategoryFilters,
  saveCategoryFilters,
  resetCategoryFilters,
} from "@/lib/category-filters";

const TEST_FILE = path.join(process.cwd(), "data", "category-filters.json");

describe("Category Filters Management", () => {
  let originalFileContent: string | null = null;

  beforeAll(() => {
    if (fs.existsSync(TEST_FILE)) {
      originalFileContent = fs.readFileSync(TEST_FILE, "utf-8");
    }
  });

  afterAll(() => {
    if (originalFileContent !== null) {
      fs.writeFileSync(TEST_FILE, originalFileContent, "utf-8");
    } else if (fs.existsSync(TEST_FILE)) {
      fs.unlinkSync(TEST_FILE);
    }
  });

  it("returns default filter config for built-in category", () => {
    const config = getDefaultFilterConfig("rings");
    expect(config.categorySlug).toBe("rings");
    expect(config.labels).toContain("Solitaire");
    expect(config.metals).toContain("Yellow Gold");
  });

  it("saves and retrieves custom filter labels for a category", async () => {
    await saveCategoryFilters("rings", {
      labels: ["Solitaire", "Cocktail", "Stackable", "Custom Floral"],
      metals: ["Yellow Gold", "Platinum"],
      labelProductMap: {
        "Custom Floral": ["prod_123"],
      },
    });

    const filters = await getCategoryFilters("rings");
    expect(filters.labels).toEqual(["Solitaire", "Cocktail", "Stackable", "Custom Floral"]);
    expect(filters.groups[0].options).toEqual(["Solitaire", "Cocktail", "Stackable", "Custom Floral"]);
    expect(filters.groups[1].options).toEqual(["Yellow Gold", "Platinum"]);
    expect(filters.labelProductMap["Custom Floral"]).toEqual(["prod_123"]);
  });

  it("resets category filters back to default presets", async () => {
    await resetCategoryFilters("rings");
    const filters = await getCategoryFilters("rings");
    expect(filters.labels).toContain("Solitaire");
    expect(filters.labels).not.toContain("Custom Floral");
  });
});
