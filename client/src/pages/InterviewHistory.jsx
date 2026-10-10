import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { serverUrl } from "../App";
import axios from "axios";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";

function InterviewHistory() {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const getMyInterviews = async () => {
      try {
        const result = await axios.get(
          serverUrl + "/api/interview/history",
          { withCredentials: true }
        );
        setInterviews(result.data || []);
      } catch (error) {
        console.log(error);
        setError(error.response?.data?.message || "Failed to load interviews");
      } finally {
        setLoading(false);
      }
    };

    getMyInterviews();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-emerald-50 py-10">
      <div className="w-[90vw] lg:w-[70vw] max-w-[90%] mx-auto">

        {/* Header */}
        <div className="mb-10 w-full flex items-start gap-4 flex-wrap">
          <button
            onClick={() => navigate("/")}
            className="mt-1 p-3 rounded-full bg-white shadow hover:shadow-md transition"
          >
            <FaArrowLeft />
          </button>

          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              Interview History
            </h1>
            <p className="text-gray-500 mt-2">
              Track your past interviews and performance reports
            </p>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center text-gray-400 py-20">
            Loading interviews...
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-red-200 p-12 text-center text-red-500 shadow-sm">
            {error}
          </div>
        ) : interviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <p className="text-gray-500 mb-4">No interviews yet.</p>
            <button
              onClick={() => navigate("/interview")}
              className="bg-gradient-to-r from-emerald-600 to-teal-500
                         text-white px-6 py-3 rounded-full font-semibold
                         shadow-md hover:opacity-90 transition"
            >
              Start Your First Interview
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {interviews.map((item) => {
              const isComplete = item.status === "Completed";

              return (
                <div
                  key={item._id}
                  onClick={() => navigate(`/report/${item._id}`)}
                  className="bg-white rounded-2xl border border-gray-200
                             p-5 sm:p-6 shadow-sm hover:shadow-lg
                             hover:border-emerald-200 transition-all cursor-pointer
                             flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-gray-900 text-lg truncate">
                        {item.role}
                      </h3>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide
                                    px-2 py-0.5 rounded-full ${item.mode === "HR"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                          }`}
                      >
                        {item.mode}
                      </span>
                    </div>

                    <p className="text-sm text-gray-500">
                      {item.experience} ·{" "}
                      {new Date(item.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-600 leading-none">
                        {isComplete && item.finalScore != null
                          ? Number(item.finalScore).toFixed(1)
                          : "—"}
                      </p>
                      <span
                        className={`inline-block mt-1.5 px-2.5 py-0.5
                                    text-[10px] font-bold uppercase tracking-wide
                                    rounded-full ${isComplete
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                          }`}
                      >
                        {isComplete ? "Completed" : "Incomplete"}
                      </span>
                    </div>
                    <FaArrowRight className="text-gray-300" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default InterviewHistory;