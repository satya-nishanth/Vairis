import fs from "fs";
import path from "path";
import {
  getDefaultFilterConfig,
  getAllCategoryFilters,
  getCategoryFilters,
  saveCategoryFilters,
  resetCategoryFilters,
  getProductLinkedLabels,
  setProductLabels,
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

  it("determines linked labels for products via explicit assignment and text match", async () => {
    const config = {
      categorySlug: "rings",
      categoryName: "Rings",
      labels: ["Solitaire", "Cocktail", "Stackable", "Halo"],
      metals: ["Yellow Gold"],
      labelProductMap: {
        Solitaire: ["prod_explicit_1"],
      },
      updatedAt: new Date().toISOString(),
    };

    // Explicit match
    const p1 = {
      id: "prod_explicit_1",
      itemCode: "VR-001",
      name: "Classic Band",
      category: "rings",
    };
    expect(getProductLinkedLabels(p1, config)).toEqual(["Solitaire"]);

    // Keyword match in name
    const p2 = {
      id: "prod_other_2",
      itemCode: "VR-002",
      name: "Vintage Cocktail Diamond Ring",
      category: "rings",
    };
    expect(getProductLinkedLabels(p2, config)).toEqual(["Cocktail"]);

    // Keyword match in designStyle
    const p3 = {
      id: "prod_other_3",
      itemCode: "VR-003",
      name: "Eternity Band",
      designStyle: "Stackable",
      category: "rings",
    };
    expect(getProductLinkedLabels(p3, config)).toEqual(["Stackable"]);
  });

  it("sets and updates product labels via setProductLabels", async () => {
    await saveCategoryFilters("earrings", {
      labels: ["Studs", "Drops", "Hoops"],
      metals: ["Yellow Gold"],
      labelProductMap: {},
    });

    await setProductLabels("prod_earring_1", "earrings", ["Studs", "Hoops"]);
    const filters1 = await getCategoryFilters("earrings");
    expect(filters1.labelProductMap["Studs"]).toContain("prod_earring_1");
    expect(filters1.labelProductMap["Hoops"]).toContain("prod_earring_1");
    expect(filters1.labelProductMap["Drops"] || []).not.toContain("prod_earring_1");

    // Remove "Studs"
    await setProductLabels("prod_earring_1", "earrings", ["Hoops"]);
    const filters2 = await getCategoryFilters("earrings");
    expect(filters2.labelProductMap["Studs"] || []).not.toContain("prod_earring_1");
    expect(filters2.labelProductMap["Hoops"]).toContain("prod_earring_1");
  });

  it("respects label exclusions when product text naturally matches a keyword", async () => {
    await saveCategoryFilters("pendants", {
      labels: ["Solitaire", "Minimal"],
      metals: ["Yellow Gold"],
      labelProductMap: {},
      labelExcludedMap: {},
    });

    const product = {
      id: "prod_pendant_1",
      itemCode: "PD-01",
      name: "Classic Solitaire Diamond Pendant",
      category: "pendants",
    };

    // Initially matches "Solitaire" via name
    const initialConfig = await getCategoryFilters("pendants");
    expect(getProductLinkedLabels(product, initialConfig)).toContain("Solitaire");

    // Admin unchecks "Solitaire" and only sets "Minimal"
    await setProductLabels(product.id, "pendants", ["Minimal"], product);
    const updatedFilters = await getCategoryFilters("pendants");
    const updatedLinked = getProductLinkedLabels(product, updatedFilters);

    expect(updatedLinked).not.toContain("Solitaire");
    expect(updatedLinked).toContain("Minimal");
  });

  it("resets category filters back to default presets", async () => {
    await resetCategoryFilters("rings");
    const filters = await getCategoryFilters("rings");
    expect(filters.labels).toContain("Solitaire");
    expect(filters.labels).not.toContain("Custom Floral");
  });
});
