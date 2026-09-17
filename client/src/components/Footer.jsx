import React from "react";
import { BsRobot } from "react-icons/bs";

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 bg-gray-200 border-t border-gray-200">
      <div className="max-w-6xl mx-auto px-6 py-8
                      flex flex-col md:flex-row items-center md:items-start
                      justify-between gap-4">

        <div className="flex flex-col items-center md:items-start gap-2 max-w-md text-center md:text-left">
          <div className="flex items-center gap-2">
            <div className="bg-black text-white p-1.5 rounded-md flex items-center justify-center">
              <BsRobot size={14} />
            </div>
            <span className="font-semibold text-sm text-gray-800">
              InterviewFlow
            </span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            AI-powered mock interviews with smart follow-ups, confidence
            analysis, and downloadable performance reports.
          </p>
        </div>

        <p className="text-xs text-gray-500 shrink-0">
          © {year} InterviewFlow. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default Footer;