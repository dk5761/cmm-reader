import {
    createContext,
    useContext,
    useState,
    useEffect,
    type ReactNode,
} from "react";
import auth, { type FirebaseAuthTypes } from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";

// Web client ID from google-services.json
const WEB_CLIENT_ID =
    "448954263976-95qoqgcqueorfk3nlo63uesh79i9ejbs.apps.googleusercontent.com";

type AuthContextType = {
    user: FirebaseAuthTypes.User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

type AuthProviderProps = {
    children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Configure Google Sign-In
    useEffect(() => {
        GoogleSignin.configure({
            webClientId: WEB_CLIENT_ID,
        });
    }, []);

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = auth().onAuthStateChanged((firebaseUser) => {
            setUser(firebaseUser);
            setIsLoading(false);
        });

        return unsubscribe;
    }, []);

    const signInWithGoogle = async () => {
        try {
            // Check if device supports Google Play Services
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

            // Get the user's ID token
            const signInResult = await GoogleSignin.signIn();

            // Get the ID token
            const idToken = signInResult.data?.idToken;
            if (!idToken) {
                throw new Error("No ID token found");
            }

            // Create a Google credential with the token
            const googleCredential = auth.GoogleAuthProvider.credential(idToken);

            // Sign-in the user with the credential
            await auth().signInWithCredential(googleCredential);
        } catch (error) {
            console.error("Google Sign-In Error:", error);
            throw error;
        }
    };

    const signOut = async () => {
        try {
            // Sign out from Google
            await GoogleSignin.signOut();
            // Sign out from Firebase
            await auth().signOut();
        } catch (error) {
            console.error("Sign Out Error:", error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                signInWithGoogle,
                signOut,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}
