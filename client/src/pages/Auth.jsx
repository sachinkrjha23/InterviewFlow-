import React from "react";
import { BsRobot } from "react-icons/bs";


function Auth() {
  return (
    <div className='w-full min-h-screen bg-[#f3f3f3] 
        flex items-center justify-center px-6 py-20'>

        <div className="w-full max-w-md p-8 rounded-3xl 
             bg-white shadow-2xl border border-gray-200">

            <div className="flex items-center justify-center gap-3 mb-6">

                <div className="bg-black text-white p-2 rounded-lg">
                    <BsRobot size={18}/>
                </div>
                <h2 className="font-semibold text-lg">InterviewFlow</h2>
            </div>


        </div>

    </div>
  )
}

export default Auth