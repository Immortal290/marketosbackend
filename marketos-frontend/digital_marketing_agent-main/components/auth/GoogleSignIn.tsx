
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { apiRequest } from "@/lib/api";

interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

function GoogleSignInButton() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSuccess = async (response: { credential?: string }) => {
    if (!response.credential) {
      setError("Google did not return an ID token. Please try again.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await apiRequest<AuthResponse>("/auth/google", {
        method: "POST",
        body: JSON.stringify({ idToken: response.credential }),
      });

      if (
        !result.success ||
        !result.data?.accessToken ||
        !result.data?.refreshToken
      ) {
        throw new Error("The server returned an invalid sign-in response.");
      }

      localStorage.setItem("marketos_token", result.data.accessToken);
      localStorage.setItem(
        "marketos_refresh_token",
        result.data.refreshToken
      );

      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Google sign-in failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-5 flex flex-col items-center gap-3">
      {loading && (
        <p className="text-sm font-medium" role="status">
          Signing in with Google...
        </p>
      )}

      <div className={loading ? "pointer-events-none opacity-60" : ""}>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError("Google sign-in was unsuccessful. Please try again.")}
          text="continue_with"
          shape="rectangular"
          theme="outline"
          width="280"
        />
      </div>

      {error && (
        <p role="alert" className="max-w-sm text-center text-sm font-bold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export default function GoogleSignIn() {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  if (!clientId) {
    return null;
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <GoogleSignInButton />
    </GoogleOAuthProvider>
  );
}
