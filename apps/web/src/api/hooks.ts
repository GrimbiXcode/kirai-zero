import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import type {
  CurrentUser,
  FriendDto,
  FriendProfileDto,
  FriendRequestDto,
  ItemDto,
  ItemKind,
  PersonDetailDto,
  PersonDto,
  PreferenceDto,
  PublicUser,
  Stance,
} from "shared";
import { api, ApiError } from "./client";
import { clearToken, saveToken } from "./token";

export const queryKeys = {
  session: ["session"] as const,
  preferences: ["preferences"] as const,
  friends: ["friends"] as const,
  friendRequests: ["friend-requests"] as const,
  friendProfile: (userId: string) => ["friend-profile", userId] as const,
  itemSearch: (query: string, kind?: ItemKind) =>
    ["items", query, kind ?? "all"] as const,
  userSearch: (handle: string) => ["user-search", handle] as const,
  persons: ["persons"] as const,
  person: (id: string) => ["person", id] as const,
};

/**
 * The session query is the single source of truth for "is someone signed in".
 * A 401 resolves to null instead of an error state, because being signed out
 * is a normal condition, not a failure.
 */
export function useSession(): UseQueryResult<CurrentUser | null> {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: async () => {
      try {
        const response = await api<{ user: CurrentUser }>("/api/auth/me");
        return response.user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

interface AuthResponse {
  user: CurrentUser;
  token: string;
}

/**
 * Drops every cached query except the session itself, which is set to "signed
 * out". Not `queryClient.clear()`: that removes the session query object the
 * mounted components are observing, leaving them attached to an orphan that
 * never receives the update — the app would keep rendering the signed-in shell.
 */
async function signOutLocally(queryClient: QueryClient): Promise<void> {
  queryClient.setQueryData(queryKeys.session, null);
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== queryKeys.session[0],
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      api<AuthResponse>("/api/auth/login", { method: "POST", body: input }),
    onSuccess: async (data) => {
      await saveToken(data.token);
      queryClient.setQueryData(queryKeys.session, data.user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      email: string;
      password: string;
      handle: string;
      displayName: string;
    }) => api<AuthResponse>("/api/auth/register", { method: "POST", body: input }),
    onSuccess: async (data) => {
      await saveToken(data.token);
      queryClient.setQueryData(queryKeys.session, data.user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: true }>("/api/auth/logout", { method: "POST" }),
    onSettled: async () => {
      await clearToken();
      await signOutLocally(queryClient);
    },
  });
}

/** Confirms the address behind a mailed link. Refreshes the session so the
 *  banner disappears without a reload — the response already carries the
 *  updated user, so there is nothing to re-fetch. */
export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api<{ user: CurrentUser }>("/api/auth/verify-email", {
        method: "POST",
        body: { token },
      }),
    onSuccess: (data) => {
      if (queryClient.getQueryData(queryKeys.session)) {
        queryClient.setQueryData(queryKeys.session, data.user);
      }
    },
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: () =>
      api<void>("/api/auth/resend-verification", { method: "POST" }),
  });
}

/** Resolves the same way whether or not the address belongs to an account —
 *  the API answers 204 either way, and the screen must not imply otherwise. */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: (email: string) =>
      api<void>("/api/auth/password-reset", { method: "POST", body: { email } }),
  });
}

/**
 * Finishes a reset. The server ends every session in the process, so whatever
 * this client still held is stale: the local token goes and the caller sends
 * the person to the sign-in screen.
 */
export function useConfirmPasswordReset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      api<void>("/api/auth/password-reset/confirm", {
        method: "POST",
        body: input,
      }),
    onSuccess: async () => {
      await clearToken();
      await signOutLocally(queryClient);
    },
  });
}

export function useItemSearch(query: string, kind?: ItemKind) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: queryKeys.itemSearch(trimmed, kind),
    queryFn: async () => {
      const params = new URLSearchParams({ q: trimmed, limit: "8" });
      if (kind) params.set("kind", kind);
      const response = await api<{ items: ItemDto[] }>(`/api/items?${params}`);
      return response.items;
    },
    enabled: trimmed.length >= 2,
    staleTime: 60 * 1000,
  });
}

export function usePreferences() {
  return useQuery({
    queryKey: queryKeys.preferences,
    queryFn: async () => {
      const response = await api<{ preferences: PreferenceDto[] }>(
        "/api/me/preferences",
      );
      return response.preferences;
    },
  });
}

export interface PreferenceInput {
  itemId: string;
  stance: PreferenceDto["stance"];
  note?: string;
  visibility: PreferenceDto["visibility"];
}

export function useUpsertPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...body }: PreferenceInput) =>
      api<{ preference: PreferenceDto }>(`/api/me/preferences/${itemId}`, {
        method: "PUT",
        body,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.preferences }),
  });
}

export function useDeletePreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) =>
      api<{ ok: true }>(`/api/me/preferences/${itemId}`, { method: "DELETE" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.preferences }),
  });
}

export function useCreateItem() {
  return useMutation({
    mutationFn: (input: { name: string; kind: ItemKind }) =>
      api<{ item: ItemDto }>("/api/items", { method: "POST", body: input }),
  });
}

export function useFriends() {
  return useQuery({
    queryKey: queryKeys.friends,
    queryFn: async () => {
      const response = await api<{ friends: FriendDto[] }>("/api/friends");
      return response.friends;
    },
  });
}

export function useFriendRequests() {
  return useQuery({
    queryKey: queryKeys.friendRequests,
    queryFn: () =>
      api<{ incoming: FriendRequestDto[]; outgoing: FriendRequestDto[] }>(
        "/api/friend-requests",
      ),
  });
}

export type UserSearchRelation =
  | "none"
  | "friend"
  | "request_sent"
  | "request_received";

export function useUserSearch(handle: string) {
  const trimmed = handle.trim().toLowerCase();
  return useQuery({
    queryKey: queryKeys.userSearch(trimmed),
    queryFn: async () => {
      const response = await api<{
        users: { user: PublicUser; relation: UserSearchRelation }[];
      }>(`/api/users/search?handle=${encodeURIComponent(trimmed)}`);
      return response.users;
    },
    enabled: trimmed.length >= 2,
  });
}

/** Invalidates everything the friend graph feeds, since a single accept can
 *  change the request list, the friend list and a profile at once. */
function useFriendGraphMutation<TInput>(
  mutationFn: (input: TInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.friends }),
        queryClient.invalidateQueries({ queryKey: queryKeys.friendRequests }),
        queryClient.invalidateQueries({ queryKey: ["user-search"] }),
        queryClient.invalidateQueries({ queryKey: ["friend-profile"] }),
      ]);
    },
  });
}

export function useSendFriendRequest() {
  return useFriendGraphMutation((handle: string) =>
    api("/api/friend-requests", { method: "POST", body: { handle } }),
  );
}

export function useAcceptFriendRequest() {
  return useFriendGraphMutation((id: string) =>
    api(`/api/friend-requests/${id}/accept`, { method: "POST" }),
  );
}

export function useDeclineFriendRequest() {
  return useFriendGraphMutation((id: string) =>
    api(`/api/friend-requests/${id}/decline`, { method: "POST" }),
  );
}

export function useCancelFriendRequest() {
  return useFriendGraphMutation((id: string) =>
    api(`/api/friend-requests/${id}`, { method: "DELETE" }),
  );
}

export function useRemoveFriend() {
  return useFriendGraphMutation((userId: string) =>
    api(`/api/friends/${userId}`, { method: "DELETE" }),
  );
}

export function useFriendProfile(userId: string) {
  return useQuery({
    queryKey: queryKeys.friendProfile(userId),
    queryFn: () => api<FriendProfileDto>(`/api/friends/${userId}/profile`),
    retry: false,
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ ok: true }>("/api/me", { method: "DELETE" }),
    onSuccess: async () => {
      await clearToken();
      await signOutLocally(queryClient);
    },
  });
}


// --- Person profiles -------------------------------------------------------

/** Anything that changes a person also changes the friend profile it may be
 *  linked to, so both are invalidated together. */
function usePersonMutation<TInput>(
  mutationFn: (input: TInput) => Promise<{ person: PersonDetailDto }>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (data) => {
      queryClient.setQueryData(queryKeys.person(data.person.id), data.person);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.persons }),
        queryClient.invalidateQueries({ queryKey: ["friend-profile"] }),
      ]);
    },
  });
}

export function usePersons() {
  return useQuery({
    queryKey: queryKeys.persons,
    queryFn: async () => {
      const response = await api<{ persons: PersonDto[] }>("/api/persons");
      return response.persons;
    },
  });
}

export function usePerson(id: string) {
  return useQuery({
    queryKey: queryKeys.person(id),
    queryFn: async () => {
      const response = await api<{ person: PersonDetailDto }>(
        `/api/persons/${id}`,
      );
      return response.person;
    },
    retry: false,
  });
}

export function useCreatePerson() {
  return usePersonMutation((input: { displayName: string; note?: string }) =>
    api<{ person: PersonDetailDto }>("/api/persons", {
      method: "POST",
      body: input,
    }),
  );
}

export function useUpdatePerson(id: string) {
  return usePersonMutation((input: { displayName?: string; note?: string | null }) =>
    api<{ person: PersonDetailDto }>(`/api/persons/${id}`, {
      method: "PATCH",
      body: input,
    }),
  );
}

export function useDeletePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: true }>(`/api/persons/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.persons }),
        queryClient.invalidateQueries({ queryKey: ["friend-profile"] }),
      ]);
    },
  });
}

/** Fetches the profile holding my notes about a friend, creating it on first
 *  use — the client never has to know whether it already existed. */
export function usePersonForFriend() {
  return usePersonMutation((userId: string) =>
    api<{ person: PersonDetailDto }>(`/api/persons/for-friend/${userId}`, {
      method: "POST",
    }),
  );
}

export interface PersonEntryInput {
  personId: string;
  itemId: string;
  stance: Stance;
  note?: string;
}

export function useUpsertPersonEntry() {
  return usePersonMutation(({ personId, itemId, ...body }: PersonEntryInput) =>
    api<{ person: PersonDetailDto }>(
      `/api/persons/${personId}/entries/${itemId}`,
      { method: "PUT", body },
    ),
  );
}

export function useDeletePersonEntry() {
  return usePersonMutation(
    ({ personId, itemId }: { personId: string; itemId: string }) =>
      api<{ person: PersonDetailDto }>(
        `/api/persons/${personId}/entries/${itemId}`,
        { method: "DELETE" },
      ),
  );
}

export function useLinkPerson(id: string) {
  return usePersonMutation((handle: string) =>
    api<{ person: PersonDetailDto }>(`/api/persons/${id}/link`, {
      method: "POST",
      body: { handle },
    }),
  );
}

export function useUnlinkPerson(id: string) {
  return usePersonMutation(() =>
    api<{ person: PersonDetailDto }>(`/api/persons/${id}/unlink`, {
      method: "POST",
    }),
  );
}
