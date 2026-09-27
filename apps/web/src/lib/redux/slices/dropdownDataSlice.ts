import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { logout } from "./authSlice";
import type { AppUser } from "@/lib/services/userService";
import type { Invite } from "@/lib/services/inviteService";

interface Cached<T> { items: T[]; fetchedAt: number; }

interface DropdownDataState {
  members: Record<string, Cached<AppUser>>;
  invites: Record<string, Cached<Invite>>;
}

const initialState: DropdownDataState = { members: {}, invites: {} };

const slice = createSlice({
  name: "dropdownData",
  initialState,
  reducers: {
    setMembers(state, action: PayloadAction<{ enterpriseId: string; items: AppUser[]; fetchedAt: number }>) {
      state.members[action.payload.enterpriseId] = { items: action.payload.items, fetchedAt: action.payload.fetchedAt };
    },
    setInvites(state, action: PayloadAction<{ enterpriseId: string; items: Invite[]; fetchedAt: number }>) {
      state.invites[action.payload.enterpriseId] = { items: action.payload.items, fetchedAt: action.payload.fetchedAt };
    },
    resetDropdownData() { return initialState; },
  },
  extraReducers: (builder) => {
    builder.addCase(logout.fulfilled, () => initialState);
  },
});

export const { setMembers, setInvites, resetDropdownData } = slice.actions;
export default slice.reducer;
