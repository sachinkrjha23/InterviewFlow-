import React, { useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import axios from "axios"
import { useDispatch } from "react-redux";
import { setUserData } from "./redux/userSlice";
import InterviewPage from "./pages/InterviewPage";


export const serverUrl = "http://localhost:1000"

function App(){

  const dispatch = useDispatch()
  useEffect(()=>{
    
    const getUser = async () => {
      try{
        const result = await axios.get(serverUrl + "/api/user/currentUser", {withCredentials: true})
        dispatch(setUserData(result.data))
      }
      catch (error)
      {
        console.log(error)
        dispatch(setUserData(null))
      }
    }
    getUser()
  }, [dispatch])

  return (
    <Routes>
      <Route path='/' element={<Home/>}  />
      <Route path='/auth' element={<Auth/>}  />
      <Route path='/interview' element={<InterviewPage/>}  />
    </Routes>
  )
}

export default App;