import axios from "axios";
import { serverUrl } from "../config";

export async function fetchModelAnswers(interviewId, questionIndex) {
  const body = questionIndex === undefined ? {} : { questionIndex };
  const { data } = await axios.post(
    `${serverUrl}/api/interview/report/${interviewId}/model-answers`,
    body,
    { withCredentials: true },
  );
  return data.modelAnswers || {};
}