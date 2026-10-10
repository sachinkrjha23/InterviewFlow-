import { createSlice } from "@reduxjs/toolkit";

const userSlice = createSlice({
    name: "user",
    initialState: {
        userData: null,
        authChecked: false
    },
    reducers: {
        setUserData: (state, action) => {
            state.userData = action.payload
            state.authChecked = true
        }
    }
})

export const { setUserData } = userSlice.actions
export default userSlice.reducer