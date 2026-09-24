import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { askAi } from "../services/AiService.js";
import Interview from "../models/interviewModel.js";
import User from "../models/users.js";

export const analyzeResume = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Resume required" });

    const filepath = req.file.path;
    const fileBuffer = await fs.promises.readFile(filepath);
    const uint8Array = new Uint8Array(fileBuffer);

    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;

    let resumeText = "";
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      resumeText += content.items.map((i) => i.str).join(" ") + "\n";
    }
    resumeText = resumeText.replace(/\s+/g, " ").trim();

    const messages = [
      {
        role: "system",
        content: `You are an expert resume parser. Analyze the resume text and extract structured data.

Rules:
- "role": the candidate's most recent or target job title. If none, infer from skills/projects.
- "experience": total years in a human-readable form (e.g. "2 years", "Fresher", "5+ years").
- "projects": up to 5 project names/titles only (no descriptions, no bullet text).
- "skills": up to 15 technical skills, deduplicated, lowercase preferred.
- If a field cannot be determined, use "" for strings and [] for arrays.

Return ONLY valid JSON (no markdown, no explanations):
{
  "role": "string",
  "experience": "string",
  "projects": ["project1", "project2"],
  "skills": ["skill1", "skill2"]
}`,
      },
      { role: "user", content: resumeText },
    ];

    const aiResponse = await askAi(messages);
    const cleaned = String(aiResponse)
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) {
        console.error("Unparseable AI response:", cleaned.slice(0, 500));
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
        return res.status(500).json({ message: "AI returned invalid JSON" });
      }
      parsed = JSON.parse(match[0]);
    }

    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);

    return res.json({
      role: parsed.role || "",
      experience: parsed.experience || "",
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      resumeText,
    });
  } catch (error) {
    console.error(error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({ message: error.message });
  }
};

export const generateQuestion = async (req, res) => {
  try {
    let { role, experience, mode, resumeText, projects, skills } = req.body;

    role = role?.trim();
    experience = experience?.trim();
    mode = mode?.trim();

    if (!role || !experience || !mode) {
      return res
        .status(400)
        .json({ message: "Role, Experience and Mode are required." });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.credits < 50) {
      return res
        .status(400)
        .json({ message: "Not enough credits. Minimum 50 required." });
    }

    await Interview.deleteMany({ userId: user._id, status: "Incomplete" });

    const projectText =
      Array.isArray(projects) && projects.length ? projects.join(", ") : "None";
    const skillsText =
      Array.isArray(skills) && skills.length ? skills.join(", ") : "None";
    const safeResume = resumeText?.trim() || "None";

    const userPrompt = `
CANDIDATE:
- Role: ${role}
- Experience: ${experience}
- Skills: ${skillsText}
- Projects: ${projectText}
- Resume: ${safeResume}`;

    const modeRules =
      mode === "HR"
        ? `Ask ONLY HR / behavioral / situational questions.

Q1 MUST be an introductory question like "Tell me about yourself" or "Walk me through your background."
Q2 onwards: mix of behavioral, situational, and motivational questions.

Focus areas:
- Teamwork and collaboration
- Conflict resolution
- Motivation and career goals
- Handling challenges and failures
- Communication and culture fit

DO NOT ask about coding, DSA, frameworks, or technical concepts.`
        : `Ask ONLY technical questions.

Q1 MUST be an easy warm-up on fundamentals related to the role (e.g. core concepts, basic definitions).
Q2 onwards: dive into coding, algorithms, design patterns, or the listed skills/projects.

Focus areas:
- Problem solving and logic
- Coding concepts and best practices
- System design (if experience allows)
- Resume/project-specific technical depth

DO NOT ask behavioral questions like "tell me about yourself" or "strengths and weaknesses".`;

    const messages = [
      {
        role: "system",
        content: `You are an expert interviewer creating questions for a ${mode} interview.

TASK:
Generate exactly 6 ${mode} interview questions.

${modeRules}

DIFFICULTY PROGRESSION:
Q1 → easy (warm-up)
Q2 → easy
Q3 → easy-medium
Q4 → medium
Q5 → medium-hard
Q6 → hard

STRICT OUTPUT RULES:
- Each question: ONE complete sentence, 15-25 words.
- One question per line. No numbering, no bullets, no explanations.
- Natural, conversational English.
- Questions must be specific to the candidate's role/skills/projects where possible.

GOOD examples:
What motivated you to pursue a career in frontend development?
How would you optimize a React component that re-renders too often?

BAD examples (do NOT do this):
1. Tell me about yourself. (numbered)
What is your biggest strength? (generic, not specific)
Can you explain X and also tell me how Y works? (two questions in one)

Output ONLY the 6 questions, one per line.`,
      },
      { role: "user", content: userPrompt },
    ];

    const aiResponse = await askAi(messages);
    if (!aiResponse?.trim()) {
      return res.status(500).json({ message: "AI returned empty response." });
    }

    let questionsArray = aiResponse
      .split("\n")
      .map((q) => q.trim().replace(/^\d+[).\s-]+/, ""))
      .filter((q) => q.length > 0)
      .slice(0, 6);

    // Retry if AI returned fewer than 6 questions
    if (questionsArray.length < 6) {
      console.warn(
        `⚠️ Only got ${questionsArray.length} questions. Retrying...`,
      );

      const retry = await askAi([
        {
          role: "system",
          content: `You are an expert interviewer. Output EXACTLY 6 interview questions.

STRICT FORMAT:
- One question per line.
- No numbering. No bullets. No explanations.
- Each line: ONE complete sentence, 15-25 words.
- Output nothing else — no headers, no intro text.

${modeRules}

Output the 6 questions now:`,
        },
        { role: "user", content: userPrompt },
      ]);

      questionsArray = retry
        .split("\n")
        .map((q) => q.trim().replace(/^\d+[).\s-]+/, ""))
        .filter((q) => q.length > 0)
        .slice(0, 6);

      console.log(`🔄 After retry: ${questionsArray.length} questions`);
    }

    if (questionsArray.length < 6) {
      return res.status(500).json({
        message: `AI only generated ${questionsArray.length} questions. Please try again.`,
      });
    }

    user.credits -= 50;
    await user.save();

    let interview;
    try {
      const difficultyLevels = [
        "easy",
        "easy",
        "easy-medium",
        "medium",
        "medium-hard",
        "hard",
      ];
      const timeLimits = [60, 60, 90, 120, 150, 180];

      interview = await Interview.create({
        userId: user._id,
        role,
        experience,
        mode,
        resumeText: safeResume,
        questions: questionsArray.map((q, index) => ({
          question: q,
          difficulty: difficultyLevels[index] || "medium",
          timeLimit: timeLimits[index] || 120,
        })),
      });
    } catch (dbError) {
      user.credits += 50;
      await user.save();
      throw dbError;
    }

    return res.json({
      interviewId: interview._id,
      creditsLeft: user.credits,
      userName: user.name,
      role: interview.role,
      experience: interview.experience,
      mode: interview.mode,
      questions: interview.questions,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: `Failed to create interview: ${error.message}` });
  }
};

export const submitAnswers = async (req, res) => {
  try {
    const { interviewId, questionIndex, answer, timeTaken } = req.body;

    if (!interviewId || questionIndex == null) {
      return res
        .status(400)
        .json({ message: "interviewId and questionIndex required." });
    }

    const interview = await Interview.findById(interviewId);
    if (!interview)
      return res.status(404).json({ message: "Interview not found." });

    if (interview.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "Not your interview." });
    }

    const question = interview.questions[questionIndex];
    if (!question)
      return res.status(400).json({ message: "Invalid question index." });

    if (question.answer && question.answer.trim()) {
      return res
        .status(400)
        .json({ message: "This question has already been answered." });
    }

    if (!answer) {
      question.score = 0;
      question.feedback = "You did not submit an answer.";
      question.answer = "";
      await interview.save();
      return res.json({ feedback: question.feedback });
    }

    if (timeTaken > question.timeLimit) {
      question.score = 0;
      question.feedback = "Time limit exceeded. Answer not evaluated.";
      question.answer = answer;
      await interview.save();
      return res.json({ feedback: question.feedback });
    }

    const messages = [
      {
        role: "system",
        content: `You are an experienced interviewer scoring a candidate's answer.

CONTEXT:
- Role: ${interview.role}
- Experience: ${interview.experience}
- Mode: ${interview.mode}
- Question: ${question.question}
- Difficulty: ${question.difficulty}
- Time taken: ${timeTaken}s (limit: ${question.timeLimit}s)

SCORING RUBRIC (0-10):
- Confidence: 0-3 = unsure/rambling, 4-6 = steady, 7-10 = assertive and composed
- Communication: 0-3 = confusing/incomplete sentences, 4-6 = understandable, 7-10 = crisp and structured
- Correctness: 0-3 = wrong/missing, 4-6 = partially correct, 7-10 = accurate and complete

CALIBRATION RULES:
- A vague or 1-line answer must score 2-4 (do NOT default to 7).
- An average, expected answer scores 5-6.
- Only genuinely strong, detailed answers get 7-9.
- A perfect 10 is extremely rare.
- If the answer is off-topic or an attempt to fool, score 0-2.
- Adjust expectations to the candidate's experience level (fresher vs senior).

FINSCORE = average of the three scores, rounded to nearest whole number.

FEEDBACK RULES:
- 10-15 words, natural and professional.
- Mention one specific strength or one specific improvement.
- Do NOT repeat the question.
- Do NOT explain the score.
- Avoid generic phrases like "good answer" or "keep practicing".

Return ONLY valid JSON (no markdown):
{
  "confidence": number,
  "communication": number,
  "correctness": number,
  "finalscore": number,
  "feedback": "short human feedback"
}`,
      },
      {
        role: "user",
        content: `CANDIDATE'S ANSWER:\n${answer}`,
      },
    ];

    const aiResponse = await askAi(messages);
    const cleaned = String(aiResponse)
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) {
        console.error("Unparseable AI response:", cleaned.slice(0, 500));
        return res.status(500).json({ message: "AI returned invalid JSON" });
      }
      parsed = JSON.parse(match[0]);
    }

    question.answer = answer;
    question.confidence = parsed.confidence ?? 0;
    question.communication = parsed.communication ?? 0;
    question.correctness = parsed.correctness ?? 0;
    question.score = parsed.finalscore ?? parsed.score ?? 0;
    question.feedback = parsed.feedback || "";

    await interview.save();
    return res.status(200).json({ feedback: parsed.feedback });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: `Failed to submit answer: ${error.message}` });
  }
};

export const finishInterview = async (req, res) => {
  try {
    const { interviewId } = req.body;
    if (!interviewId)
      return res.status(400).json({ message: "interviewId required." });

    const interview = await Interview.findById(interviewId);
    if (!interview)
      return res.status(404).json({ message: "Interview not found." });

    if (interview.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "Not your interview." });
    }

    const answeredCount = interview.questions.filter(
      (q) => q.answer && q.answer.trim(),
    ).length;

    if (answeredCount < interview.questions.length) {
      return res.status(400).json({
        message: `Please answer all questions (${answeredCount}/${interview.questions.length} done).`,
      });
    }

    const totalQuestions = interview.questions.length;
    let totalScore = 0,
      totalConfidence = 0,
      totalCommunication = 0,
      totalCorrectness = 0;

    interview.questions.forEach((q) => {
      totalScore += q.score || 0;
      totalConfidence += q.confidence || 0;
      totalCommunication += q.communication || 0;
      totalCorrectness += q.correctness || 0;
    });

    const finalScore = totalQuestions ? totalScore / totalQuestions : 0;
    const avgConfidence = totalQuestions ? totalConfidence / totalQuestions : 0;
    const avgCommunication = totalQuestions
      ? totalCommunication / totalQuestions
      : 0;
    const avgCorrectness = totalQuestions
      ? totalCorrectness / totalQuestions
      : 0;

    interview.finalScore = finalScore;
    interview.status = "Completed";

    await interview.save();

    return res.status(200).json({
      finalScore: Number(finalScore.toFixed(1)),
      confidence: Number(avgConfidence.toFixed(1)),
      communication: Number(avgCommunication.toFixed(1)),
      correctness: Number(avgCorrectness.toFixed(1)),
      questionWiseScore: interview.questions.map((q) => ({
        question: q.question,
        score: q.score || 0,
        feedback: q.feedback || "",
        confidence: q.confidence || 0,
        communication: q.communication || 0,
        correctness: q.correctness || 0,
      })),
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: `Failed to finish interview: ${error.message}` });
  }
};
