import { Account, Client, OAuthProvider, Storage } from 'appwrite';

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const account = new Account(client);
export const storage = new Storage(client);
export { OAuthProvider };
export default client;

// ─── Auth helpers ───────────────────────────────────────────

export const registerWithEmail = async (email: string, password: string, name: string) => {
  await account.create('unique()', email, password, name);
  return loginWithEmail(email, password);
};

export const loginWithEmail = async (email: string, password: string) => {
  await account.createEmailPasswordSession(email, password);
  return account.get();
};

export const loginWithGoogle = () => {
  account.createOAuth2Session(
    OAuthProvider.Google,
    `${window.location.origin}/auth/callback`,
    `${window.location.origin}/login?error=google`
  );
};

export const logout = async () => {
  try { await account.deleteSession('current'); } catch { /* already logged out */ }
};

export const getMe = async () => {
  try { return await account.get(); } catch { return null; }
};

export const getJWT = async (): Promise<string> => {
  const jwt = await account.createJWT();
  return jwt.jwt;
};

export const updateProfile = async (name: string) => {
  return account.updateName(name);
};

export const updateAvatar = async (file: File) => {
  // Store avatar in Appwrite Storage bucket 'avatars'
  const result = await storage.createFile('avatars', 'unique()', file);
  // Save fileId as prefs
  await account.updatePrefs({ avatarFileId: result.$id });
  return result;
};

export const getAvatarUrl = (fileId: string): string => {
  return `${import.meta.env.VITE_APPWRITE_ENDPOINT}/storage/buckets/avatars/files/${fileId}/view?project=${import.meta.env.VITE_APPWRITE_PROJECT_ID}`;
};
