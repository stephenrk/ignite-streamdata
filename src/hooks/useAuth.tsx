import { makeRedirectUri, revokeAsync, startAsync } from 'expo-auth-session';
import React, { useEffect, createContext, useContext, useState, ReactNode } from 'react';
import { generateRandom } from 'expo-auth-session/build/PKCE';

import { api } from '../services/api';

const { CLIENT_ID } = process.env;

interface User {
  id: number;
  display_name: string;
  email: string;
  profile_image_url: string;
}

interface AuthContextData {
  user: User;
  isLoggingOut: boolean;
  isLoggingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthProviderData {
  children: ReactNode;
}

const AuthContext = createContext({} as AuthContextData);


const twitchEndpoints = {
  authorization: 'https://id.twitch.tv/oauth2/authorize',
  revocation: 'https://id.twitch.tv/oauth2/revoke'
};

function AuthProvider({ children }: AuthProviderData) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState({} as User);
  const [userToken, setUserToken] = useState('');

  async function signIn() {
    try {
      setIsLoggingIn(true)

      const REDIRECT_URI = makeRedirectUri({ useProxy: true });
      const RESPONSE_TYPE = "token";
      const SCOPE = "openid%20user:read:email%20user:read:follows";
      const FORCE_VERIFY = true;
      const STATE = generateRandom(30);

      const authUrl = `${twitchEndpoints.authorization}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=${RESPONSE_TYPE}&scope=${SCOPE}&force_verify=${FORCE_VERIFY}&state=${STATE}`

      const response = await startAsync({ authUrl })

      if (response.type === 'success' && response.params.error !== "access_denied") {
        if (response.params.state !== STATE) {
          throw new Error("Invalid state value")
        }

        api.defaults.headers.authorization = `Bearer ${response.params.access_token}`;
        const { data } = await api.get("/users")

        setUser({
          id: data.data[0].id,
          display_name: data.data[0].display_name,
          email: data.data[0].login,
          profile_image_url: data.data[0].profile_image_url
        })
        setUserToken(response.params.access_token);
      }
    } catch (error) {
      throw new Error(error);
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function signOut() {
    try {
      setIsLoggingOut(true)
      revokeAsync({ token: userToken, clientId: CLIENT_ID }, { revocationEndpoint: twitchEndpoints.revocation })
    } catch (error) {
      throw new Error(error);
    } finally {
      setUser({} as User);
      setUserToken("");

      delete api.defaults.headers.authorization;

      setIsLoggingOut(false)
    }
  }

  useEffect(() => {
    api.defaults.headers['Client-Id'] = CLIENT_ID;
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoggingOut, isLoggingIn, signIn, signOut }}>
      { children }
    </AuthContext.Provider>
  )
}

function useAuth() {
  const context = useContext(AuthContext);

  return context;
}

export { AuthProvider, useAuth };
