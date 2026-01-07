
// Mock Firebase modules for logic tests
jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(() => ({ name: "js-sdk" })),
  getApps: jest.fn(() => []),
  getApp: jest.fn(),
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: "test-user" } })),
  signInWithCustomToken: jest.fn(),
  signInWithCredential: jest.fn().mockResolvedValue({ user: { uid: "test-user" } }),
  GoogleAuthProvider: {
    credential: jest.fn(),
  },
}));

jest.mock("firebase/firestore", () => {
  const mockBatch = {
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  };

  const mockDb = {};

  return {
    getFirestore: jest.fn(() => mockDb),
    collection: jest.fn((db, path) => ({ path })),
    doc: jest.fn((coll, id) => ({ path: `${coll.path}/${id}` })),
    setDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    getDocs: jest.fn().mockResolvedValue({ docs: [] }),
    writeBatch: jest.fn(() => mockBatch),
    query: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
  };
});

jest.mock("@react-native-firebase/auth", () => () => ({
  currentUser: { uid: "native-user" },
}));

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    hasPreviousSignIn: jest.fn().mockResolvedValue(true),
    signInSilently: jest.fn().mockResolvedValue({ data: { idToken: "mock-token" } }),
  },
}));
