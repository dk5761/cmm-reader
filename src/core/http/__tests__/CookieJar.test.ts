
import { cookieJar } from "../CookieJar";
import { Platform } from "react-native";
import CookieSync from "cookie-sync";
import CookieManager from "@react-native-cookies/cookies";

// Mock dependencies
jest.mock("cookie-sync", () => ({
  getCookieString: jest.fn(),
  syncCookiesToNative: jest.fn(),
  clearCfClearance: jest.fn(),
}));

jest.mock("@react-native-cookies/cookies", () => ({
  get: jest.fn(),
  clearAll: jest.fn(),
  clearByName: jest.fn(),
}));

describe("CookieJar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("iOS Platform", () => {
    beforeAll(() => {
      (Platform.OS as any) = "ios";
    });

    it("calls CookieSync for getCookieString", async () => {
      (CookieSync.getCookieString as jest.Mock).mockResolvedValue("test-cookie");
      
      const result = await cookieJar.getCookieString("https://test.com");
      
      expect(CookieSync.getCookieString).toHaveBeenCalledWith("https://test.com");
      expect(result).toBe("test-cookie");
    });

    it("calls CookieSync for invalidateDomain", async () => {
      await cookieJar.invalidateDomain("https://test.com");
      expect(CookieSync.clearCfClearance).toHaveBeenCalledWith("https://test.com");
    });
  });

  describe("Android Platform", () => {
    beforeAll(() => {
      (Platform.OS as any) = "android";
    });

    it("calls CookieManager for getCookieString", async () => {
      (CookieManager.get as jest.Mock).mockResolvedValue({
        name1: { value: "val1" },
        name2: { value: "val2" },
      });
      
      const result = await cookieJar.getCookieString("https://test.com");
      
      expect(CookieManager.get).toHaveBeenCalledWith("https://test.com");
      expect(result).toBe("name1=val1; name2=val2");
    });

    it("calls CookieManager for invalidateDomain", async () => {
      await cookieJar.invalidateDomain("https://test.com");
      expect(CookieManager.clearByName).toHaveBeenCalledWith("https://test.com", "cf_clearance");
    });
  });
});
