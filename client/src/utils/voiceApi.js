import axios from "axios";
import { serverUrl } from "../config";

export const transcribeBlob = async (blob) => {
  const form = new FormData();
  form.append("audio", blob, "answer.webm");
  const { data } = await axios.post(`${serverUrl}/api/voice/transcribe`, form, {
    withCredentials: true,
    timeout: 60000,
  });
  return data;
};