/**
 * Mock HttpClient for testing sources
 */
export const mockHttpClient = {
  getJson: jest.fn(),
  getText: jest.fn(),
  post: jest.fn(),
};

/**
 * Reset all mocks
 */
export function resetHttpMocks() {
  mockHttpClient.getJson.mockReset();
  mockHttpClient.getText.mockReset();
  mockHttpClient.post.mockReset();
}

/**
 * Create a mock HTML response
 */
export function mockHtmlResponse(html: string) {
  mockHttpClient.getText.mockResolvedValue(html);
}

/**
 * Create a mock JSON response
 */
export function mockJsonResponse(json: any) {
  mockHttpClient.getJson.mockResolvedValue(json);
}
