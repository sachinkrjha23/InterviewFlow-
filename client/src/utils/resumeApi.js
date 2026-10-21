import axios from "axios";
import { serverUrl } from "../config";

export const extractResume = async (file) => {
  const form = new FormData();
  form.append("resume", file);
  const { data } = await axios.post(`${serverUrl}/api/resume/extract`, form, {
    withCredentials: true,
  });
  return data.resumeText;
};

export const tailorResume = async ({ resumeText, jobDescription }) => {
  const { data } = await axios.post(
    `${serverUrl}/api/resume/tailor`,
    { resumeText, jobDescription },
    { withCredentials: true, timeout: 150000 },
  );
  return data;
};