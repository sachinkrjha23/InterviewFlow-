import { useState } from "react";
import Navbar from "../components/Navbar";
import Step1SetUp from "../components/Step1SetUp";
import Step2Interview from "../components/Step2Interview";
import Step3Report from "../components/Step3Report";

function InterviewPage() {
  const [step, setStep] = useState(1);
  const [interviewData, setInterviewData] = useState(null);
  const [interviewId, setInterviewId] = useState("");

  const restart = () => {
    setInterviewData(null);
    setInterviewId("");
    setStep(1);
  };

  return (
    <div className="min-h-screen bg-canvas">
      {step !== 2 && <Navbar />}

      {step === 1 && (
        <Step1SetUp
          onStart={(data) => {
            setInterviewId(data.interviewId);
            setInterviewData(data);
            setStep(2);
          }}
        />
      )}

      {step === 2 && (
        <Step2Interview
          interviewData={interviewData}
          onFinish={(report) => {
            setInterviewData(report);
            setStep(3);
          }}
        />
      )}

      {step === 3 && <Step3Report report={interviewData} interviewId={interviewId} onRestart={restart} />}
    </div>
  );
}

export default InterviewPage;