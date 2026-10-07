import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { serverUrl } from "../App";
import axios from "axios";
import Step3Report from "../components/Step3Report";
import { FaSpinner, FaArrowLeft } from "react-icons/fa";

function InterviewReport() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    const fetchReport = async () => {
      try {
        const result = await axios.get(
          `${serverUrl}/api/interview/report/${id}`,
          { withCredentials: true }
        );
        setReport(result.data);
      } catch (err) {
        console.log(err);
        setError(err.response?.data?.message || "Failed to load report");
      }
    };

    fetchReport();
  }, [id]);

  // ─── Error state ───
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/40
                      flex items-center justify-center px-6">
        <div className="bg-white rounded-3xl border border-gray-200
                        shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-50
                          flex items-center justify-center mb-5">
            <span className="text-3xl">⚠️</span>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Report Unavailable
          </h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>

          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 bg-black text-white
                       px-6 py-3 rounded-full font-semibold text-sm
                       hover:opacity-90 transition"
          >
            <FaArrowLeft size={12} />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ─── Loading state ───
  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/40
                      flex items-center justify-center px-6">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-100" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent
                            border-t-emerald-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <FaSpinner className="text-emerald-600 animate-spin" size={20} />
            </div>
          </div>

          <h2 className="text-lg font-semibold text-gray-800 mb-1">
            Analyzing your interview
          </h2>
          <p className="text-sm text-gray-500">
            Gathering scores and feedback...
          </p>
        </div>
      </div>
    );
  }

  return <Step3Report report={report} />;
}

export default InterviewReport;